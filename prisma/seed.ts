import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { seedCrm } from "./seed-crm";
import { assertDestructiveAllowed } from "./guard";

const db = new PrismaClient();

// Private dossier files live here (mirrors src/lib/uploads.ts).
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// --- small local helpers (kept inline so the seed has no app imports) ---
function startOfISOWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function formatDateNl(d: Date): string {
  return d.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "vacature"
  );
}
/** Mon–Fri entries of `hours` each for the week starting at `monday`. */
function workWeek(monday: Date, hours = 8) {
  return Array.from({ length: 5 }, (_, i) => ({
    date: addDays(monday, i),
    hours,
  }));
}
/** Mon–Fri + a Saturday — to demo weekend hours (toeslag-basis). */
function workWeekWeekend(monday: Date, weekdayHours = 8, saturdayHours = 6) {
  return [
    ...workWeek(monday, weekdayHours),
    { date: addDays(monday, 5), hours: saturdayHours },
  ];
}
/** Write a small placeholder file to disk and create its Document metadata row. */
async function seedDocument(opts: {
  consultantId: string;
  category: string;
  title: string;
  originalName: string;
  body: string;
}) {
  const ext = path.extname(opts.originalName) || ".txt";
  const fileName = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOAD_DIR, opts.consultantId);
  await fs.mkdir(dir, { recursive: true });
  const bytes = Buffer.from(opts.body, "utf8");
  await fs.writeFile(path.join(dir, fileName), bytes);
  await db.document.create({
    data: {
      consultantId: opts.consultantId,
      category: opts.category,
      title: opts.title,
      fileName,
      originalName: opts.originalName,
      mimeType: "text/plain",
      size: bytes.byteLength,
    },
  });
}
function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
/** Build a minimal, valid single-page PDF (ASCII content) with a correct xref. */
function makePdf(lines: string[]): Buffer {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let content = "BT /F1 12 Tf 60 780 Td 16 TL\n";
  for (const ln of lines) content += `(${esc(ln)}) Tj T*\n`;
  content += "ET";
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    `<</Length ${Buffer.byteLength(content, "latin1")}>>\nstream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
/** Write a demo timesheet PDF into the inbox and create its TimesheetInbox row. */
async function seedInbox(opts: {
  source: string;
  status: string;
  pdfLines: string[];
  originalName: string;
  extractedName?: string;
  extractedWeekStart?: Date;
  extractedTotalHours?: number;
  extractedJson?: string;
  aiNotes?: string;
  consultantId?: string;
  placementId?: string;
  senderEmail?: string;
  emailSubject?: string;
}) {
  const dir = path.join(UPLOAD_DIR, "_inbox");
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.pdf`;
  const buf = makePdf(opts.pdfLines);
  await fs.writeFile(path.join(dir, fileName), buf);
  await db.timesheetInbox.create({
    data: {
      source: opts.source,
      status: opts.status,
      fileName,
      originalName: opts.originalName,
      mimeType: "application/pdf",
      size: buf.byteLength,
      extractedName: opts.extractedName ?? null,
      extractedWeekStart: opts.extractedWeekStart ?? null,
      extractedTotalHours: opts.extractedTotalHours ?? null,
      extractedJson: opts.extractedJson ?? null,
      aiNotes: opts.aiNotes ?? null,
      consultantId: opts.consultantId ?? null,
      placementId: opts.placementId ?? null,
      senderEmail: opts.senderEmail ?? null,
      emailSubject: opts.emailSubject ?? null,
      receivedAt: opts.source === "EMAIL" ? new Date() : null,
    },
  });
}

