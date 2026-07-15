import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { formatDate } from "./utils";
import { EVAL_SCORES } from "./domain";
import { getFormDef, parseJsonMap, type HeaderKey } from "./evaluation-forms";
import { getLogoFile } from "./branding";

const BRAND = rgb(232 / 255, 67 / 255, 10 / 255); // #e8430a
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.82, 0.84, 0.88);
const GREEN = rgb(0.09, 0.64, 0.29);
const RED = rgb(0.94, 0.27, 0.27);
const BARBG = rgb(0.93, 0.93, 0.94);
const SCORE_RGB = [
  rgb(0.94, 0.27, 0.27),
  rgb(0.98, 0.45, 0.09),
  rgb(0.52, 0.8, 0.09),
  rgb(0.09, 0.64, 0.29),
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

const W = 595.28;
const H = 841.89;
const M = 50;
const RIGHT = W - M;
const SCORE_CX = [355, 415, 475, 528];

/** Render a filled-in evaluation as a Q4S PDF, driven by the form template. */
export async function renderEvaluationPdf(
  ev: EvaluationForPdf,
  consultantName: string,
  company: { name: string; email: string },
): Promise<Uint8Array> {
  const def = getFormDef(ev.type);
  const scores = parseJsonMap(ev.scoresJson);
  const answers = parseJsonMap(ev.answersJson);
  const headerVal = (k: HeaderKey) => (ev[k] ?? "") as string;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - 50;

  const text = (s: string, x: number, size: number, f: PDFFont = font, c = INK) =>
    page.drawText(sanitize(s), { x, y, size, font: f, color: c });
  const textAt = (s: string, x: number, yy: number, size: number, f: PDFFont = font, c = INK) =>
    page.drawText(sanitize(s), { x, y: yy, size, font: f, color: c });
  const textC = (s: string, cx: number, yy: number, size: number, f: PDFFont = font, c = INK) => {
    const t = sanitize(s);
    page.drawText(t, { x: cx - f.widthOfTextAtSize(t, size) / 2, y: yy, size, font: f, color: c });
  };
  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - 50;
  };
  const ensure = (space: number): boolean => {
    if (y - space < 50) {
      newPage();
      return true;
    }
    return false;
  };

  // Wrapped paragraph from current y.
  const para = (s: string, size = 9, c = INK) => {
    const maxW = RIGHT - M;
    let line = "";
    for (const word of sanitize(s).split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        ensure(14);
        textAt(line, M, y, size, font, c);
        y -= 13;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      ensure(14);
      textAt(line, M, y, size, font, c);
      y -= 13;
    }
  };

  const sectionBar = (label: string) => {
    ensure(34);
    page.drawRectangle({ x: M, y: y - 14, width: RIGHT - M, height: 18, color: BARBG });
    textAt(label, M + 8, y - 10, 9, bold, INK);
    y -= 30;
  };

  const scoreHeader = () => {
    textAt("Beoordeel op", M, y, 8, bold, MUTED);
    EVAL_SCORES.forEach((s, i) => textC(s.label, SCORE_CX[i], y, 8, bold, MUTED));
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 1, color: LINE });
    y -= 14;
  };

  // ---- Header ----
  // Logo linksboven (Q4S Project Partners) i.p.v. de bedrijfsnaam als tekst.
  let logoOk = false;
  const logoFile = getLogoFile();
  if (logoFile && [".png", ".jpg", ".jpeg"].includes(logoFile.ext)) {
    try {
      const img =
        logoFile.ext === ".png"
          ? await pdf.embedPng(logoFile.bytes)
          : await pdf.embedJpg(logoFile.bytes);
      const targetH = 40;
      let w = (img.width / img.height) * targetH;
      let h = targetH;
      const maxW = 200; // botst nooit met het periode/datum-blok rechtsboven
      if (w > maxW) {
        h = (maxW / w) * targetH;
        w = maxW;
      }
      page.drawImage(img, { x: M, y: H - 46 - h, width: w, height: h });
      y = H - 46 - h - 14;
      logoOk = true;
    } catch {
      logoOk = false;
    }
  }
  if (!logoOk) {
    // Terugval: bedrijfsnaam als tekst (als er geen logobestand is).
    text(company.name || "Q4S", M, 19, bold, BRAND);
    y -= 17;
  }
  text(def.title, M, 11, bold, INK);
  y -= 13;
  text(def.subtitle, M, 9, font, MUTED);
  if (company.email) {
    y -= 12;
    text(`Retour zenden naar ${company.email}`, M, 9, font, MUTED);
  }
  // right meta
  textAt("PERIODE", RIGHT - 150, H - 50, 8, bold, MUTED);
  textAt(`Q${ev.quarter} · ${ev.year}`, RIGHT - 150, H - 63, 11, bold, INK);
  textAt("DATUM", RIGHT - 150, H - 80, 8, bold, MUTED);
  textAt(formatDate(ev.evaluationDate), RIGHT - 150, H - 92, 9, font, INK);
  y -= 18;
  page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 1, color: LINE });
  y -= 20;

  // ---- Uitzendkracht ----
  text("Medewerker", M, 8, bold, MUTED);
  y -= 14;
  text(consultantName, M, 12, bold, INK);
  y -= 22;

  // ---- Header fields ----
  sectionBar(def.subtitle);
  for (const h of def.headerFields) {
    ensure(15);
    textAt(`${h.label}`, M, y, 8, bold, MUTED);
    textAt(headerVal(h.key) || "—", M + 230, y, 9, font, INK);
    y -= 15;
  }
  y -= 6;

  // ---- Score sections ----
  for (const sec of def.scoreSections) {
    sectionBar(sec.title);
    scoreHeader();
    for (const crit of sec.criteria) {
      if (ensure(20)) scoreHeader();
      const val = Number(scores[crit.key]);
      textAt(crit.label, M, y, 9, font, INK);
      EVAL_SCORES.forEach((s, i) => {
        const on = val === Number(s.value);
        textC(on ? "X" : "·", SCORE_CX[i], y, on ? 12 : 9, on ? bold : font, on ? SCORE_RGB[i] : LINE);
      });
      y -= 8;
      page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 1, color: LINE });
      y -= 14;
    }
    const note = String(answers[sec.noteKey] ?? "").trim();
    if (note) {
      y -= 2;
      textAt("Toelichting:", M, y, 8, bold, MUTED);
      y -= 13;
      para(note);
    }
    y -= 8;
  }

  // ---- Closing block ----
  if (def.textFields.length > 0 || def.boolQuestions.length > 0) {
    sectionBar(def.closingTitle ?? "Afronding");
    for (const t of def.textFields) {
      const v = String(answers[t.key] ?? "").trim();
      ensure(16);
      textAt(`${t.label}:`, M, y, 8, bold, MUTED);
      y -= 13;
      para(v || "—");
      y -= 4;
    }
    for (const b of def.boolQuestions) {
      ensure(16);
      const v = String(answers[b.key] ?? "");
      const yes = v === "ja";
      const no = v === "nee";
      textAt(b.label, M, y, 9, font, INK);
      textAt(`${yes ? "[X]" : "[  ]"} Ja`, RIGHT - 130, y, 10, yes ? bold : font, yes ? GREEN : INK);
      textAt(`${no ? "[X]" : "[  ]"} Nee`, RIGHT - 70, y, 10, no ? bold : font, no ? RED : INK);
      y -= 17;
    }
    const note = String(answers[def.closingNoteKey] ?? "").trim();
    if (note) {
      y -= 2;
      textAt("Toelichting:", M, y, 8, bold, MUTED);
      y -= 13;
      para(note);
    }
    y -= 8;
  }

  // ---- Ondertekening ----
  ensure(40);
  page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 1, color: LINE });
  y -= 18;
  textAt(def.evaluatorLabel, M, y, 8, bold, MUTED);
  textAt(ev.evaluatorName || "—", M, y - 13, 10, font, INK);
  textAt("Datum", M + 230, y, 8, bold, MUTED);
  textAt(formatDate(ev.evaluationDate), M + 230, y - 13, 10, font, INK);
  textAt("Paraaf", M + 380, y, 8, bold, MUTED);
  page.drawLine({ start: { x: M + 380, y: y - 14 }, end: { x: RIGHT, y: y - 14 }, thickness: 1, color: LINE });

  return pdf.save();
}
