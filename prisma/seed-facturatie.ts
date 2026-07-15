/**
 * Testdata voor "Facturatie verwerken" (/verwerken).
 *
 * Vult de bestaande database AAN (wist niets van je eigen data) met een flinke
 * set medewerkers + actieve plaatsingen (met inkoop- en verkooptarief) en
 * GOEDGEKEURDE (APPROVED) weekstaten die nog niet gefactureerd zijn. Daardoor
 * verschijnt elke persoon op /verwerken met "te factureren" (verkoop) én
 * "te betalen" (inkoop), klaar om met één klik te verwerken.
 *
 * Herhaalbaar: eerst wordt de eigen testset (herkenbaar aan de e-maildomein en
 * de klantnamen) opgeruimd, daarna opnieuw aangemaakt.
 *
 *   npx tsx prisma/seed-facturatie.ts     (of: npm run db:seed-facturatie)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// --- datum/uren-helpers (lokale maandag, zoals de app) ----------------------
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
/** Ma–vr, `hours` per dag. */
function workWeek(monday: Date, hours = 8) {
  return Array.from({ length: 5 }, (_, i) => ({ date: addDays(monday, i), hours }));
}
/** Ma–vr `weekdayHours` + zaterdag `saturdayHours` (voor weekend-toeslag). */
function workWeekWeekend(monday: Date, weekdayHours = 8, saturdayHours = 6) {
  return [...workWeek(monday, weekdayHours), { date: addDays(monday, 5), hours: saturdayHours }];
}

const CLIENTS = [
  { companyName: "Q4S Demo — Boskalis", contactName: "R. Terpstra", email: "planning@boskalis-demo.nl", paymentTermDays: 30 },
  { companyName: "Q4S Demo — Heerema", contactName: "M. van Dijk", email: "inkoop@heerema-demo.nl", paymentTermDays: 45 },
  { companyName: "Q4S Demo — Sif Group", contactName: "J. Bakhuis", email: "projecten@sif-demo.nl", paymentTermDays: 30 },
  { companyName: "Q4S Demo — Huisman", contactName: "S. de Wit", email: "facilitair@huisman-demo.nl", paymentTermDays: 30 },
];

type WeekSpec = {
  n: number; // weken geleden (maandag)
  status: "APPROVED" | "SUBMITTED";
  hours?: number;
  weekend?: boolean;
  saturdayHours?: number;
  overtime?: number;
  km?: number;
};

type Person = {
  firstName: string;
  lastName: string;
  discipline: string;
  email: string;
  cost: number; // inkooptarief (€/u)
  charge: number; // verkooptarief (€/u)
  clientIdx: number;
  title: string;
  toeslag?: boolean;
  weeks: WeekSpec[];
};

const PEOPLE: Person[] = [
  { firstName: "Ruben", lastName: "Willems", discipline: "LASSEN", email: "ruben.willems@verwerken-demo.nl", cost: 40, charge: 68, clientIdx: 0, title: "6G TIG/MIG lasser", weeks: [ { n: 1, status: "APPROVED" }, { n: 2, status: "APPROVED" } ] },
  { firstName: "Nadia", lastName: "El Amrani", discipline: "QC", email: "nadia.elamrani@verwerken-demo.nl", cost: 45, charge: 78, clientIdx: 1, title: "QC Inspector", weeks: [ { n: 1, status: "APPROVED" }, { n: 2, status: "APPROVED" }, { n: 0, status: "SUBMITTED" } ] },
  { firstName: "Tomas", lastName: "Novak", discipline: "FITTER", email: "tomas.novak@verwerken-demo.nl", cost: 38, charge: 62, clientIdx: 2, title: "Pijpfitter", weeks: [ { n: 1, status: "APPROVED" } ] },
  { firstName: "Lisa", lastName: "Vermeer", discipline: "NDO", email: "lisa.vermeer@verwerken-demo.nl", cost: 50, charge: 85, clientIdx: 3, title: "NDT Inspector Level 2 (UT/RT)", weeks: [ { n: 1, status: "APPROVED" }, { n: 3, status: "APPROVED" } ] },
  { firstName: "Youssef", lastName: "Baars", discipline: "LASSEN", email: "youssef.baars@verwerken-demo.nl", cost: 42, charge: 70, clientIdx: 0, title: "Lasser + weekenddienst", toeslag: true, weeks: [ { n: 1, status: "APPROVED", weekend: true, saturdayHours: 6, overtime: 5, km: 280 } ] },
  { firstName: "Marijn", lastName: "de Wit", discipline: "QA", email: "marijn.dewit@verwerken-demo.nl", cost: 55, charge: 92, clientIdx: 1, title: "QA Engineer", weeks: [ { n: 1, status: "APPROVED" }, { n: 2, status: "APPROVED" } ] },
  { firstName: "Sven", lastName: "Kramer", discipline: "FITTER", email: "sven.kramer@verwerken-demo.nl", cost: 39, charge: 64, clientIdx: 2, title: "Constructiebankwerker", weeks: [ { n: 2, status: "APPROVED" }, { n: 1, status: "SUBMITTED" } ] },
  { firstName: "Farah", lastName: "Haddad", discipline: "QC", email: "farah.haddad@verwerken-demo.nl", cost: 46, charge: 79, clientIdx: 3, title: "QC Coördinator", weeks: [ { n: 1, status: "APPROVED" } ] },
  { firstName: "Bram", lastName: "Postma", discipline: "LASSEN", email: "bram.postma@verwerken-demo.nl", cost: 41, charge: 69, clientIdx: 0, title: "Orbitaal lasser", weeks: [ { n: 1, status: "APPROVED" }, { n: 2, status: "APPROVED" }, { n: 3, status: "APPROVED" } ] },
  { firstName: "Iris", lastName: "Groot", discipline: "NDO", email: "iris.groot@verwerken-demo.nl", cost: 52, charge: 88, clientIdx: 1, title: "NDT Level 2 (PT/MT)", weeks: [ { n: 1, status: "APPROVED" } ] },
  { firstName: "Kevin", lastName: "Smulders", discipline: "FITTER", email: "kevin.smulders@verwerken-demo.nl", cost: 37, charge: 60, clientIdx: 2, title: "Bankwerker/fitter", weeks: [ { n: 1, status: "APPROVED" }, { n: 2, status: "APPROVED" } ] },
  { firstName: "Anouk", lastName: "Prins", discipline: "QA", email: "anouk.prins@verwerken-demo.nl", cost: 58, charge: 96, clientIdx: 3, title: "Lead QA / VGWM", weeks: [ { n: 1, status: "APPROVED" }, { n: 2, status: "SUBMITTED" } ] },
];

