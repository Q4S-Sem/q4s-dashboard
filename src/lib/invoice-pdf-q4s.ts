import fs from "node:fs";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { formatCurrency, formatDate, formatHours, formatPercent } from "./utils";
import { getLogoFile } from "./branding";

/**
 * Q4S-factuur (PDF). Vormgegeven naar het bestaande Q4S-INVOICE-format: Engelse
 * koppen, briefhoofd met G-rekening/BIC, een "Subject/Services/Our ref"-blok en
 * de tabel REF · AMOUNT · DESCRIPTION · WEEK · LOCATION · PRICE · TOTAL. Werkt voor
 * verkoop (Engels, "INVOICE") én inkoop/self-billing (Nederlands, "INKOOPFACTUUR")
 * via de `language`/`docTitle`-velden — dezelfde renderer, andere labels.
 *
 * Optioneel briefpapier: de eerste PDF in public/templates/facturen/ wordt als
 * achtergrond op elke pagina getekend (best-effort; onleesbaar → standaardopmaak).
 */

function loadLetterheadBytes(): Uint8Array | null {
  try {
    const dir = path.join(process.cwd(), "public", "templates", "facturen");
    const file = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .sort()[0];
    if (!file) return null;
    return fs.readFileSync(path.join(dir, file));
  } catch {
    return null;
  }
}

// Q4S-huisstijl (zwart/neutraal) als 0..1 rgb voor pdf-lib.
const BRAND = rgb(23 / 255, 23 / 255, 23 / 255); // #171717
const INK = rgb(0.06, 0.09, 0.16); // slate-900
const MUTED = rgb(0.42, 0.45, 0.5); // slate-500
const FAINT = rgb(0.62, 0.64, 0.68); // slate-400
const LINE = rgb(0.83, 0.85, 0.88); // slate-200
const GHOST = rgb(0.9, 0.91, 0.93); // licht grijs voor het "INVOICE"-watermerk-achtige woord
const ACCENT = rgb(0.1, 0.13, 0.5); // diepblauw voor de nummers (zoals in het voorbeeld)

/** Eén tabelregel op de factuur. */
export type InvoiceLineRow = {
  ref: string; // "01", "02" …
  amount: number; // aantal (uren of km)
  description: string; // "Total Hours R. van Son" | "KM" | "Weekend surcharge …"
  week: number | null; // ISO-weeknr
  location: string | null; // werklocatie
  unitPrice: number; // tarief
  total: number; // bedrag
};

/** Genormaliseerde factuur — verkoop én inkoop mappen hierop. */
export type InvoiceDoc = {
  /** "INVOICE" | "INKOOPFACTUUR" | "CREDIT NOTE" … (kop rechtsboven). */
  docTitle: string;
  /** Taal van de vaste labels. */
  language: "en" | "nl";
  number: string;
  issueDate: Date;
  dueDate: Date;

  // Rechter meta-blok.
  subject: string | null; // medewerker
  services: string | null; // functie/rol
  ourReference: string | null;
  purchaseOrder: string | null;

  // Leverancier (Q4S).
  company: {
    name: string;
    addressLines: string[];
    contactLines: string[]; // tel / web / e-mail
    iban: string;
    bic: string;
    vatNumber: string;
    kvkNumber: string;
    gAccount: string;
  };

  // Ontvanger.
  recipientLabel: string; // "To:" | "Aan:"
  recipientName: string;
  recipientLines: string[];

  lines: InvoiceLineRow[];

  vatRate: number;
  /** BTW verlegd / reverse charge — dan 0-BTW + verplichte vermelding. */
  vatReverseCharge?: boolean;
  vatNote?: string | null; // bijv. "BTW verlegd" / "VAT reverse-charged"
  subtotal: number;
  vatAmount: number;
  total: number;

  /** "Signed Timesheets attached" e.d. — vetgedrukte notitie boven de totalen. */
  attachmentNote: string | null;
  /** Betaalvoorwaarden-regels onderaan. */
  footerLines: string[];
  notes: string | null;
};

const LABELS = {
  en: {
    number: "Invoice no",
    kvk: "KvK no",
    vat: "VAT no",
    date: "Invoice Date",
    po: "Purchase order",
    subject: "Subject",
    services: "Services",
    ourRef: "Our ref",
    ref: "REF",
    amount: "AMOUNT",
    description: "DESCRIPTION",
    week: "WEEK",
    location: "LOCATION",
    price: "PRICE",
    total: "TOTAL",
    subtotal: "Subtotal",
    vatRate: (r: string) => `VAT rate ${r}`,
    vatReverse: "VAT reverse-charged",
    grandTotal: "Total",
  },
  nl: {
    number: "Factuurnr",
    kvk: "KvK-nr",
    vat: "BTW-nr",
    date: "Factuurdatum",
    po: "Inkooporder",
    subject: "Betreft",
    services: "Functie",
    ourRef: "Ons kenmerk",
    ref: "REF",
    amount: "AANTAL",
    description: "OMSCHRIJVING",
    week: "WEEK",
    location: "LOCATIE",
    price: "TARIEF",
    total: "TOTAAL",
    subtotal: "Subtotaal",
    vatRate: (r: string) => `BTW ${r}`,
    vatReverse: "BTW verlegd",
    grandTotal: "Totaal",
  },
} as const;

