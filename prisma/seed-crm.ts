import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";

// CRM demo seed — recruiters, the pipeline, contacts, deals and a rich
// notitieblok so the inzichten/weak-points come alive. Idempotent: recruiters
// and stages upsert; the demo deals only seed when there are none yet.
// Runs from prisma/seed.ts (on db:reset) and standalone via `tsx prisma/seed-crm.ts`.

function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

const RECRUITERS = [
  { name: "Sem", email: "semdesnoo@q4s.nl", role: "ADMIN", jobTitle: "Eigenaar / Recruitment" },
  { name: "Gjil", email: "gjil.dejong@q4s.nl", role: "GEBRUIKER", jobTitle: "Recruiter" },
  { name: "Simon", email: "simon.vanhouten@q4s.nl", role: "GEBRUIKER", jobTitle: "Recruiter" },
  { name: "Paul", email: "paul.boomsma@q4s.nl", role: "GEBRUIKER", jobTitle: "Accountmanager" },
];

const DEFAULT_STAGES = [
  { key: "lead", name: "Lead", color: "slate", order: 0, probability: 10, isWon: false, isLost: false },
  { key: "qualified", name: "Gekwalificeerd", color: "blue", order: 1, probability: 25, isWon: false, isLost: false },
  { key: "proposed", name: "Kandidaat voorgesteld", color: "violet", order: 2, probability: 50, isWon: false, isLost: false },
  { key: "interview", name: "Gesprek / interview", color: "amber", order: 3, probability: 70, isWon: false, isLost: false },
  { key: "won", name: "Geplaatst", color: "green", order: 4, probability: 100, isWon: true, isLost: false },
  { key: "lost", name: "Verloren", color: "red", order: 5, probability: 0, isWon: false, isLost: true },
];