async function main() {
  // Weiger een volledige wipe zodra dit géén lokale database is (zie prisma/guard.ts).
  assertDestructiveAllowed("db:seed (volledige demo-reset)");

  console.log("Seeding Q4S demo data…");

  // Clear (children first).
  await db.calendarEvent.deleteMany();
  await db.task.deleteMany();
  await db.postLink.deleteMany();
  await db.challengeAttempt.deleteMany();
  await db.challenge.deleteMany();
  await db.socialPost.deleteMany();
  await db.vacancyMatch.deleteMany();
  await db.syncRun.deleteMany();
  await db.application.deleteMany();
  await db.candidate.deleteMany();
  await db.targetClient.deleteMany();
  await db.vmsConnector.deleteMany();
  await db.outreachMessage.deleteMany();
  await db.vacancy.deleteMany();
  await db.opportunity.deleteMany();
  await db.timesheetEntry.deleteMany();
  await db.invoiceLine.deleteMany();
  await db.invoice.deleteMany();
  await db.purchaseInvoiceLine.deleteMany();
  await db.purchaseInvoice.deleteMany();
  await db.timesheetInbox.deleteMany();
  await db.timesheet.deleteMany();
  await db.placement.deleteMany();
  // Document & Certificate cascade on consultant delete, but clear explicitly.
  await db.document.deleteMany();
  await db.certificate.deleteMany();
  await db.consultant.deleteMany();
  await db.client.deleteMany();
  await db.numberSequence.deleteMany();
  await db.companySettings.deleteMany();
  // Remove any dossier files left on disk from a previous seed.
  await fs.rm(UPLOAD_DIR, { recursive: true, force: true });

  // Company profile (used on invoices).
  await db.companySettings.create({
    data: {
      id: "default",
      companyName: "Q4S B.V.",
      address: "Lascadelaan 12",
      postalCode: "3045 AS",
      city: "Rotterdam",
      country: "Nederland",
      vatNumber: "NL862345678B01",
      kvkNumber: "87654321",
      iban: "NL12 RABO 0123 4567 89",
      email: "info@q4s.nl",
      phone: "+31 10 123 45 67",
      website: "www.q4s.nl",
      invoicePrefix: "Q4S-",
      defaultVatRate: 21,
      defaultPaymentTermDays: 30,
      invoiceFooter:
        "Q4S B.V. — specialist in QA, QC, lassen, fitters en NDO. Bedankt voor de samenwerking.",
    },
  });

  // Consultants (the placed specialists).
  const [jansen, devries, bakker, smit, hendriks, koster] = await Promise.all([
    db.consultant.create({
      data: {
        firstName: "Jeroen",
        lastName: "Jansen",
        email: "jeroen.jansen@example.nl",
        phone: "+31 6 1111 1111",
        discipline: "NDO",
        employmentType: "ZZP",
        defaultCostRate: 52,
        active: true,
        dateOfBirth: new Date("1986-04-18"),
        nationality: "Nederlandse",
        bsn: "1234.56.789",
        address: "Lasstraat 8",
        postalCode: "3071 AA",
        city: "Rotterdam",
        startDate: addDays(new Date(), -400),
        contractType: "Overeenkomst van opdracht (ZZP)",
        contractStart: addDays(new Date(), -400),
        companyName: "Jansen NDT Inspecties",
        kvkNumber: "90011223",
        vatNumber: "NL004455667B01",
        iban: "NL91 ABNA 0417 1643 00",
        emergencyName: "L. Jansen",
        emergencyPhone: "+31 6 9999 0000",
        certificates: {
          create: [
            {
              name: "NDT UT Level 2 (EN ISO 9712)",
              number: "UT-2-0099",
              issuedDate: addDays(new Date(), -800),
              expiryDate: addDays(new Date(), 420),
            },
            {
              name: "VCA Basis",
              number: "VCA-77123",
              issuedDate: addDays(new Date(), -1000),
              expiryDate: addDays(new Date(), 35),
            },
            {
              name: "Radiografie (RT) certificaat",
              number: "RT-1-0421",
              issuedDate: addDays(new Date(), -1400),
              expiryDate: addDays(new Date(), -20),
            },
          ],
        },
      },
    }),
    db.consultant.create({
      data: { firstName: "Daan", lastName: "de Vries", email: "daan.devries@example.nl", phone: "+31 6 2222 2222", discipline: "LASSEN", employmentType: "ZZP", defaultCostRate: 38, active: true },
    }),
    db.consultant.create({
      data: { firstName: "Bart", lastName: "Bakker", email: "bart.bakker@example.nl", phone: "+31 6 3333 3333", discipline: "QC", employmentType: "LOONDIENST", defaultCostRate: 45, active: true },
    }),
    db.consultant.create({
      data: { firstName: "Sanne", lastName: "Smit", email: "sanne.smit@example.nl", phone: "+31 6 4444 4444", discipline: "QA", employmentType: "ZZP", defaultCostRate: 58, active: true },
    }),
    db.consultant.create({
      data: { firstName: "Hugo", lastName: "Hendriks", email: "hugo.hendriks@example.nl", phone: "+31 6 5555 5555", discipline: "FITTER", employmentType: "UITZEND", defaultCostRate: 34, active: true },
    }),
    db.consultant.create({
      data: { firstName: "Kim", lastName: "Koster", email: "kim.koster@example.nl", phone: "+31 6 6666 6666", discipline: "NDO", employmentType: "ZZP", defaultCostRate: 50, active: false },
    }),
  ]);

  // Clients.
  const [tata, damen, shell] = await Promise.all([
    db.client.create({
      data: { companyName: "Tata Steel IJmuiden B.V.", contactName: "P. Visser", email: "inkoop@tatasteel.example", phone: "+31 251 100 100", address: "Wenckebachstraat 1", postalCode: "1951 JZ", city: "Velsen-Noord", vatNumber: "NL001234567B01", kvkNumber: "34567890", invoiceEmail: "facturen@tatasteel.example", paymentTermDays: 30 },
    }),
    db.client.create({
      data: { companyName: "Damen Shipyards Gorinchem", contactName: "M. de Groot", email: "inkoop@damen.example", phone: "+31 183 200 200", address: "Avelingen-West 20", postalCode: "4202 MS", city: "Gorinchem", vatNumber: "NL009876543B01", kvkNumber: "23456789", invoiceEmail: "ap@damen.example", paymentTermDays: 45 },
    }),
    db.client.create({
      data: { companyName: "Shell Pernis", contactName: "R. Mulder", email: "contracting@shell.example", phone: "+31 10 300 300", address: "Vondelingenweg 601", postalCode: "3196 KK", city: "Rotterdam", vatNumber: "NL005566778B01", kvkNumber: "12345678", paymentTermDays: 30 },
    }),
  ]);

  // Placements (with the margins Q4S applies).
  const pNdtTata = await db.placement.create({
    data: { consultantId: jansen.id, clientId: tata.id, title: "NDT Inspector Level 2 (UT/RT)", startDate: addDays(new Date(), -120), costRate: 52, chargeRate: 82, status: "ACTIVE", notes: "Project hoogoven 7." },
  });
  const pWeldDamen = await db.placement.create({
    data: { consultantId: devries.id, clientId: damen.id, title: "Lasser 6G (TIG/MIG)", startDate: addDays(new Date(), -90), costRate: 38, chargeRate: 58, status: "ACTIVE", weekendSurchargeBuy: 35, weekendSurchargeSell: 50, overtimeSurchargeBuy: 15, overtimeSurchargeSell: 25, kmRateBuy: 0.23, kmRateSell: 0.3 },
  });
  const pQcShell = await db.placement.create({
    data: { consultantId: bakker.id, clientId: shell.id, title: "QC Inspector / Coating", startDate: addDays(new Date(), -60), costRate: 45, chargeRate: 68, status: "ACTIVE" },
  });
  await db.placement.create({
    data: { consultantId: smit.id, clientId: tata.id, title: "QA Engineer", startDate: addDays(new Date(), -45), costRate: 58, chargeRate: 89, status: "ACTIVE" },
  });
  await db.placement.create({
    data: { consultantId: hendriks.id, clientId: damen.id, title: "Pijpfitter", startDate: addDays(new Date(), -30), costRate: 34, chargeRate: 52, status: "ACTIVE" },
  });

  const thisMonday = startOfISOWeek(new Date());
  const wk = (n: number) => addDays(thisMonday, -7 * n);

  // NDT @ Tata: 3 weeks — one invoiced, one approved, one submitted.
  const tsInvoiced = await db.timesheet.create({
    data: { placementId: pNdtTata.id, weekStart: wk(3), status: "INVOICED", entries: { create: workWeek(wk(3), 8) } },
  });
  const tsNdtApproved = await db.timesheet.create({
    data: { placementId: pNdtTata.id, weekStart: wk(2), status: "APPROVED", entries: { create: workWeek(wk(2), 8) } },
  });
  await db.timesheet.create({
    data: { placementId: pNdtTata.id, weekStart: wk(1), status: "SUBMITTED", entries: { create: workWeek(wk(1), 8) } },
  });

  // Welder @ Damen — incl. weekend, overuren en kilometers (toeslag-demo).
  await db.timesheet.create({
    data: {
      placementId: pWeldDamen.id,
      weekStart: wk(2),
      status: "APPROVED",
      kilometers: 320,
      overtimeHours: 4,
      entries: { create: workWeekWeekend(wk(2), 8.5, 6) },
    },
  });
  await db.timesheet.create({
    data: { placementId: pWeldDamen.id, weekStart: wk(1), status: "DRAFT", entries: { create: workWeek(wk(1), 8) } },
  });

  // QC @ Shell.
  await db.timesheet.create({
    data: { placementId: pQcShell.id, weekStart: wk(1), status: "APPROVED", entries: { create: workWeek(wk(1), 8) } },
  });

  // One real invoice generated from the invoiced NDT timesheet.
  const year = new Date().getFullYear();
  const hours = 40;
  const unitPrice = pNdtTata.chargeRate; // 82
  const amount = round2(hours * unitPrice); // 3280
  const subtotal = amount;
  const vatRate = 21;
  const vatAmount = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vatAmount);

  await db.numberSequence.create({ data: { key: `invoice-${year}`, value: 1 } });
  await db.invoice.create({
    data: {
      number: `Q4S-${year}-0001`,
      clientId: tata.id,
      issueDate: addDays(new Date(), -10),
      dueDate: addDays(new Date(), 20),
      status: "SENT",
      vatRate,
      subtotal,
      vatAmount,
      total,
      lines: {
        create: [
          {
            description: `Jeroen Jansen — NDT Inspector Level 2 (UT/RT) — week (${hours} u)`,
            quantity: hours,
            unitPrice,
            amount,
            placementId: pNdtTata.id,
            timesheetId: tsInvoiced.id,
          },
        ],
      },
    },
  });

  // --- Purchase (self-billing) invoice demo for the approved NDT week ---
  const pHours = 40;
  const pCost = pNdtTata.costRate; // 52
  const pSubtotal = round2(pHours * pCost);
  const pVat = round2((pSubtotal * 21) / 100);
  const pTotal = round2(pSubtotal + pVat);
  await db.numberSequence.create({ data: { key: `purchase-invoice-${year}`, value: 1 } });
  await db.purchaseInvoice.create({
    data: {
      number: `INK-${year}-0001`,
      consultantId: jansen.id,
      issueDate: addDays(new Date(), -8),
      dueDate: addDays(new Date(), 6),
      status: "APPROVED",
      vatRate: 21,
      subtotal: pSubtotal,
      vatAmount: pVat,
      total: pTotal,
      lines: {
        create: [
          {
            description: `${pNdtTata.title} — voorgaande week (${pHours} u)`,
            quantity: pHours,
            unitPrice: pCost,
            amount: pSubtotal,
            placementId: pNdtTata.id,
            timesheetId: tsNdtApproved.id,
          },
        ],
      },
    },
  });

  // --- Timesheet inbox demo (incoming PDFs via admin@q4s.nl) ---
  const inboxWeek = startOfISOWeek(addDays(new Date(), -7));
  const inboxDays = Array.from({ length: 5 }, (_, i) => ({
    date: toISO(addDays(inboxWeek, i)),
    hours: 8,
  }));
  await seedInbox({
    source: "EMAIL",
    status: "EXTRACTED",
    originalName: "weekstaat-daan-de-vries.pdf",
    pdfLines: [
      "Q4S - Weekstaat",
      "Naam: Daan de Vries",
      `Week vanaf: ${toISO(inboxWeek)}`,
      "Ma 8  Di 8  Wo 8  Do 8  Vr 8",
      "Totaal: 40 uur",
      "Project: Damen Shipyards Gorinchem",
    ],
    extractedName: "Daan de Vries",
    extractedWeekStart: inboxWeek,
    extractedTotalHours: 40,
    extractedJson: JSON.stringify({
      name: "Daan de Vries",
      weekStartDate: toISO(inboxWeek),
      weekNumber: "",
      year: String(inboxWeek.getFullYear()),
      days: inboxDays,
      totalHours: 40,
      project: "Damen Shipyards Gorinchem",
      notes: "",
    }),
    consultantId: devries.id,
    placementId: pWeldDamen.id,
    senderEmail: "daan.devries@example.nl",
    emailSubject: "Weekstaat",
  });
  await seedInbox({
    source: "UPLOAD",
    status: "NEW",
    originalName: "urenbriefje-scan.pdf",
    pdfLines: [
      "Urenbriefje",
      "Naam: ......................",
      "Week: ......",
      "Ma .. Di .. Wo .. Do .. Vr ..",
      "Totaal: .... uur",
    ],
  });

  // --- Data & Mappen: dossier documents (real files on disk) ---
  await seedDocument({
    consultantId: jansen.id,
    category: "CONTRACT",
    title: "Overeenkomst van opdracht 2026",
    originalName: "overeenkomst-van-opdracht-2026.txt",
    body: `OVEREENKOMST VAN OPDRACHT (ZZP)\n\nOpdrachtgever: Q4S B.V., Rotterdam\nOpdrachtnemer: Jansen NDT Inspecties (Jeroen Jansen)\nFunctie: NDT Inspector Level 2 (UT/RT)\nTarief: € 52,- per uur (excl. btw)\nIngangsdatum: ${formatDateNl(addDays(new Date(), -400))}\n\nDit is een voorbeelddocument voor de demo-omgeving van het Q4S Dashboard.\n`,
  });
  await seedDocument({
    consultantId: jansen.id,
    category: "ID",
    title: "Identiteitsbewijs (kopie)",
    originalName: "paspoort-kopie.txt",
    body: `IDENTITEITSBEWIJS — KOPIE\n\nNaam: Jeroen Jansen\nDocumenttype: Paspoort\nNationaliteit: Nederlandse\n\n(Voorbeelddocument — demo-omgeving Q4S Dashboard.)\n`,
  });
  await seedDocument({
    consultantId: jansen.id,
    category: "CERTIFICAAT",
    title: "NDT UT Level 2 — certificaat",
    originalName: "ndt-ut-level-2.txt",
    body: `CERTIFICAAT\n\nNDT Ultrasoon (UT) Level 2 — EN ISO 9712\nCertificaatnummer: UT-2-0099\nHouder: Jeroen Jansen\n\n(Voorbeelddocument — demo-omgeving Q4S Dashboard.)\n`,
  });
  await seedDocument({
    consultantId: devries.id,
    category: "CERTIFICAAT",
    title: "Lascertificaat 6G (TIG/MIG)",
    originalName: "lascertificaat-6g.txt",
    body: `LASCERTIFICAAT\n\nProces: TIG / MIG\nPositie: 6G\nHouder: Daan de Vries\n\n(Voorbeelddocument — demo-omgeving Q4S Dashboard.)\n`,
  });
  await seedDocument({
    consultantId: devries.id,
    category: "OVERIG",
    title: "VCA-pasje",
    originalName: "vca-pasje.txt",
    body: `VCA BASIS — PASJE\n\nHouder: Daan de Vries\nGeldig t/m: ${formatDateNl(addDays(new Date(), 300))}\n\n(Voorbeelddocument — demo-omgeving Q4S Dashboard.)\n`,
  });
  await seedDocument({
    consultantId: bakker.id,
    category: "CV",
    title: "CV — Bart Bakker",
    originalName: "cv-bart-bakker.txt",
    body: `CURRICULUM VITAE\n\nNaam: Bart Bakker\nDiscipline: QC — Quality Control\nErvaring: QC Inspector / Coating, petrochemie en scheepsbouw.\nCertificaten: VCA, coating inspector.\n\n(Voorbeelddocument — demo-omgeving Q4S Dashboard.)\n`,
  });

  // --- Recruitment hub: vacancies ---
  await db.vacancy.create({
    data: {
      title: "NDT Inspecteur Level 2 (UT/PA)",
      discipline: "NDO",
      location: "Rotterdam",
      employmentType: "Fulltime",
      salary: "€ 3.500 – € 4.800 p/m",
      clientId: tata.id,
      rawText:
        "Gezocht NDT inspecteur lvl 2, UT en PA, ervaring petrochemie, VCA, fulltime, regio Rijnmond. Start z.s.m.",
      status: "CONCEPT",
      slug: "ndt-inspecteur-level-2-utpa-demo01",
    },
  });
  const lasserVacancy = await db.vacancy.create({
    data: {
      title: "Senior Lasser 6G (TIG/MIG)",
      discipline: "LASSEN",
      location: "Gorinchem",
      employmentType: "Fulltime",
      salary: "€ 3.200 – € 4.200 p/m",
      clientId: damen.id,
      rawText:
        "Ervaren 6G lasser TIG/MIG voor scheepsbouw, certificaten gewenst, fulltime.",
      summary:
        "Voor een toonaangevende scheepswerf zoekt Q4S een gecertificeerde 6G-lasser (TIG/MIG) die topkwaliteit levert.",
      improvedText:
        "Functieomschrijving\nAls Senior Lasser 6G werk je aan hoogwaardige scheepsbouwprojecten...\n\nWat je gaat doen\n- TIG- en MIG-lassen in alle posities (6G)\n- Werken volgens lasprocedures en kwaliteitsnormen\n\nWat we vragen\n- Geldige lascertificaten\n- Ervaring in scheepsbouw of zware metaal\n\nWat we bieden\n- Marktconform salaris\n- Langdurige opdracht via Q4S",
      linkedinPost:
        "🔧 Wij zoeken een Senior Lasser 6G (TIG/MIG) voor een topwerf in Gorinchem! Gecertificeerd en klaar voor een mooie uitdaging? Reageer of tag iemand. #lassen #scheepsbouw #vacature #Q4S",
      status: "PUBLISHED",
      slug: "senior-lasser-6g-tigmig-demo02",
      publishedAt: addDays(new Date(), -3),
    },
  });

  // --- Recruitment hub: outreach ---
  await db.outreachMessage.create({
    data: {
      recipientName: "Mark Visser",
      recipientHeadline: "NDT Inspector Level II bij InspectaCorp",
      company: "InspectaCorp",
      channel: "LINKEDIN",
      context:
        "Tegengekomen op LinkedIn, sterke UT/PA achtergrond. Past op de NDT-opdracht bij Tata Steel.",
      status: "DRAFT",
    },
  });

  // --- Socials hub: social posts ---
  await db.socialPost.create({
    data: {
      title: "Lasser 6G — Gorinchem (live)",
      platform: "LINKEDIN",
      topic: "Nieuwe gepubliceerde vacature voor een topwerf in Gorinchem.",
      hashtags: "#lassen #scheepsbouw #vacature #Q4S",
      status: "PUBLISHED",
      vacancyId: lasserVacancy.id,
      content:
        "🔧 Wij zoeken een Senior Lasser 6G (TIG/MIG) voor een toonaangevende werf in Gorinchem!\n\nGecertificeerd, oog voor kwaliteit en klaar voor een mooie langdurige opdracht via Q4S? Dan komen we graag met je in contact.\n\nReageer hieronder of tag iemand die past. 👷\n\n#lassen #scheepsbouw #vacature #Q4S",
      publishedAt: addDays(new Date(), -2),
    },
  });
  await db.socialPost.create({
    data: {
      title: "Offshore wind — NDT-inspecteurs gezocht",
      platform: "LINKEDIN",
      topic: "Groeiende vraag naar NDT-inspecteurs voor offshore windprojecten.",
      hashtags: "#NDT #offshorewind #techniek #Q4S",
      content:
        "🌊 Offshore wind groeit hard — en daarmee de vraag naar gecertificeerde NDT-inspecteurs.\n\nWerk jij in UT, RT of PA en wil je aan de slag op toonaangevende offshore windprojecten? Q4S koppelt jou aan de mooiste opdrachten in de Noordzee.\n\nStuur een bericht of tag iemand die past. ⚙️\n\n#NDT #offshorewind #techniek #Q4S",
      status: "SCHEDULED",
      scheduledFor: addDays(new Date(), 3),
    },
  });
  await db.socialPost.create({
    data: {
      title: "Werken bij Q4S — recruitmentcampagne",
      platform: "INSTAGRAM",
      topic:
        "Employer branding: laten zien hoe het is om via Q4S in de techniek te werken.",
      status: "DRAFT",
    },
  });

  // --- Analyses hub: opportunities ---
  await db.opportunity.createMany({
    data: [
      {
        title: "Offshore wind — NDT & inspectie",
        sector: "NDO",
        region: "Noord-Holland / Noordzee",
        description:
          "Groeiende vraag naar NDT-inspecteurs voor monopiles, lassen en onderhoud van offshore windparken.",
        rationale:
          "Sterke groei offshore wind in NL; schaarste aan gecertificeerde NDT-specialisten sluit aan op Q4S' kernexpertise.",
        potential: "HOOG",
        targetCompanies: "Sif Group\nSmulders\nVan Oord",
        status: "EXPLORING",
        source: "AI",
      },
      {
        title: "Petrochemie turnarounds — QC & lassen",
        sector: "QC",
        region: "Rotterdam (Botlek/Pernis)",
        description:
          "Geplande turnarounds bij raffinaderijen vragen om pieken aan QC-inspecteurs en lassers.",
        rationale:
          "Voorspelbare, terugkerende vraag met hoge marges; Q4S heeft al een voet tussen de deur bij Shell Pernis.",
        potential: "HOOG",
        targetCompanies: "Shell\nBP\nExxonMobil",
        status: "PURSUING",
        source: "AI",
      },
      {
        title: "Fitters voor modulaire bouw",
        sector: "FITTER",
        region: "Nederland",
        description:
          "Toenemende prefab/modulaire bouw vraagt om pijp- en constructiefitters.",
        rationale:
          "Verbreedt de inzetbaarheid van fitters buiten de traditionele industrie.",
        potential: "MIDDEL",
        targetCompanies: "Heijmans\nVolkerWessels",
        status: "NEW",
        source: "MANUAL",
      },
    ],
  });

  // --- Recruitment hub: VMS connectors ---
  const connectorData = [
    { name: "Magnit", key: "magnit", priority: 5, status: "MANUAL", website: "https://www.magnitglobal.com" },
    { name: "SAP Fieldglass", key: "sap-fieldglass", priority: 5, status: "MANUAL", website: "https://www.fieldglass.com" },
    { name: "Beeline VMS", key: "beeline", priority: 4, status: "NOT_CONNECTED", website: "https://www.beeline.com" },
    { name: "Inhuurdesk Rijk", key: "inhuurdesk-rijk", priority: 5, status: "MANUAL" },
    { name: "Mercell", key: "mercell", priority: 4, status: "NOT_CONNECTED", website: "https://www.mercell.com" },
    { name: "TenderNed", key: "tenderned", priority: 4, status: "NOT_CONNECTED", website: "https://www.tenderned.nl" },
    { name: "FlexOord", key: "flexoord", priority: 4, status: "NOT_CONNECTED" },
  ];
  const connectors: Record<string, string> = {};
  for (const c of connectorData) {
    const created = await db.vmsConnector.create({ data: c });
    connectors[c.key] = created.id;
  }

  // --- Recruitment hub: target opdrachtgevers (acquisitie-roadmap) ---
  const targetData: {
    name: string;
    priority: number;
    vms: string | null;
    sector: string;
  }[] = [
    { name: "TenneT", priority: 5, vms: "magnit", sector: "Hoogspanning / E&I" },
    { name: "Rijkswaterstaat", priority: 5, vms: "inhuurdesk-rijk", sector: "Civiel / Infra" },
    { name: "Royal IHC", priority: 5, vms: null, sector: "Maritiem / Offshore" },
    { name: "Stedin", priority: 5, vms: "magnit", sector: "Netbeheer / E&I" },
    { name: "Alliander", priority: 5, vms: "beeline", sector: "Netbeheer / E&I" },
    { name: "Enexis", priority: 5, vms: "beeline", sector: "Netbeheer / E&I" },
    { name: "Gasunie", priority: 5, vms: null, sector: "Energie-infra" },
    { name: "ProRail", priority: 5, vms: null, sector: "Rail / Infra" },
    { name: "Royal BAM Group", priority: 5, vms: "magnit", sector: "Bouw / Infra" },
    { name: "Boskalis", priority: 5, vms: null, sector: "Maritiem / Offshore" },
    { name: "Van Oord", priority: 5, vms: "flexoord", sector: "Maritiem / Offshore" },
    { name: "Heijmans", priority: 4, vms: null, sector: "Bouw / Infra" },
    { name: "VolkerWessels", priority: 4, vms: null, sector: "Bouw / Infra" },
    { name: "Dura Vermeer", priority: 4, vms: null, sector: "Bouw / Infra" },
    { name: "Ballast Nedam", priority: 4, vms: null, sector: "Bouw / Infra" },
    { name: "Vattenfall", priority: 4, vms: "sap-fieldglass", sector: "Energie" },
    { name: "Eneco", priority: 4, vms: null, sector: "Energie" },
    { name: "Shell", priority: 4, vms: "sap-fieldglass", sector: "Olie & Gas" },
    { name: "NAM", priority: 4, vms: "sap-fieldglass", sector: "Olie & Gas" },
    { name: "Equans", priority: 4, vms: null, sector: "Techniek / Installatie" },
  ];
  for (const t of targetData) {
    await db.targetClient.create({
      data: {
        name: t.name,
        priority: t.priority,
        sector: t.sector,
        status: "PROSPECT",
        vmsConnectorId: t.vms ? connectors[t.vms] : null,
      },
    });
  }

  // All manually-seeded vacancies are within the Q4S niche.
  await db.vacancy.updateMany({ data: { relevance: "RELEVANT" } });

  // Raw, unjudged VMS vacancies for the Vacaturehub to AI-filter & publish.
  const rawVacancies = [
    {
      title: "QC Inspector Offshore Wind",
      discipline: "QC",
      location: "Eemshaven",
      connector: "magnit",
      rawText:
        "Voor een offshore windproject zoeken wij een QC Inspector met ervaring in lasinspectie, coating-inspectie en documentcontrole. Offshore-ervaring en VCA vereist. Start z.s.m., locatie Eemshaven en op zee.",
    },
    {
      title: "HSE Adviseur Infraproject",
      discipline: null,
      location: "Utrecht",
      connector: "inhuurdesk-rijk",
      rawText:
        "Gezocht: ervaren HSE-adviseur voor een groot infraproject. Je bewaakt veiligheid op de bouwplaats, voert toolboxen uit en houdt toezicht op naleving van de regels. VCA-VOL en ervaring in de GWW vereist.",
    },
    {
      title: "Commissioning Engineer E&I",
      discipline: null,
      location: "Rotterdam",
      connector: "beeline",
      rawText:
        "Voor een industrieel project in de Botlek zoeken wij een Commissioning Engineer E&I. Je verzorgt de inbedrijfstelling van elektro- en instrumentatie-installaties en stelt commissioning-pakketten op.",
    },
    {
      title: "Administratief medewerker backoffice",
      discipline: null,
      location: "Amsterdam",
      connector: "mercell",
      rawText:
        "Voor onze backoffice zoeken wij een administratief medewerker voor het verwerken van orders, facturen en e-mail. MBO werk- en denkniveau, accuraat en klantvriendelijk.",
    },
  ];
  for (const rv of rawVacancies) {
    await db.vacancy.create({
      data: {
        title: rv.title,
        discipline: rv.discipline,
        location: rv.location,
        rawText: rv.rawText,
        source: "VMS",
        vmsConnectorId: connectors[rv.connector],
        status: "CONCEPT",
        relevance: "UNKNOWN",
        slug: `${slugify(rv.title)}-${randomUUID().slice(0, 6)}`,
      },
    });
  }

  // --- Recruitment hub: demo candidates + applications ---
  const cand1 = await db.candidate.create({
    data: {
      firstName: "Pieter",
      lastName: "van Dijk",
      email: "pieter.vandijk@example.nl",
      phone: "+31 6 1212 3434",
      discipline: "LASSEN",
      headline: "Senior lasser 6G (TIG/MIG)",
      location: "Gorinchem",
      source: "WEBSITE",
      availability: "BESCHIKBAAR",
    },
  });
  const cand2 = await db.candidate.create({
    data: {
      firstName: "Mehmet",
      lastName: "Yildiz",
      email: "mehmet.yildiz@example.nl",
      phone: "+31 6 5656 7878",
      discipline: "NDO",
      headline: "NDT Inspector Level 2 (UT/RT)",
      location: "Rotterdam",
      source: "MANUAL",
      availability: "BINNENKORT",
      availableFrom: addDays(new Date(), 21),
    },
  });
  await db.application.create({
    data: {
      candidateId: cand1.id,
      vacancyId: lasserVacancy.id,
      status: "SCREENING",
      motivation: "Ervaren 6G-lasser, direct beschikbaar voor de werf in Gorinchem.",
    },
  });
  await db.application.create({
    data: {
      candidateId: cand2.id,
      status: "NEW",
      motivation: "Op zoek naar NDT-opdrachten in de regio Rijnmond.",
    },
  });

  // --- Socials hub: Talentpool members (signed up via a social post) ---
  const pool1 = await db.candidate.create({
    data: {
      firstName: "Ramon",
      lastName: "Visser",
      email: "ramon.visser@example.nl",
      phone: "+31 6 4040 5050",
      discipline: "LASSEN",
      headline: "6G lasser TIG/MIG — 8 jaar scheepsbouw",
      location: "Gorinchem",
      source: "TALENTPOOL",
      sourceDetail: "lasser6g",
      availability: "BESCHIKBAAR",
      notes: "Aangemeld via Talentpool — bron: lasser6g",
    },
  });
  await db.candidate.create({
    data: {
      firstName: "Aylin",
      lastName: "Demir",
      email: "aylin.demir@example.nl",
      phone: "+31 6 7070 8080",
      discipline: "QC",
      headline: "QC Inspector — coating & lasinspectie",
      location: "Rotterdam",
      source: "TALENTPOOL",
      sourceDetail: "ndtoffshore",
      availability: "NIET_BESCHIKBAAR",
      notes: "Aangemeld via Talentpool — bron: ndtoffshore",
    },
  });

  // Tracked links (phase-2 attribution) with demo click counts.
  await db.postLink.createMany({
    data: [
      {
        token: "lasser6g",
        label: "LinkedIn — lasser-campagne",
        channel: "LINKEDIN",
        destination: "/talentpool",
        clicks: 128,
        lastClickAt: addDays(new Date(), -1),
      },
      {
        token: "ndtoffshore",
        label: "Instagram — NDT offshore",
        channel: "INSTAGRAM",
        destination: "/talentpool",
        clicks: 64,
        lastClickAt: addDays(new Date(), -2),
      },
      {
        token: "hsecampagne",
        label: "Facebook — HSE-veiligheid",
        channel: "FACEBOOK",
        destination: "/talentpool",
        clicks: 22,
        lastClickAt: addDays(new Date(), -3),
      },
      {
        token: "wa-pool",
        label: "WhatsApp — talentpool-broadcast",
        channel: "WHATSAPP",
        destination: "/talentpool",
        clicks: 40,
        lastClickAt: addDays(new Date(), -1),
      },
    ],
  });

  // A talentpool member placed via the lasser-campagne — drives the funnel demo
  // (click -> signup -> placement) on /socials/talentpool.
  await db.application.create({
    data: {
      candidateId: pool1.id,
      vacancyId: lasserVacancy.id,
      status: "PLACED",
      motivation: "Geplaatst via de Talentpool.",
    },
  });

  // --- Socials hub: Vakproef (skills challenges) ---
  const vakproef1 = await db.challenge.create({
    data: {
      slug: "herken-de-lasfout-demo01",
      title: "Herken de lasfout",
      discipline: "LASSEN",
      question:
        "Op een röntgenfoto van een stomplas zie je een scherpe, donkere lijn precies in het midden van de las, evenwijdig aan de lasnaad. Wat is dit hoogstwaarschijnlijk?",
      optionsJson: JSON.stringify([
        "Onvolledige doorlassing (incomplete penetration)",
        "Poreusheid",
        "Bindingsfout (lack of fusion) langs de flank",
        "Een onschuldige oppervlaktekras",
      ]),
      correctIndex: 0,
      explanation:
        "Een scherpe donkere lijn midden in de las, in de lasrichting, wijst op onvolledige doorlassing: de wortel is niet volledig doorgelast.",
      status: "ACTIVE",
    },
  });
  await db.challenge.create({
    data: {
      slug: "besloten-ruimte-demo02",
      title: "Veilig de tank in (VCA)",
      discipline: null,
      question:
        "Je gaat een besloten ruimte (opslagtank) in voor een inspectie. Wat regel je als eerste?",
      optionsJson: JSON.stringify([
        "Meteen naar binnen, het is maar even",
        "Gasmeting (laten) uitvoeren én een mangatwacht regelen",
        "Alleen een stoffilter opzetten",
      ]),
      correctIndex: 1,
      explanation:
        "Bij een besloten ruimte geldt altijd: eerst een gasmeting plus een mangatwacht buiten. Veiligheid eerst.",
      status: "DRAFT",
    },
  });

  // A few demo deelnemers on the active vakproef (each becomes a Talentpool lead).
  const vpAttempts: [string, string, number][] = [
    ["Tim", "Bakker", 0],
    ["Joost", "Pol", 2],
    ["Wesley", "Kok", 0],
  ];
  for (const [fn, ln, idx] of vpAttempts) {
    const cand = await db.candidate.create({
      data: {
        firstName: fn,
        lastName: ln,
        discipline: "LASSEN",
        source: "TALENTPOOL",
        sourceDetail: "vakproef:herken-de-lasfout-demo01",
        notes: 'Aangemeld via Vakproef "Herken de lasfout"',
      },
    });
    await db.challengeAttempt.create({
      data: {
        challengeId: vakproef1.id,
        candidateId: cand.id,
        chosenIndex: idx,
        correct: idx === 0,
      },
    });
  }

  // --- Recruitment hub: a demo CV-match + a completed sourcing run ---
  await db.vacancyMatch.create({
    data: {
      vacancyId: lasserVacancy.id,
      candidateId: cand1.id,
      score: 0.8,
      reason: "zelfde discipline (LASSEN)",
    },
  });
  // A talentpool member auto-matched to a relevant vacancy.
  await db.vacancyMatch.create({
    data: {
      vacancyId: lasserVacancy.id,
      candidateId: pool1.id,
      score: 0.8,
      reason: "zelfde discipline (LASSEN)",
    },
  });
  await db.syncRun.create({
    data: {
      trigger: "CRON",
      status: "DONE",
      sourced: 2,
      filtered: 4,
      relevant: 3,
      matched: 1,
      startedAt: addDays(new Date(), -1),
      finishedAt: addDays(new Date(), -1),
    },
  });

  // --- Agenda hub: calendar events + tasks ---
  const at = (days: number, h = 9, m = 0): Date => {
    const d = addDays(new Date(), days);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const tennet = await db.targetClient.findFirst({ where: { name: "TenneT" } });

  await db.calendarEvent.createMany({
    data: [
      {
        title: "Kennismaking inkoop Tata Steel",
        type: "MEETING",
        start: at(1, 10, 0),
        end: at(1, 11, 0),
        location: "Velsen-Noord",
        notes:
          "Bespreken raamovereenkomst NDT-inzet 2026. Tarieven en doorlooptijd afstemmen.",
        status: "PLANNED",
        clientId: tata.id,
      },
      {
        title: "Belafspraak kandidaat — Mehmet Yildiz (NDT)",
        type: "CALL",
        start: at(0, 14, 30),
        end: at(0, 15, 0),
        notes: "Beschikbaarheid en tarief bespreken voor opdracht regio Rijnmond.",
        status: "PLANNED",
        candidateId: cand2.id,
      },
      {
        title: "Bedrijfsbezoek TenneT",
        type: "VISIT",
        start: at(3, 13, 0),
        end: at(3, 15, 0),
        location: "Arnhem",
        notes: "Acquisitiegesprek — inhuur via Magnit toelichten.",
        status: "PLANNED",
        targetClientId: tennet?.id ?? null,
      },
      {
        title: "Sollicitatiegesprek — Pieter van Dijk (Lasser 6G)",
        type: "INTERVIEW",
        start: at(2, 11, 0),
        end: at(2, 12, 0),
        location: "Kantoor Rotterdam",
        status: "PLANNED",
        candidateId: cand1.id,
        vacancyId: lasserVacancy.id,
      },
      {
        title: "Deadline aanmelding offshore-wind tender",
        type: "REMINDER",
        start: at(5),
        allDay: true,
        status: "PLANNED",
      },
      {
        title: "Wekelijkse timesheets controleren",
        type: "REMINDER",
        start: at(-2, 9, 0),
        status: "DONE",
      },
    ],
  });

  await db.task.createMany({
    data: [
      {
        title: "Offerte Tata Steel opvolgen",
        priority: "HIGH",
        dueDate: at(2, 0, 0),
        clientId: tata.id,
      },
      {
        title: "VCA-certificaat Jeroen Jansen verlengt binnenkort — actie",
        priority: "HIGH",
        dueDate: at(10, 0, 0),
      },
      {
        title: "Nieuwe NDT-kandidaat bellen",
        priority: "MEDIUM",
      },
      {
        title: "LinkedIn-vacaturepost inplannen",
        priority: "LOW",
        dueDate: at(-1, 0, 0),
      },
      {
        title: "Contract Daan de Vries laten tekenen",
        priority: "MEDIUM",
        done: true,
        doneAt: addDays(new Date(), -2),
      },
    ],
  });

  // --- CRM hub: recruiters, pipeline, contacts, deals + notitieblok ---
  await seedCrm(db);

  console.log("Done. Demo data seeded ✓");
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
