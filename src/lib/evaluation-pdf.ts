import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { formatDate } from "./utils";
import { EVAL_SCORES } from "./domain";
import { getFormDef, parseJsonMap, averageOfScores, type HeaderKey } from "./evaluation-forms";
import { getLogoFile } from "./branding";

// Het evaluatieformulier zoals externe partijen (inleners, auditors, VCU) het
// krijgen: briefhoofd met logo én bedrijfsgegevens, een leesbare scoretabel,
// een duidelijke eindscore, ondertekening en op elke pagina een voettekst met
// paginanummer. Zelfde huisstijl (bijna-zwart + accentkleuren) als de factuur.

const DARK = rgb(0.09, 0.09, 0.09); // #171717 — sectiebalken
const INK = rgb(0.06, 0.09, 0.16); // slate-900
const MUTED = rgb(0.42, 0.45, 0.5); // slate-500
const FAINT = rgb(0.62, 0.64, 0.68); // slate-400
const LINE = rgb(0.85, 0.87, 0.9); // slate-200
const ZEBRA = rgb(0.973, 0.977, 0.984); // slate-50
const BOXBG = rgb(0.98, 0.984, 0.99);
const GREEN = rgb(0.09, 0.64, 0.29);
const RED = rgb(0.86, 0.15, 0.15);
const WHITE = rgb(1, 1, 1);
const SCORE_RGB: RGB[] = [
  rgb(0.86, 0.15, 0.15), // Slecht
  rgb(0.96, 0.62, 0.04), // Matig
  rgb(0.52, 0.8, 0.09), // Normaal
  rgb(0.09, 0.64, 0.29), // Goed
];

const CP1252_EXTRA = "€–—‘’“”•…™";
function sanitize(s: string): string {
  return (s ?? "")
    .replace(/ /g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 0x20 && code <= 0x7e) return ch;
      if (code >= 0xa0 && code <= 0xff) return ch;
      if (CP1252_EXTRA.includes(ch)) return ch;
      return "";
    })
    .join("");
}

export type EvaluationForPdf = {
  type: string;
  status?: string | null;
  year: number;
  quarter: number;
  evaluationDate: Date | null;
  clientName: string | null;
  clientAddress: string | null;
  department: string | null;
  reference: string | null;
  functionTitle: string | null;
  workLocation: string | null;
  periodText: string | null;
  evaluatorName: string | null;
  scoresJson: string | null;
  answersJson: string | null;
};

/** Afzendergegevens uit Instellingen — vormen het briefhoofd en de voettekst. */
export type EvaluationPdfCompany = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  kvkNumber?: string | null;
  vatNumber?: string | null;
  website?: string | null;
};

const W = 595.28;
const H = 841.89;
const M = 48;
const RIGHT = W - M;
const BOTTOM = 66; // ruimte voor de voettekst
/**
 * De scorekolommen. Berekend en niet met de hand ingetikt: de vorige waarden
 * ([352, 412, 472, 528]) stonden 60, 60 en 56 punten uit elkaar, en die laatste
 * vier punten zie je meteen als de kolom "Goed" scheef onder zijn kop staat.
 */
const SCORE_X0 = 330;
const SCORE_W = (RIGHT - SCORE_X0) / 4;
const SCORE_CX = [0, 1, 2, 3].map((i) => SCORE_X0 + (i + 0.5) * SCORE_W);

/** Inspringing van tekst binnen een sectiebalk of tabelrij — overal dezelfde. */
const PAD = 9;

