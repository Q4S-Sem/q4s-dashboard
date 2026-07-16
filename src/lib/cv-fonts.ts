import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { StandardFonts, type PDFDocument, type PDFFont } from "pdf-lib";

/**
 * Lettertypen voor het Q4S-CV.
 *
 * WAAROM NIET DE INGEBOUWDE HELVETICA: die kent alleen WinAnsi (≈ Latin-1). Q4S
 * plaatst veel Poolse en Roemeense vakmensen, en "Michał Wójcik" werd daarmee
 * "Michal Wojcik" — een verkeerde naam op het CV dat naar je klant gaat. Inter
 * (SIL Open Font License, zie public/fonts/Inter-LICENSE.txt) dekt Latin Extended
 * volledig én sluit aan op de typografie van het dashboard zelf.
 *
 * De fonts worden met `subset: true` ingesloten: alleen de gebruikte tekens gaan
 * mee, dus een CV-PDF groeit er slechts enkele tientallen KB's van, niet ~1,2 MB.
 *
 * Ontbreken de bestanden (bv. handmatig verwijderd), dan valt alles terug op
 * Helvetica: het CV wordt dan lelijker en accenten sneuvelen, maar er rolt nog
 * steeds een document uit.
 */

export type CvFonts = {
  regular: PDFFont;
  semibold: PDFFont;
  bold: PDFFont;
  /** True als Inter echt is ingesloten (dus: volledige Unicode-dekking). */
  embedded: boolean;
};

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

function readFont(file: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(FONT_DIR, file));
  } catch {
    return null;
  }
}

export async function loadCvFonts(pdf: PDFDocument): Promise<CvFonts> {
  const regularBytes = readFont("Inter-Regular.ttf");
  const semiboldBytes = readFont("Inter-SemiBold.ttf");
  const boldBytes = readFont("Inter-Bold.ttf");

  if (regularBytes && semiboldBytes && boldBytes) {
    try {
      pdf.registerFontkit(fontkit);
      const [regular, semibold, bold] = await Promise.all([
        pdf.embedFont(regularBytes, { subset: true }),
        pdf.embedFont(semiboldBytes, { subset: true }),
        pdf.embedFont(boldBytes, { subset: true }),
      ]);
      return { regular, semibold, bold, embedded: true };
    } catch {
      // Valt door naar Helvetica hieronder.
    }
  }

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  return { regular, semibold: bold, bold, embedded: false };
}
