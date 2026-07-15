/**
 * Voorbeelddata voor "Ontvangen facturen" (/ontvangen-facturen).
 *
 * Vult de bestaande database AAN (wist niets van je eigen data) met een paar
 * inkomende facturen van geplaatste ZZP'ers, verspreid over dit jaar. De bedragen
 * worden berekend uit hun eigen timesheets (uren × inkooptarief), zodat de meeste
 * exact "Klopt" tonen en een paar bewust "Afwijken" — plus een btw-verlegd (0%)
 * geval en een betaalde. Zo zie je de controle-tegen-timesheet meteen werken.
 *
 * Herhaalbaar: eerst wordt de eigen voorbeeldset opgeruimd, daarna opnieuw gemaakt.
 *
 *   npx tsx prisma/seed-ontvangen.ts   (of: npm run db:seed-ontvangen)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const round2 = (n: number) => Math.round(n * 100) / 100;
const DEMO_MARK = "[demo-ontvangen]";
const YEAR = new Date().getFullYear();
// Spreid de factuurdatums over het jaar voor een "heel jaar"-beeld.
const MONTHS = [0, 2, 3, 5, 7, 8, 10, 11];

async function main() {
  // 1) Ruim de vorige voorbeeldset op (herkenbaar aan de notitie-marker).
  const removed = await db.receivedInvoice.deleteMany({ where: { notes: { contains: DEMO_MARK } } });
  if (removed.count) console.log(`Opgeruimd: ${removed.count} vorige voorbeeld(en).`);

  const settings = await db.companySettings.findUnique({ where: { id: "default" } });
  const vatRate = settings?.defaultVatRate ?? 21;

  // 2) Timesheets van geplaatste mensen, alleen op plaatsingen ZONDER toeslagen
  //    (dan is inkoop exact uren × inkooptarief → een "Klopt" wordt echt exact).
  const timesheets = await db.timesheet.findMany({
    where: { status: { not: "DRAFT" } },
    include: { entries: true, placement: { include: { consultant: true } } },
    orderBy: { weekStart: "asc" },
  });

  type Group = {
    consultantId: string;
    name: string;
    subtotal: number;
    hours: number;
    minWeek: Date;
    maxWeek: Date;
  };
  const groups = new Map<string, Group>();
  for (const t of timesheets) {
    const p = t.placement;
    if (p.weekendSurchargeBuy || p.overtimeSurchargeBuy || p.kmRateBuy) continue; // exacte match
    const hours = t.entries.reduce((s, e) => s + e.hours, 0);
    if (hours <= 0) continue;
    const cost = hours * p.costRate;
    let g = groups.get(p.consultantId);
    if (!g) {
      g = {
        consultantId: p.consultantId,
        name: `${p.consultant.firstName} ${p.consultant.lastName}`,
        subtotal: 0,
        hours: 0,
        minWeek: t.weekStart,
        maxWeek: t.weekStart,
      };
      groups.set(p.consultantId, g);
    }
    g.subtotal = round2(g.subtotal + cost);
    g.hours = round2(g.hours + hours);
    if (t.weekStart < g.minWeek) g.minWeek = t.weekStart;
    if (t.weekStart > g.maxWeek) g.maxWeek = t.weekStart;
  }

  const list = [...groups.values()].filter((g) => g.subtotal > 0).slice(0, 8);
  if (list.length === 0) {
    console.log("Geen geschikte timesheets gevonden — draai eerst npm run db:seed-facturatie.");
    return;
  }

  // 3) Maak per persoon één factuur, wisselend scenario.
  let i = 0;
  for (const g of list) {
    const subtotal = round2(g.subtotal);
    const vat = round2((subtotal * vatRate) / 100);
    const total = round2(subtotal + vat);
    const issueDate = new Date(YEAR, MONTHS[i % MONTHS.length], 12);
    const number = `ZZP-${YEAR}-${String(101 + i).padStart(3, "0")}`;
    const scenario = i % 4;

    let amount = total;
    let vatAmount: number | null = vat;
    let status = "NEW";
    let note = "klopt met timesheet";
    if (scenario === 1) {
      // Bewuste afwijking: te veel gefactureerd → rode "Afwijking".
      amount = round2(total + 180);
      vatAmount = null;
      note = "wijkt af — extra uren geclaimd?";
    } else if (scenario === 2) {
      // BTW verlegd (0%): bedrag = subtotaal ex btw → moet toch "Klopt" tonen.
      amount = subtotal;
      vatAmount = 0;
      note = "btw verlegd (0%)";
    } else if (scenario === 3) {
      status = "PAID";
      note = "betaald";
    }

    await db.receivedInvoice.create({
      data: {
        consultantId: g.consultantId,
        number,
        issueDate,
        periodStart: g.minWeek,
        periodEnd: g.maxWeek,
        amount,
        vatAmount,
        status,
        notes: `${DEMO_MARK} ${note}`,
      },
    });
    console.log(
      `+ ${number}  ${g.name.padEnd(22)} €${amount.toFixed(2).padStart(10)}  (verwacht €${total.toFixed(2)})  ${note}`,
    );
    i++;
  }
  console.log(`\n${list.length} voorbeeld ontvangen facturen aangemaakt.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