async function main() {
  const testEmails = PEOPLE.map((p) => p.email);
  const testClientNames = CLIENTS.map((c) => c.companyName);

  // Opruimen (herhaalbaar) — alleen de eigen testset.
  await db.timesheetEntry.deleteMany({
    where: { timesheet: { placement: { consultant: { email: { in: testEmails } } } } },
  });
  await db.timesheet.deleteMany({
    where: { placement: { consultant: { email: { in: testEmails } } } },
  });
  await db.placement.deleteMany({ where: { consultant: { email: { in: testEmails } } } });
  await db.consultant.deleteMany({ where: { email: { in: testEmails } } });
  await db.client.deleteMany({ where: { companyName: { in: testClientNames } } });

  // Klanten.
  const clients = [];
  for (const c of CLIENTS) clients.push(await db.client.create({ data: c }));

  const thisMonday = startOfISOWeek(new Date());
  const wk = (n: number) => addDays(thisMonday, -7 * n);

  let timesheets = 0;
  for (const p of PEOPLE) {
    const consultant = await db.consultant.create({
      data: {
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        discipline: p.discipline,
        employmentType: "ZZP",
        defaultCostRate: p.cost,
        active: true,
      },
    });
    const placement = await db.placement.create({
      data: {
        consultantId: consultant.id,
        clientId: clients[p.clientIdx].id,
        title: p.title,
        startDate: addDays(new Date(), -150),
        costRate: p.cost,
        chargeRate: p.charge,
        status: "ACTIVE",
        ...(p.toeslag
          ? {
              weekendSurchargeBuy: 35,
              weekendSurchargeSell: 50,
              overtimeSurchargeBuy: 15,
              overtimeSurchargeSell: 25,
              kmRateBuy: 0.23,
              kmRateSell: 0.3,
            }
          : {}),
      },
    });
    for (const w of p.weeks) {
      const entries = w.weekend
        ? workWeekWeekend(wk(w.n), w.hours ?? 8, w.saturdayHours ?? 6)
        : workWeek(wk(w.n), w.hours ?? 8);
      await db.timesheet.create({
        data: {
          placementId: placement.id,
          weekStart: wk(w.n),
          status: w.status,
          ...(w.km ? { kilometers: w.km } : {}),
          ...(w.overtime ? { overtimeHours: w.overtime } : {}),
          entries: { create: entries },
        },
      });
      timesheets++;
    }
  }

  const approved = PEOPLE.reduce((s, p) => s + p.weeks.filter((w) => w.status === "APPROVED").length, 0);
  const submitted = PEOPLE.reduce((s, p) => s + p.weeks.filter((w) => w.status === "SUBMITTED").length, 0);
  console.log(
    `✔ Testdata voor /verwerken: ${PEOPLE.length} medewerkers, ${clients.length} klanten, ${timesheets} weekstaten ` +
      `(${approved} goedgekeurd → te factureren/betalen, ${submitted} ter goedkeuring).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