/** Render a filled-in evaluation as a Q4S PDF, driven by the form template. */
export async function renderEvaluationPdf(
  ev: EvaluationForPdf,
  consultantName: string,
  company: EvaluationPdfCompany,
): Promise<Uint8Array> {
  const def = getFormDef(ev.type);
  const scores = parseJsonMap(ev.scoresJson);
  const answers = parseJsonMap(ev.answersJson);
  const headerVal = (k: HeaderKey) => String(ev[k] ?? "");

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  // ---- teken-helpers ----
  const at = (s: string, x: number, yy: number, size: number, f: PDFFont = font, c = INK) =>
    page.drawText(sanitize(s), { x, y: yy, size, font: f, color: c });
  const right = (s: string, xr: number, yy: number, size: number, f: PDFFont = font, c = INK) => {
    const t = sanitize(s);
    page.drawText(t, { x: xr - f.widthOfTextAtSize(t, size), y: yy, size, font: f, color: c });
  };
  const center = (s: string, cx: number, yy: number, size: number, f: PDFFont = font, c = INK) => {
    const t = sanitize(s);
    page.drawText(t, { x: cx - f.widthOfTextAtSize(t, size) / 2, y: yy, size, font: f, color: c });
  };
  const rule = (yy: number, c = LINE, thickness = 1) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: RIGHT, y: yy }, thickness, color: c });

  /** Knip tekst af op een maximale breedte (met …). */
  const clip = (s: string, maxW: number, size: number, f: PDFFont = font) => {
    let t = sanitize(s);
    if (f.widthOfTextAtSize(t, size) <= maxW) return t;
    while (t.length > 1 && f.widthOfTextAtSize(`${t}…`, size) > maxW) t = t.slice(0, -1);
    return `${t}…`;
  };

  /** Woordwikkeling; geeft de regels terug zonder te tekenen. */
  const wrap = (s: string, maxW: number, size: number, f: PDFFont = font): string[] => {
    const out: string[] = [];
    let line = "";
    for (const word of sanitize(s).split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) > maxW && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    return out;
  };

  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
    // Vervolgpagina's krijgen een compacte kop, zodat losse vellen herkenbaar blijven.
    at(def.title, M, y, 8.5, bold, MUTED);
    right(`${consultantName} · Q${ev.quarter} ${ev.year}`, RIGHT, y, 8.5, font, MUTED);
    y -= 8;
    rule(y);
    y -= 20;
  };
  const ensure = (space: number): boolean => {
    if (y - space < BOTTOM) {
      newPage();
      return true;
    }
    return false;
  };

  /** Alinea vanaf de huidige y. */
  const para = (s: string, size = 9, c = INK, indent = 0) => {
    for (const line of wrap(s, RIGHT - M - indent, size)) {
      ensure(13);
      at(line, M + indent, y, size, font, c);
      y -= 12.5;
    }
  };

  const sectionBar = (label: string) => {
    // Ruim genoeg voor de balk, de kolomkoppen én een paar regels — zo blijft er
    // nooit een losse sectiekop onderaan een pagina staan.
    ensure(96);
    page.drawRectangle({ x: M, y: y - 15, width: RIGHT - M, height: 20, color: DARK });
    at(label.toUpperCase(), M + PAD, y - 9, 8.5, bold, WHITE);
    y -= 32;
  };

  /** Kolomkoppen van de scoretabel (herhaalt bij een paginawissel). */
  const scoreHeader = () => {
    at("Beoordeeld op", M + PAD, y, 7.5, bold, MUTED);
    EVAL_SCORES.forEach((s, i) => center(s.label.toUpperCase(), SCORE_CX[i], y, 7.5, bold, MUTED));
    y -= 7;
    rule(y);
    y -= 14;
  };

  /** Linkerkant van een "vakje + label", zó dat het geheel op `cx` uitkomt. */
  const hokX = (cx: number, label: string) => cx - (9 + 5 + bold.widthOfTextAtSize(label, 9)) / 2;

  /** Aankruisvakje (leeg of aangevinkt) met label ernaast. */
  const checkbox = (x: number, yy: number, checked: boolean, label: string, color: RGB) => {
    const s = 9;
    page.drawRectangle({
      x,
      y: yy - 1,
      width: s,
      height: s,
      color: checked ? color : WHITE,
      borderColor: checked ? color : LINE,
      borderWidth: 1,
    });
    if (checked) {
      page.drawLine({
        start: { x: x + 2, y: yy + 3.2 },
        end: { x: x + 3.6, y: yy + 1.4 },
        thickness: 1.3,
        color: WHITE,
      });
      page.drawLine({
        start: { x: x + 3.6, y: yy + 1.4 },
        end: { x: x + 7, y: yy + 6 },
        thickness: 1.3,
        color: WHITE,
      });
    }
    at(label, x + s + 5, yy, 9, checked ? bold : font, checked ? color : INK);
  };

  // ---- Briefhoofd: logo links, bedrijfsgegevens rechts ----
  const topY = H - 40;
  let headerBottom = topY - 44;
  const logoFile = getLogoFile();
  if (logoFile && [".png", ".jpg", ".jpeg"].includes(logoFile.ext)) {
    try {
      const img =
        logoFile.ext === ".png"
          ? await pdf.embedPng(logoFile.bytes)
          : await pdf.embedJpg(logoFile.bytes);
      const targetH = 42;
      let w = (img.width / img.height) * targetH;
      let h = targetH;
      if (w > 170) {
        h = (170 / w) * targetH;
        w = 170;
      }
      page.drawImage(img, { x: M, y: topY - h, width: w, height: h });
      headerBottom = Math.min(headerBottom, topY - h);
    } catch {
      at(company.name || "Q4S", M, topY - 16, 18, bold, DARK);
    }
  } else {
    at(company.name || "Q4S", M, topY - 16, 18, bold, DARK);
  }

  const companyLines = [
    [company.address, [company.postalCode, company.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    [company.phone, company.email].filter(Boolean).join(" · "),
    [
      company.kvkNumber ? `KvK ${company.kvkNumber}` : "",
      company.vatNumber ? `BTW ${company.vatNumber}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    company.website ?? "",
  ].filter(Boolean) as string[];

  right(company.name, RIGHT, topY - 8, 10, bold, INK);
  companyLines.forEach((l, i) => right(l, RIGHT, topY - 21 - i * 10, 7.8, font, MUTED));
  headerBottom = Math.min(headerBottom, topY - 21 - companyLines.length * 10);

  y = headerBottom - 14;
  rule(y, LINE, 1);
  y -= 24;

  // ---- Titel + meta ----
  at(def.title, M, y, 15, bold, INK);
  at(def.subtitle, M, y - 15, 9.5, font, MUTED);
  if (company.email) {
    at(`Ingevuld formulier graag retour naar ${company.email}`, M, y - 28, 8.5, font, FAINT);
  }

  // Metablok rechtsboven: periode, datum en (indien concept) de status.
  const metaW = 150;
  const metaX = RIGHT - metaW;
  const isConcept = (ev.status ?? "").toUpperCase() === "CONCEPT";
  const metaH = isConcept ? 72 : 46;
  page.drawRectangle({
    x: metaX,
    y: y - metaH + 14,
    width: metaW,
    height: metaH,
    color: BOXBG,
    borderColor: LINE,
    borderWidth: 1,
  });
  at("PERIODE", metaX + 10, y + 2, 7, bold, MUTED);
  at(`Q${ev.quarter} · ${ev.year}`, metaX + 10, y - 11, 11, bold, INK);
  at("DATUM", metaX + 88, y + 2, 7, bold, MUTED);
  at(formatDate(ev.evaluationDate), metaX + 88, y - 11, 9, font, INK);
  if (isConcept) {
    at("STATUS", metaX + 10, y - 28, 7, bold, MUTED);
    at(
      clip("CONCEPT — nog niet definitief", metaW - 20, 7.5, bold),
      metaX + 10,
      y - 41,
      7.5,
      bold,
      rgb(0.85, 0.5, 0.04),
    );
  }

  // Het metablok is hoger als er een conceptregel in staat. Die hoogte moet mee
  // in de sprong naar het volgende blok, anders schuift het conceptvel zijn eigen
  // infoblokken eroverheen — precies het geval dat je pas ziet bij een concept.
  y -= Math.max(52, metaH + 8);

  // ---- Medewerker + gegevens van de uitzending ----
  const boxTop = y;
  const gap = 14;
  const colW = (RIGHT - M - gap) / 2;

  // Links: de beoordeelde medewerker.
  const leftLines: [string, string][] = [
    ["Functie", headerVal("functionTitle")],
    ["Werklocatie", headerVal("workLocation")],
    ["Periode", headerVal("periodText")],
  ].filter(([, v]) => v) as [string, string][];
  const leftH = 46 + leftLines.length * 12;

  // Rechts: het inlenende bedrijf en de aanvraag. Korte labels, want de volledige
  // formuliernamen ("Aanvraagnummer of referentie") passen niet naast de waarde.
  const SHORT_LABEL: Partial<Record<HeaderKey, string>> = {
    clientName: "Bedrijf",
    clientAddress: "Adres",
    department: "Afdeling",
    reference: "Referentie",
  };
  const rightKeys: HeaderKey[] = ["clientName", "clientAddress", "department", "reference"];
  const LABEL_W = 62;
  const waardeW = colW - 20 - LABEL_W;
  // Een adres past zelden op één regel. Afkappen met "…" maakt van een
  // vestigingsadres een raadsel, dus loopt het door op een tweede regel.
  const rightLines = def.headerFields
    .filter((h) => rightKeys.includes(h.key))
    .flatMap((h) => {
      const waarde = headerVal(h.key);
      if (!waarde) return [];
      const regels = wrap(waarde, waardeW, 8.5).slice(0, 2);
      return regels.map((r, i) => [i === 0 ? (SHORT_LABEL[h.key] ?? h.label) : "", r] as [string, string]);
    });
  const rightH = 30 + Math.max(1, rightLines.length) * 12;

  const boxH = Math.max(leftH, rightH, 78);
  const drawBox = (x: number, title: string) => {
    page.drawRectangle({
      x,
      y: boxTop - boxH + 12,
      width: colW,
      height: boxH,
      color: BOXBG,
      borderColor: LINE,
      borderWidth: 1,
    });
    at(title.toUpperCase(), x + 10, boxTop, 7, bold, MUTED);
  };

  drawBox(M, "Medewerker");
  at(clip(consultantName, colW - 20, 13, bold), M + 10, boxTop - 15, 13, bold, INK);
  leftLines.forEach(([label, value], i) => {
    const yy = boxTop - 32 - i * 12;
    at(`${label}:`, M + 10, yy, 8, bold, MUTED);
    at(clip(value, waardeW, 8.5), M + 10 + LABEL_W, yy, 8.5, font, INK);
  });

  const rx = M + colW + gap;
  drawBox(rx, "Inlener & opdracht");
  if (rightLines.length === 0) {
    at("—", rx + 10, boxTop - 16, 9, font, FAINT);
  }
  rightLines.forEach(([label, value], i) => {
    const yy = boxTop - 16 - i * 12;
    if (label) at(`${label}:`, rx + 10, yy, 8, bold, MUTED);
    at(clip(value, waardeW, 8.5), rx + 10 + LABEL_W, yy, 8.5, font, INK);
  });

  y = boxTop - boxH - 6;

  // ---- Scoresecties ----
  for (const sec of def.scoreSections) {
    sectionBar(sec.title);
    scoreHeader();

    sec.criteria.forEach((crit, idx) => {
      if (ensure(22)) scoreHeader();
      const val = Number(scores[crit.key]);
      const rowH = 18;
      if (idx % 2 === 1) {
        page.drawRectangle({
          x: M,
          y: y - 5,
          width: RIGHT - M,
          height: rowH,
          color: ZEBRA,
        });
      }
      // Klemt tegen de eerste scorekolom aan, niet tegen een vast getal.
      at(clip(crit.label, SCORE_X0 - M - PAD - 10, 9), M + PAD, y, 9, font, INK);
      EVAL_SCORES.forEach((s, i) => {
        const on = val === Number(s.value);
        if (on) {
          page.drawCircle({ x: SCORE_CX[i], y: y + 3, size: 5, color: SCORE_RGB[i] });
        } else {
          page.drawCircle({
            x: SCORE_CX[i],
            y: y + 3,
            size: 4,
            borderColor: LINE,
            borderWidth: 1,
            color: WHITE,
          });
        }
      });
      y -= rowH;
      page.drawLine({
        start: { x: M, y: y + 8 },
        end: { x: RIGHT, y: y + 8 },
        thickness: 0.5,
        color: LINE,
      });
    });

    // Gemiddelde van deze sectie.
    const secScores: Record<string, unknown> = {};
    for (const c of sec.criteria) if (scores[c.key] != null) secScores[c.key] = scores[c.key];
    const secAvg = averageOfScores(secScores);
    if (secAvg != null) {
      ensure(16);
      right(
        `Gemiddelde ${sec.title.toLowerCase()}: ${secAvg.toFixed(1).replace(".", ",")} / 4`,
        RIGHT,
        y,
        8.5,
        bold,
        MUTED,
      );
      y -= 16;
    }

    const note = String(answers[sec.noteKey] ?? "").trim();
    if (note) {
      ensure(20);
      at("Toelichting", M + PAD, y, 7.5, bold, MUTED);
      y -= 13;
      para(note, 9, INK, PAD);
    }
    y -= 12;
  }

  // ---- Afronding: vrije tekst + ja/nee ----
  if (def.textFields.length > 0 || def.boolQuestions.length > 0) {
    sectionBar(def.closingTitle ?? "Afronding");
    for (const t of def.textFields) {
      const v = String(answers[t.key] ?? "").trim();
      ensure(18);
      at(t.label, M + PAD, y, 7.5, bold, MUTED);
      y -= 13;
      para(v || "—", 9, v ? INK : FAINT, PAD);
      y -= 6;
    }
    for (const b of def.boolQuestions) {
      ensure(20);
      const v = String(answers[b.key] ?? "");
      at(clip(b.label, SCORE_X0 - M - PAD - 10, 9), M + PAD, y, 9, font, INK);
      // Gecentreerd onder de twee rechter scorekolommen: dan staat álles in dit
      // formulier op hetzelfde stramien, ook de vragen zonder scoreschaal.
      checkbox(hokX(SCORE_CX[2], "Ja"), y, v === "ja", "Ja", GREEN);
      checkbox(hokX(SCORE_CX[3], "Nee"), y, v === "nee", "Nee", RED);
      y -= 20;
    }
    const note = String(answers[def.closingNoteKey] ?? "").trim();
    if (note) {
      ensure(20);
      at("Toelichting", M + PAD, y, 7.5, bold, MUTED);
      y -= 13;
      para(note, 9, INK, PAD);
    }
    y -= 10;
  }

  // ---- Eindscore ----
  const avg = averageOfScores(scores);
  if (avg != null) {
    ensure(58);
    const boxH2 = 48;
    page.drawRectangle({
      x: M,
      y: y - boxH2 + 12,
      width: RIGHT - M,
      height: boxH2,
      color: BOXBG,
      borderColor: LINE,
      borderWidth: 1,
    });
    at("EINDSCORE", M + PAD, y, 7, bold, MUTED);
    const rounded = Math.max(1, Math.min(4, Math.round(avg)));
    const label = EVAL_SCORES[rounded - 1]?.label ?? "";
    at(`${avg.toFixed(1).replace(".", ",")} / 4`, M + PAD, y - 18, 16, bold, INK);
    at(label, M + PAD + 62, y - 17, 11, bold, SCORE_RGB[rounded - 1]);

    // Vier segmenten; de behaalde segmenten kleuren mee.
    const segW = 46;
    const barX = RIGHT - PAD - (segW * 4 + 6);
    for (let i = 0; i < 4; i++) {
      page.drawRectangle({
        x: barX + i * (segW + 2),
        y: y - 20,
        width: segW,
        height: 9,
        color: i < rounded ? SCORE_RGB[rounded - 1] : rgb(0.9, 0.91, 0.93),
      });
    }
    right(
      `${Object.values(scores).filter((v) => Number(v) >= 1 && Number(v) <= 4).length} van ${
        def.scoreSections.reduce((n, s) => n + s.criteria.length, 0)
      } punten beoordeeld`,
      RIGHT - PAD,
      y,
      7.5,
      font,
      MUTED,
    );
    y -= boxH2 + 10;
  }

  // ---- Ondertekening ----
  ensure(70);
  rule(y);
  y -= 20;
  // Ook dit blok op het stramien: elke tekstregel in dit document begint op
  // dezelfde x, of er nu een kader omheen staat of niet.
  at("ONDERTEKENING", M + PAD, y, 7, bold, MUTED);
  y -= 20;
  const sigCol = (x: number, label: string, value: string, width: number) => {
    at(label, x, y, 7.5, bold, MUTED);
    if (value) at(clip(value, width, 10), x, y - 15, 10, font, INK);
    page.drawLine({
      start: { x, y: y - 22 },
      end: { x: x + width, y: y - 22 },
      thickness: 0.8,
      color: LINE,
    });
  };
  sigCol(M + PAD, def.evaluatorLabel, ev.evaluatorName || "", 190);
  sigCol(M + PAD + 210, "Datum", formatDate(ev.evaluationDate), 110);
  sigCol(M + PAD + 340, "Handtekening", "", RIGHT - PAD - (M + PAD + 340));

  // ---- Voettekst op elke pagina ----
  const pages = pdf.getPages();
  const footerLeft = [
    company.name,
    [company.address, [company.postalCode, company.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    company.kvkNumber ? `KvK ${company.kvkNumber}` : "",
    company.vatNumber ? `BTW ${company.vatNumber}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: M, y: 44 },
      end: { x: RIGHT, y: 44 },
      thickness: 0.8,
      color: LINE,
    });
    p.drawText(sanitize(clip(footerLeft, RIGHT - M - 90, 7, font)), {
      x: M,
      y: 32,
      size: 7,
      font,
      color: MUTED,
    });
    const pageLabel = `Pagina ${i + 1} van ${pages.length}`;
    p.drawText(pageLabel, {
      x: RIGHT - font.widthOfTextAtSize(pageLabel, 7),
      y: 32,
      size: 7,
      font,
      color: MUTED,
    });
  });

  return pdf.save();
}
