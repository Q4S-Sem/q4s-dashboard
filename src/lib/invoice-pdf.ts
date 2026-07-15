import fs from "node:fs";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { formatCurrency, formatDate, formatHours, formatPercent } from "./utils";

/**
 * Optioneel Q4S-briefpapier: de eerste PDF in public/templates/facturen/ wordt
 * als achtergrond op elke factuurpagina getekend (zie de LEESMIJ daar). Geen
 * bestand → standaard Q4S-opmaak. Best-effort: een onleesbaar bestand wordt
 * genegeerd zodat de facturatie nooit stukloopt op het briefpapier.
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

// Q4S brand + neutrals, as 0..1 rgb for pdf-lib. Brand is de nieuwe neutraal/
// zwarte huisstijl (#171717) — consistent met de app en met een geüpload
// briefpapier (i.p.v. het oude oranje).
const BRAND = rgb(23 / 255, 23 / 255, 23 / 255); // #171717
const INK = rgb(0.06, 0.09, 0.16); // slate-900
const MUTED = rgb(0.42, 0.45, 0.5); // slate-500
const LINE = rgb(0.85, 0.87, 0.9); // slate-200

/** A normalized invoice — both sales (verkoop) and purchase (inkoop) map to this. */
export type InvoiceDoc = {
  title: string; // "Factuur" | "Inkoopfactuur"
  number: string;
  issueDate: Date;
  dueDate: Date;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes: string | null;
  lines: { description: string; quantity: number; unitPrice: number; amount: number }[];
  company: {
    name: string;
    addressLines: string[];
    contactLines: string[]; // e-mail / telefoon / website
    taxLines: string[]; // BTW / KvK / IBAN
  };
  recipientLabel: string; // "Factuur aan" | "Aan"
  recipientName: string;
  recipientLines: string[];
  footerText: string | null; // betaalinstructie
  footerNote: string | null; // invoiceFooter
};

// WinAnsi (used by the standard fonts) covers Latin-1 + the cp1252 punctuation
// below. Anything else would make pdf-lib throw on encode, so we drop it.
const CP1252_EXTRA = "€–—‘’“”•…™";
function sanitize(s: string): string {
  return (s ?? "")
    .replace(/ /g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 0x20 && code <= 0x7e) return ch; // ASCII
      if (code >= 0xa0 && code <= 0xff) return ch; // Latin-1 (accented letters)
      if (CP1252_EXTRA.includes(ch)) return ch; // €, dashes, smart quotes…
      return "";
    })
    .join("");
}

function money(n: number) {
  return sanitize(formatCurrency(n));
}

