import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildCvDoc } from "../src/lib/cv-doc";
import { renderCvPdf } from "../src/lib/cv-pdf";

// Worst case: een enorm bron-CV (20 functies × 10 lange bullets, 60 skills, 40 certificaten).
const lang = "Verantwoordelijk voor inspectie, kwaliteitscontrole en rapportage van laswerk volgens ISO 5817 en EN 1090 op grote offshore- en infraprojecten, inclusief NDT-coördinatie.";
const profiel = {
  fullName: "Jan de Vries",
  headline: "Senior QA/QC Inspector",
  location: "Rotterdam",
  availability: "per direct",
  yearsExperience: 25,
  summary: lang.repeat(8),
  anonymize: true,
  skillsJson: JSON.stringify(Array.from({ length: 60 }, (_, i) => `Vaardigheid ${i}`)),
  languagesJson: JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ name: `Taal ${i}`, level: "vloeiend" }))),
  experienceJson: JSON.stringify(
    Array.from({ length: 20 }, (_, i) => ({
      employer: `Werkgever ${i} B.V.`, role: "QA/QC Inspector", period: `${2000 + i} – ${2001 + i}`, location: "Rotterdam",
      bullets: Array.from({ length: 10 }, () => lang + " " + lang),
    })),
  ),
  educationJson: JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ school: `School ${i}`, degree: "MBO 4 Werktuigbouw", period: "1995 – 1999" }))),
  certificatesJson: JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ name: `ISO 9712 NDT niveau ${i}`, issuer: "Lloyd's", year: "2024" }))),
};
const settings = { companyName: "Q4S", email: "admin@q4s.nl", phone: "+31 85 782 6818", website: "q4s.nl" };

test("een enorm CV wordt een Q4S-CV van maximaal 3 pagina's", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = buildCvDoc(profiel as any, settings as any, null);
  const pdf = await PDFDocument.load(await renderCvPdf(doc));
  assert.ok(pdf.getPageCount() <= 3, `${pdf.getPageCount()} pagina's`);
  assert.equal(doc.experience.length, 8);
  assert.equal(doc.experience[0].bullets.length, 4);
  assert.equal(doc.experience[7].bullets.length, 2);
});