export async function seedCrm(db: PrismaClient): Promise<void> {
  // 1) Recruiters (app-users) — upsert by e-mail so we never duplicate.
  const users: Record<string, string> = {};
  for (const r of RECRUITERS) {
    const u = await db.appUser.upsert({
      where: { email: r.email },
      update: { jobTitle: r.jobTitle },
      create: { name: r.name, email: r.email, role: r.role, jobTitle: r.jobTitle, passwordHash: hashPassword("Q4S2026!") },
    });
    users[r.name] = u.id;
  }

  // 2) Pipeline stages — create the default set if none exist.
  if ((await db.crmStage.count()) === 0) {
    for (const s of DEFAULT_STAGES) await db.crmStage.create({ data: s });
  }
  const stages = await db.crmStage.findMany();
  const stageId = (key: string) => stages.find((s) => s.key === key)?.id ?? stages[0].id;
  const stageProb = (key: string) => stages.find((s) => s.key === key)?.probability ?? 0;

  // Only seed demo deals/contacts once.
  if ((await db.deal.count()) > 0) {
    console.log("CRM: recruiters/stages ensured (demo deals already present) ✓");
    return;
  }

  const now = new Date();
  const at = (days: number, h = 10): Date => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(h, 0, 0, 0);
    return d;
  };

  const targets = await db.targetClient.findMany();
  const targetId = (name: string) => targets.find((t) => t.name === name)?.id ?? null;
  const vacancies = await db.vacancy.findMany({ take: 60 });
  const vacId = (frag: string) => vacancies.find((v) => v.title.toLowerCase().includes(frag.toLowerCase()))?.id ?? null;

  // 3) Contacts (contactpersonen bij opdrachtgevers).
  const contacts: Record<string, string> = {};
  const contactData = [
    { key: "tennet", firstName: "Erik", lastName: "Bakker", jobTitle: "Inkoper Inhuur", company: "TenneT", email: "erik.bakker@tennet.example", phone: "+31 6 2000 1001", owner: "Simon", target: "TenneT" },
    { key: "boskalis", firstName: "Nadia", lastName: "El Amrani", jobTitle: "HR Business Partner", company: "Boskalis", email: "nadia@boskalis.example", phone: "+31 6 2000 1002", owner: "Paul", target: "Boskalis" },
    { key: "tata", firstName: "Johan", lastName: "Prins", jobTitle: "Maintenance Manager", company: "Tata Steel", email: "j.prins@tatasteel.example", phone: "+31 6 2000 1003", owner: "Gjil", target: null },
    { key: "shell", firstName: "Petra", lastName: "Visser", jobTitle: "Category Lead", company: "Shell", email: "petra.visser@shell.example", phone: "+31 6 2000 1004", owner: "Paul", target: "Shell" },
  ];
  for (const c of contactData) {
    const created = await db.crmContact.create({
      data: {
        firstName: c.firstName,
        lastName: c.lastName,
        jobTitle: c.jobTitle,
        company: c.company,
        email: c.email,
        phone: c.phone,
        ownerId: users[c.owner],
        targetClientId: c.target ? targetId(c.target) : null,
      },
    });
    contacts[c.key] = created.id;
  }

  // A contact-level follow-up (shows up in the Opvolging-lijst).
  await db.crmNote.create({
    data: {
      contactId: contacts["tata"],
      authorId: users["Gjil"],
      type: "CALL",
      body: "Gebeld met Johan — Tata wil Q2 opschalen met NDT. Terugbellen na intern overleg.",
      sentiment: "POSITIVE",
      followUpAt: at(1, 9),
    },
  });

  // 4) Deals across stages/owners + notitieblok.
  type NoteSeed = { type: string; body: string; sentiment?: string; daysAgo: number; pinned?: boolean };
  async function makeDeal(d: {
    title: string;
    company: string;
    discipline?: string;
    owner: string;
    stage: string;
    status?: string;
    value: number;
    positions?: number;
    fitScore?: number;
    source?: string;
    target?: string | null;
    vacancyFrag?: string | null;
    contactKey?: string | null;
    createdDaysAgo?: number;
    nextFollowUpDays?: number | null;
    lostReason?: string | null;
    closedDaysAgo?: number | null;
    notes?: NoteSeed[];
  }) {
    const created = await db.deal.create({
      data: {
        title: d.title,
        company: d.company,
        discipline: d.discipline ?? null,
        ownerId: users[d.owner],
        stageId: stageId(d.stage),
        status: d.status ?? "OPEN",
        value: d.value,
        positions: d.positions ?? 1,
        fitScore: d.fitScore ?? 0,
        probability: stageProb(d.stage),
        source: d.source ?? "MANUAL",
        targetClientId: d.target ? targetId(d.target) : null,
        vacancyId: d.vacancyFrag ? vacId(d.vacancyFrag) : null,
        primaryContactId: d.contactKey ? contacts[d.contactKey] : null,
        createdAt: d.createdDaysAgo ? at(-d.createdDaysAgo, 9) : now,
        nextFollowUpAt: d.nextFollowUpDays === null || d.nextFollowUpDays === undefined ? null : at(d.nextFollowUpDays, 9),
        lostReason: d.lostReason ?? null,
        closedAt: d.closedDaysAgo != null ? at(-d.closedDaysAgo, 15) : null,
      },
    });
    for (const n of d.notes ?? []) {
      await db.crmNote.create({
        data: {
          dealId: created.id,
          authorId: users[d.owner],
          type: n.type,
          body: n.body,
          sentiment: n.sentiment ?? null,
          pinned: n.pinned ?? false,
          createdAt: at(-n.daysAgo, 11),
        },
      });
    }
    return created;
  }

  await makeDeal({
    title: "3× Lasser 6G — Tata Steel",
    company: "Tata Steel",
    discipline: "LASSEN",
    owner: "Gjil",
    stage: "proposed",
    value: 45000,
    positions: 3,
    fitScore: 4,
    source: "REFERRAL",
    contactKey: "tata",
    vacancyFrag: "lasser",
    createdDaysAgo: 12,
    nextFollowUpDays: -3, // over tijd
    notes: [
      { type: "CALL", body: "Intake met Johan (Maintenance). 3 lassers 6G nodig voor turnaround, start over 4 weken.", sentiment: "POSITIVE", daysAgo: 10, pinned: true },
      { type: "EMAIL", body: "Twee cv's gestuurd (Pieter van Dijk + 1). Wachten op reactie.", sentiment: "NEUTRAL", daysAgo: 6 },
    ],
  });

  await makeDeal({
    title: "NDT Inspector L2 — TenneT",
    company: "TenneT",
    discipline: "NDO",
    owner: "Simon",
    stage: "interview",
    value: 32000,
    fitScore: 5,
    source: "VMS",
    target: "TenneT",
    contactKey: "tennet",
    createdDaysAgo: 9,
    nextFollowUpDays: 0, // vandaag
    notes: [
      { type: "MEETING", body: "Gesprek gepland tussen Mehmet en de projectleider TenneT (via Magnit).", sentiment: "POSITIVE", daysAgo: 2 },
    ],
  });

  await makeDeal({
    title: "QC Inspector — Boskalis",
    company: "Boskalis",
    discipline: "QC",
    owner: "Paul",
    stage: "qualified",
    value: 28000,
    fitScore: 3,
    source: "OUTREACH",
    target: "Boskalis",
    contactKey: "boskalis",
    createdDaysAgo: 6,
    nextFollowUpDays: 2,
    notes: [{ type: "LINKEDIN", body: "Nadia gereageerd op InMail, wil profielen zien voor offshore QC.", sentiment: "NEUTRAL", daysAgo: 3 }],
  });

  await makeDeal({
    title: "HSE Adviseur — Rijkswaterstaat",
    company: "Rijkswaterstaat",
    owner: "Gjil",
    stage: "lead",
    value: 20000,
    fitScore: 2,
    source: "VMS",
    target: "Rijkswaterstaat",
    vacancyFrag: "hse",
    createdDaysAgo: 20, // oud + geen notities (zwak punt: geen contact)
    nextFollowUpDays: null,
  });

  await makeDeal({
    title: "Pijpfitter — Van Oord",
    company: "Van Oord",
    discipline: "FITTER",
    owner: "Simon",
    stage: "lead",
    value: 15000,
    fitScore: 3,
    source: "MANUAL",
    target: "Van Oord",
    createdDaysAgo: 30, // vastgelopen: laatste activiteit 28 dagen terug
    nextFollowUpDays: null,
    notes: [{ type: "NOTE", body: "Aangemaakt na tip; nog geen ingang bij Van Oord gevonden.", daysAgo: 28 }],
  });

  await makeDeal({
    title: "2× Coating Inspector — Shell",
    company: "Shell",
    discipline: "QC",
    owner: "Paul",
    stage: "proposed",
    value: 38000,
    positions: 2,
    fitScore: 4,
    source: "VMS",
    target: "Shell",
    contactKey: "shell",
    createdDaysAgo: 14,
    nextFollowUpDays: 4,
    notes: [
      { type: "CALL", body: "Petra kritisch op tarief, vindt ons 8% te duur t.o.v. concurrent.", sentiment: "NEGATIVE", daysAgo: 3 },
    ],
  });

  // Won + lost (voeden winkans, verliesredenen en de leaderboard).
  await makeDeal({
    title: "Lasser — Heijmans",
    company: "Heijmans",
    discipline: "LASSEN",
    owner: "Gjil",
    stage: "won",
    status: "WON",
    value: 22000,
    fitScore: 4,
    createdDaysAgo: 25,
    closedDaysAgo: 5,
    notes: [{ type: "SYSTEM", body: "Deal gewonnen 🎉 — kandidaat geplaatst, start volgende maand.", sentiment: "POSITIVE", daysAgo: 5 }],
  });

  await makeDeal({
    title: "NDT Inspector — Stedin",
    company: "Stedin",
    discipline: "NDO",
    owner: "Simon",
    stage: "won",
    status: "WON",
    value: 26000,
    fitScore: 5,
    target: "Stedin",
    createdDaysAgo: 22,
    closedDaysAgo: 3,
    notes: [{ type: "SYSTEM", body: "Geplaatst via Magnit. Mooie marge.", sentiment: "POSITIVE", daysAgo: 3 }],
  });

  await makeDeal({
    title: "QA Engineer — Equans",
    company: "Equans",
    discipline: "QA",
    owner: "Simon",
    stage: "lost",
    status: "LOST",
    value: 30000,
    fitScore: 3,
    target: "Equans",
    createdDaysAgo: 18,
    closedDaysAgo: 8,
    lostReason: "Prijs te hoog",
    notes: [{ type: "SYSTEM", body: "Deal verloren — reden: prijs te hoog. Klant koos goedkopere partij.", sentiment: "NEGATIVE", daysAgo: 8 }],
  });

  await makeDeal({
    title: "Inspector — Enexis",
    company: "Enexis",
    discipline: "QC",
    owner: "Paul",
    stage: "lost",
    status: "LOST",
    value: 18000,
    fitScore: 2,
    target: "Enexis",
    createdDaysAgo: 16,
    closedDaysAgo: 6,
    lostReason: "Prijs te hoog",
    notes: [{ type: "NOTE", body: "Wederom op prijs verloren. Patroon: onze tarieven liggen te hoog bij netbeheerders.", sentiment: "NEGATIVE", daysAgo: 6 }],
  });

  // 5) Personal CRM settings voor één recruiter (per-recruiter voorbeeld).
  await db.crmSettings.upsert({
    where: { userId: users["Gjil"] },
    update: {},
    create: {
      userId: users["Gjil"],
      defaultScope: "mine",
      targetDealsPerMonth: 8,
      targetPlacementsPerMonth: 3,
      targetRevenuePerMonth: 40000,
      staleAfterDays: 14,
      accent: "brand",
    },
  });

  console.log("CRM: recruiters, pipeline, contacts, deals + notitieblok seeded ✓");
}

// Standalone runner: `tsx prisma/seed-crm.ts` (seeds CRM into the current db).
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("prisma/seed-crm.ts")) {
  const db = new PrismaClient();
  seedCrm(db)
    .then(() => db.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await db.$disconnect();
      process.exit(1);
    });
}
