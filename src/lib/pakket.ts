import { PDFDocument } from "pdf-lib";

/**
 * Meerdere bestanden (PDF's en foto's/scans) → één PDF, in de gegeven volgorde.
 * Zo wordt een getekend contract + bijlagen één pakket in het dossier.
 * Foto's komen gecentreerd op een A4. Gooit bij een bestandstype dat niet kan.
 */
export async function maakPakket(bestanden: { bytes: Uint8Array; type: string; naam: string }[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const A4: [number, number] = [595.28, 841.89];
  for (const b of bestanden) {
    const t = `${b.type} ${b.naam}`.toLowerCase();
    if (t.includes("pdf")) {
      const bron = await PDFDocument.load(b.bytes, { ignoreEncryption: true });
      for (const p of await pdf.copyPages(bron, bron.getPageIndices())) pdf.addPage(p);
    } else if (/png/.test(t) || /jpe?g/.test(t)) {
      const img = /png/.test(t) ? await pdf.embedPng(b.bytes) : await pdf.embedJpg(b.bytes);
      const page = pdf.addPage(A4);
      const s = Math.min((A4[0] - 40) / img.width, (A4[1] - 40) / img.height, 1);
      const w = img.width * s, h = img.height * s;
      page.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
    } else {
      throw new Error(`"${b.naam}" kan niet in een pakket — gebruik PDF, JPG of PNG.`);
    }
  }
  return pdf.save();
}