// WinAnsi dekt Latin-1 + de cp1252-interpunctie hieronder. Rest droppen we zodat
// pdf-lib nooit crasht op een raar teken.
const CP1252_EXTRA = "€–—‘’“”•…™";
function sanitize(s: string): string {
  return (s ?? "")
    .replace(/ /g, " ")
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

const money = (n: number) => sanitize(formatCurrency(n));

/** Render een Q4S-factuur-PDF (één of meer pagina's). */
export async function renderInvoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const L = LABELS[doc.language];
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const M = 42;
  const right = W - M;

  // Optioneel briefpapier als achtergrond.
  let letterhead: Awaited<ReturnType<typeof pdf.embedPdf>>[number] | null = null;
  const lhBytes = loadLetterheadBytes();
  if (lhBytes) {
    try {
      const [embedded] = await pdf.embedPdf(lhBytes, [0]);
      letterhead = embedded ?? null;
    } catch {
      letterhead = null;
    }
  }

  // Logo (JPG/PNG) embedden.
  let logo: PDFImage | null = null;
  try {
    const f = getLogoFile();
    if (f) {
      if (f.ext === ".png") logo = await pdf.embedPng(f.bytes);
      else if (f.ext === ".jpg" || f.ext === ".jpeg") logo = await pdf.embedJpg(f.bytes);
    }
  } catch {
    logo = null;
  }

  const newPage = (): PDFPage => {
    const p = pdf.addPage([W, H]);
    if (letterhead) p.drawPage(letterhead, { x: 0, y: 0, width: W, height: H });
    return p;
  };

  let page: PDFPage = newPage();
  let y = H - 48;

  const text = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(sanitize(s), { x, y: yy, size, font: f, color });

  const textR = (s: string, xRight: number, yy: number, size: number, f: PDFFont = font, color = INK) => {
    const t = sanitize(s);
    page.drawText(t, { x: xRight - f.widthOfTextAtSize(t, size), y: yy, size, font: f, color });
  };

  const textC = (s: string, xCenter: number, yy: number, size: number, f: PDFFont = font, color = INK) => {
    const t = sanitize(s);
    page.drawText(t, { x: xCenter - f.widthOfTextAtSize(t, size) / 2, y: yy, size, font: f, color });
  };

  const rule = (x1: number, x2: number, yy: number, color = LINE, thickness = 1) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness, color });

  const truncate = (s: string, size: number, maxW: number, f: PDFFont = font) => {
    let t = sanitize(s);
    if (f.widthOfTextAtSize(t, size) <= maxW) return t;
    while (t.length > 1 && f.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
    return t + "…";
  };

  // ---- Kop: logo (links) + docTitle (rechts, licht grijs) ----
  const topY = y;
  if (logo) {
    const targetH = 46;
    const scale = targetH / logo.height;
    const w = logo.width * scale;
    page.drawImage(logo, { x: M, y: topY - targetH + 8, width: w, height: targetH });
  } else {
    text(doc.company.name, M, topY - 6, 22, bold, BRAND);
  }
  textR(doc.docTitle.toUpperCase(), right, topY - 6, 30, bold, GHOST);

  y = topY - 64;

  // ---- Leverancier (links) + contact (midden) ----
  const supplierX = M;
  const contactX = 250;
  let ly = y;
  text(doc.company.name, supplierX, ly, 9.5, bold, INK);
  ly -= 13;
  for (const l of doc.company.addressLines) {
    if (l) { text(l, supplierX, ly, 9, font, MUTED); ly -= 12; }
  }
  let cy = y;
  for (const l of doc.company.contactLines) {
    if (l) { text(l, contactX, cy, 9, font, MUTED); cy -= 12; }
  }
  y = Math.min(ly, cy) - 10;

  // ---- Bankblok (IBAN/BIC/VAT/KvK links + G-rekening) & meta-blok (rechts) ----
  const bankTop = y;
  const bankRows: [string, string][] = [
    ["IBAN", doc.company.iban],
    ["BIC", doc.company.bic],
    ["VAT", doc.company.vatNumber],
    ["KvK", doc.company.kvkNumber],
  ].filter(([, v]) => v) as [string, string][];
  let by = bankTop;
  for (const [k, v] of bankRows) {
    text(k, supplierX, by, 9, font, FAINT);
    text(v, supplierX + 42, by, 9, font, MUTED);
    by -= 12;
  }
  if (doc.company.gAccount) {
    text("G-rekening", contactX, bankTop, 9, font, FAINT);
    text(doc.company.gAccount, contactX + 62, bankTop, 9, font, MUTED);
  }

  // Rechter meta-blok: Subject/Services/Our ref, dan Invoice no/KvK/VAT/Date/PO.
  const metaLabelR = 470;
  const metaValX = 478;
  let my = bankTop + 6;
  const metaLine = (label: string, value: string | null, valueColor = INK, valueFont: PDFFont = font) => {
    if (value == null || value === "") { my -= 14; return; }
    textR(label + ":", metaLabelR, my, 9, font, MUTED);
    text(value, metaValX, my, 9, valueFont, valueColor);
    my -= 14;
  };
  metaLine(L.subject, doc.subject);
  metaLine(L.services, doc.services);
  metaLine(L.ourRef, doc.ourReference);
  my -= 4;
  metaLine(L.number, doc.number, ACCENT, bold);
  metaLine(L.kvk, doc.company.kvkNumber, INK, font);
  metaLine(L.vat, doc.company.vatNumber, INK, font);
  metaLine(L.date, formatDate(doc.issueDate), ACCENT, bold);
  metaLine(L.po, doc.purchaseOrder);

  y = Math.min(by, my) - 8;

  // ---- Ontvanger ("To:") ----
  text(doc.recipientLabel, supplierX, y, 9, bold, INK);
  let ry = y - 14;
  text(doc.recipientName, supplierX, ry, 9.5, bold, INK);
  ry -= 12;
  for (const l of doc.recipientLines) {
    if (l) { text(l, supplierX, ry, 9, font, MUTED); ry -= 12; }
  }
  y = ry - 16;

  // ---- Tabel ----
  // Kolomankers.
  const COL = {
    ref: M, // links
    amount: 118, // rechts
    desc: 128, // links
    descMaxW: 168,
    week: 322, // center
    loc: 350, // links
    locMaxW: 96,
    price: 508, // rechts
    total: right, // rechts
  };

  const tableHead = () => {
    text(L.ref, COL.ref, y, 7.5, bold, MUTED);
    textR(L.amount, COL.amount, y, 7.5, bold, MUTED);
    text(L.description, COL.desc, y, 7.5, bold, MUTED);
    textC(L.week, COL.week, y, 7.5, bold, MUTED);
    text(L.location, COL.loc, y, 7.5, bold, MUTED);
    textR(L.price, COL.price, y, 7.5, bold, MUTED);
    textR(L.total, COL.total, y, 7.5, bold, MUTED);
    y -= 6;
    rule(M, right, y, INK, 0.8);
    y -= 15;
  };
  tableHead();

  const breakPage = (limit: number, withHead = false) => {
    if (y < limit) {
      page = newPage();
      y = H - 60;
      if (withHead) tableHead();
    }
  };

  for (const l of doc.lines) {
    breakPage(150, true);
    text(l.ref, COL.ref, y, 9, font, MUTED);
    textR(formatHours(l.amount), COL.amount, y, 9, font, INK);
    text(truncate(l.description, 9, COL.descMaxW), COL.desc, y, 9, font, INK);
    if (l.week != null) textC(String(l.week), COL.week, y, 9, font, INK);
    if (l.location) text(truncate(l.location, 9, COL.locMaxW), COL.loc, y, 9, font, MUTED);
    textR(money(l.unitPrice), COL.price, y, 9, font, INK);
    textR(money(l.total), COL.total, y, 9, font, INK);
    y -= 15;
  }

  // ---- Attachment-notitie + totalen ----
  y -= 10;
  breakPage(150);
  const totalsTop = y;
  if (doc.attachmentNote) {
    text(doc.attachmentNote, M, totalsTop, 9.5, bold, INK);
  }

  // Totalen rechts uitgelijnd.
  const totLabelR = 480;
  const totValR = right;
  let ty = totalsTop;
  const totalRow = (label: string, value: string, strong = false) => {
    textR(label, totLabelR, ty, strong ? 10.5 : 9, strong ? bold : font, strong ? INK : MUTED);
    textR(value, totValR, ty, strong ? 10.5 : 9, strong ? bold : font, INK);
    ty -= strong ? 4 : 16;
  };
  totalRow(L.subtotal, money(doc.subtotal));
  if (doc.vatReverseCharge) {
    totalRow(doc.vatNote || L.vatReverse, money(0));
  } else {
    totalRow(L.vatRate(formatPercent(doc.vatRate)), money(doc.vatAmount));
  }
  ty -= 2;
  rule(totLabelR - 120, totValR, ty, LINE, 1);
  ty -= 16;
  totalRow(L.grandTotal, money(doc.total), true);

  y = ty - 30;

  // ---- Footer: BTW-verlegd-vermelding (indien), notes, betaalvoorwaarden ----
  const paragraph = (s: string, color = MUTED, size = 9, f: PDFFont = font) => {
    const maxW = right - M;
    let line = "";
    for (const word of sanitize(s).split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) > maxW && line) {
        breakPage(60);
        text(line, M, y, size, f, color);
        y -= 13;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      breakPage(60);
      text(line, M, y, size, f, color);
      y -= 13;
    }
  };

  breakPage(120);
  rule(M, right, y + 10, LINE, 1);
  if (doc.vatReverseCharge && doc.vatNote) {
    paragraph(doc.vatNote, INK, 9, bold);
    y -= 4;
  }
  if (doc.notes) {
    paragraph(doc.notes, INK);
    y -= 4;
  }
  for (const l of doc.footerLines) {
    if (l) paragraph(l);
  }

  return pdf.save();
}