/** Render a Q4S-branded one-or-more-page invoice PDF. */
export async function renderInvoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const M = 50;
  const right = W - M;

  // Optioneel briefpapier: embed de eerste pagina en teken hem als achtergrond
  // op elke nieuwe factuurpagina (vóór de tekst, zodat de gegevens er bovenop komen).
  let letterhead: Awaited<ReturnType<typeof pdf.embedPdf>>[number] | null = null;
  const bytes = loadLetterheadBytes();
  if (bytes) {
    try {
      const [embedded] = await pdf.embedPdf(bytes, [0]);
      letterhead = embedded ?? null;
    } catch {
      letterhead = null; // onleesbaar briefpapier → standaardopmaak
    }
  }

  const newPage = (): PDFPage => {
    const p = pdf.addPage([W, H]);
    if (letterhead) p.drawPage(letterhead, { x: 0, y: 0, width: W, height: H });
    return p;
  };

  let page: PDFPage = newPage();
  let y = H - 60;

  const text = (
    s: string,
    x: number,
    yy: number,
    size: number,
    f: PDFFont = font,
    color = INK,
  ) => page.drawText(sanitize(s), { x, y: yy, size, font: f, color });

  const textR = (
    s: string,
    xRight: number,
    yy: number,
    size: number,
    f: PDFFont = font,
    color = INK,
  ) => {
    const t = sanitize(s);
    page.drawText(t, {
      x: xRight - f.widthOfTextAtSize(t, size),
      y: yy,
      size,
      font: f,
      color,
    });
  };

  const rule = (x1: number, yy: number) =>
    page.drawLine({
      start: { x: x1, y: yy },
      end: { x: right, y: yy },
      thickness: 1,
      color: LINE,
    });

  // ---- Header: company (left) + title/meta (right) ----
  text(doc.company.name, M, y, 20, bold, BRAND);
  let ly = y - 17;
  for (const l of [...doc.company.addressLines, "", ...doc.company.contactLines]) {
    if (l) text(l, M, ly, 9, font, MUTED);
    ly -= l ? 12 : 5;
  }

  textR(doc.title.toUpperCase(), right, y, 18, bold, INK);
  let ry = y - 22;
  for (const [k, v] of [
    ["Nummer", doc.number],
    ["Datum", formatDate(doc.issueDate)],
    ["Vervaldatum", formatDate(doc.dueDate)],
  ] as [string, string][]) {
    text(k, right - 190, ry, 9, font, MUTED);
    textR(v, right, ry, 9, bold, INK);
    ry -= 14;
  }

  y = Math.min(ly, ry) - 16;
  rule(M, y);
  y -= 22;

  // ---- Recipient (left) + Q4S tax block (right) ----
  text(doc.recipientLabel.toUpperCase(), M, y, 8, bold, MUTED);
  text(doc.recipientName, M, y - 15, 11, bold, INK);
  let recY = y - 30;
  for (const l of doc.recipientLines) {
    if (l) {
      text(l, M, recY, 9, font, INK);
      recY -= 12;
    }
  }
  let taxY = y - 15;
  for (const l of doc.company.taxLines) {
    if (l) {
      textR(l, right, taxY, 9, font, MUTED);
      taxY -= 12;
    }
  }

  y = Math.min(recY, taxY) - 20;

  // ---- Lines table ----
  const COL = { desc: M, hours: 360, rate: 458, amount: right };
  const tableHead = () => {
    text("Omschrijving", COL.desc, y, 8, bold, MUTED);
    textR("Uren", COL.hours, y, 8, bold, MUTED);
    textR("Tarief", COL.rate, y, 8, bold, MUTED);
    textR("Bedrag", COL.amount, y, 8, bold, MUTED);
    y -= 7;
    rule(M, y);
    y -= 15;
  };
  tableHead();

  // withHead=true re-draws the line-table column header on the new page — only
  // wanted while we're still inside the lines table, NOT for the totals/footer.
  const breakPage = (limit = 130, withHead = false) => {
    if (y < limit) {
      page = newPage();
      y = H - 60;
      if (withHead) tableHead();
    }
  };

  const truncate = (s: string, size: number, maxW: number) => {
    let t = sanitize(s);
    if (font.widthOfTextAtSize(t, size) <= maxW) return t;
    while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) {
      t = t.slice(0, -1);
    }
    return t + "…";
  };

  for (const l of doc.lines) {
    breakPage(130, true);
    text(truncate(l.description, 9, COL.hours - 70 - COL.desc), COL.desc, y, 9, font, INK);
    textR(formatHours(l.quantity), COL.hours, y, 9, font, INK);
    textR(money(l.unitPrice), COL.rate, y, 9, font, INK);
    textR(money(l.amount), COL.amount, y, 9, font, INK);
    y -= 16;
  }

  // ---- Totals ----
  y -= 6;
  page.drawLine({ start: { x: 330, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 16;
  const totalRow = (label: string, value: string, strong = false) => {
    text(label, 360, y, strong ? 11 : 9, strong ? bold : font, strong ? INK : MUTED);
    textR(value, right, y, strong ? 11 : 9, strong ? bold : font, INK);
    y -= strong ? 0 : 15;
  };
  totalRow("Subtotaal", money(doc.subtotal));
  totalRow(`BTW (${formatPercent(doc.vatRate)})`, money(doc.vatAmount));
  y -= 2;
  page.drawLine({ start: { x: 360, y }, end: { x: right, y }, thickness: 1, color: LINE });
  y -= 16;
  totalRow("Totaal", money(doc.total), true);
  y -= 26;

  // ---- Footer ----
  const paragraph = (s: string, color = MUTED, size = 9) => {
    const maxW = right - M;
    let line = "";
    for (const word of sanitize(s).split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        breakPage(70);
        text(line, M, y, size, font, color);
        y -= 13;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      breakPage(70);
      text(line, M, y, size, font, color);
      y -= 13;
    }
  };

  breakPage(120);
  rule(M, y + 8);
  if (doc.footerText) {
    paragraph(doc.footerText);
    y -= 6;
  }
  if (doc.notes) {
    paragraph(doc.notes, INK);
    y -= 6;
  }
  if (doc.footerNote) paragraph(doc.footerNote);

  return pdf.save();
}
