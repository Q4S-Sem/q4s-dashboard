import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { maakPakket } from "../src/lib/pakket";

test("twee PDF's worden één pakket met alle pagina's", async () => {
  const maak = async (n: number) => {
    const d = await PDFDocument.create();
    for (let i = 0; i < n; i++) d.addPage();
    return d.save();
  };
  const out = await maakPakket([
    { bytes: await maak(2), type: "application/pdf", naam: "contract.pdf" },
    { bytes: await maak(1), type: "application/pdf", naam: "kvk.pdf" },
  ]);
  assert.equal((await PDFDocument.load(out)).getPageCount(), 3);
  await assert.rejects(maakPakket([{ bytes: new Uint8Array([1]), type: "", naam: "x.docx" }]));
});
