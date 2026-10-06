import { db } from "./db";
import { kostenLabel } from "./kosten";
import { wekenInPeriode } from "./facturatie-volgende";
import { SJABLOON, type Vulling, type Waarde } from "./excel-sjabloon";
import { round2 } from "./utils";

// ---------------------------------------------------------------------------
// Data voor het Q4S-factuuroverzicht (Excel): per jaar of per kwartaal.
// Blad Facturen = één regel per factuur van een freelancer, met onze
// verkoopfactuur (alleen de regels van díe persoon) ernaast. Verkoop zonder
// inkoop (iemand in dienst) krijgt een eigen regel. Blad Kosten = eigen
// bedrijfskosten + goedgekeurde/betaalde declaraties.
// ---------------------------------------------------------------------------

export type Inkoop = {
  consultantId: string;
  naam: string;
  datum: Date;
  nummer: string | null;
  ex: number;
  btw: number;
  betaaldOp: Date | null;
  weken: number[];
};
export type VerkoopDeel = {
  consultantId: string;
  naam: string;
  klant: string;
  nummer: string;
  status: string;
  ex: number;
  btwPct: number;
  datum: Date;
  verstuurdOp: Date | null;
  betaaldOp: Date | null;
  weken: number[];
};
export type FactuurRegel = { inkoop: Inkoop | null; verkoop: VerkoopDeel | null };

/**
 * Koppel elke inkoopfactuur aan het verkoopdeel van dezelfde persoon dat
 * dezelfde week (of een van de weken) dekt. Elk verkoopdeel wordt hooguit
 * één keer gekoppeld; wat overblijft krijgt een eigen regel.
 */
export function koppelFacturen(inkoop: Inkoop[], verkoop: VerkoopDeel[]): FactuurRegel[] {
  const vrij = new Set(verkoop);
  const regels: FactuurRegel[] = inkoop.map((i) => {
    const v = verkoop.find(
      (x) => vrij.has(x) && x.consultantId === i.consultantId && x.weken.some((w) => i.weken.includes(w)),
    );
    if (v) vrij.delete(v);
    return { inkoop: i, verkoop: v ?? null };
  });
  for (const v of vrij) regels.push({ inkoop: null, verkoop: v });
  const datum = (r: FactuurRegel) => (r.inkoop?.datum ?? r.verkoop!.datum).getTime();
  return regels.sort((a, b) => datum(a) - datum(b));
}

const pct = (btw: number, ex: number) => (ex > 0 ? Math.round((btw / ex) * 100) / 100 : 0);
const wekenTekst = (w: number[]) => (w.length ? `week ${[...new Set(w)].sort((a, b) => a - b).join(", ")}` : "");
const isoWeek = (k: string) => Number(k.split("-W")[1]);

export async function factuuroverzicht(jaar: number, kwartaal: number | null): Promise<{ vulling: Vulling; naam: string }> {
  const van = new Date(jaar, kwartaal ? (kwartaal - 1) * 3 : 0, 1);
  const tot = new Date(jaar, kwartaal ? kwartaal * 3 : 12, 1);
  const inPeriode = (d: Date) => d >= van && d < tot;
  // Ruimer ophalen: een verkoopfactuur kan na de inkoop vallen (en andersom).
  const ruimVan = new Date(van.getFullYear(), van.getMonth() - 3, 1);
  const ruimTot = new Date(tot.getFullYear(), tot.getMonth() + 3, 1);

  const [ontvangen, regels, kosten, declaraties] = await Promise.all([
    db.receivedInvoice.findMany({
      where: { status: { not: "REJECTED" }, OR: [{ issueDate: { gte: ruimVan, lt: ruimTot } }, { issueDate: null, createdAt: { gte: ruimVan, lt: ruimTot } }] },
      include: {
        consultant: {
          select: {
            firstName: true,
            lastName: true,
            placements: { orderBy: { startDate: "desc" }, take: 1, select: { client: { select: { companyName: true } } } },
          },
        },
      },
    }),
    db.invoiceLine.findMany({
      where: { invoice: { status: { not: "CANCELLED" }, issueDate: { gte: ruimVan, lt: ruimTot } }, placementId: { not: null } },
      select: {
        amount: true,
        weekNumber: true,
        invoice: {
          select: {
            id: true, number: true, status: true, issueDate: true, sentAt: true, paidDate: true,
            vatRate: true, vatReverseCharge: true, client: { select: { companyName: true } },
          },
        },
        placement: { select: { consultantId: true, consultant: { select: { firstName: true, lastName: true } } } },
      },
    }),
    db.bedrijfsKost.findMany({ where: { date: { gte: van, lt: tot } } }),
    db.expense.findMany({
      where: { status: { in: ["APPROVED", "PAID"] }, OR: [{ date: { gte: van, lt: tot } }, { date: null, createdAt: { gte: van, lt: tot } }] },
      include: { consultant: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const naamVan = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`.trim();
  const inkoop: Inkoop[] = ontvangen.map((r) => {
    const btw = r.vatAmount ?? 0;
    return {
      consultantId: r.consultantId,
      naam: naamVan(r.consultant),
      datum: r.issueDate ?? r.createdAt,
      nummer: r.number,
      ex: round2(r.amount - btw),
      btw,
      betaaldOp: r.status === "PAID" ? (r.paidDate ?? r.updatedAt) : null,
      weken: (r.weekKey ? [r.weekKey] : wekenInPeriode(r.periodStart, r.periodEnd)).map(isoWeek),
    };
  });
  const klantVan = new Map(ontvangen.map((r) => [r.consultantId, r.consultant.placements[0]?.client?.companyName ?? ""]));

  // Verkoop per (factuur, persoon): één factuur kan meer mensen dekken.
  const delen = new Map<string, VerkoopDeel>();
  for (const l of regels) {
    const p = l.placement!;
    const k = `${l.invoice.id}|${p.consultantId}`;
    const d = delen.get(k) ?? {
      consultantId: p.consultantId,
      naam: naamVan(p.consultant),
      klant: l.invoice.client.companyName,
      nummer: l.invoice.number,
      status: l.invoice.status,
      ex: 0,
      btwPct: l.invoice.vatReverseCharge ? 0 : l.invoice.vatRate / 100,
      datum: l.invoice.issueDate,
      verstuurdOp: ["SENT", "PAID"].includes(l.invoice.status) ? (l.invoice.sentAt ?? l.invoice.issueDate) : null,
      betaaldOp: l.invoice.status === "PAID" ? l.invoice.paidDate : null,
      weken: [],
    };
    d.ex = round2(d.ex + l.amount);
    if (l.weekNumber != null) d.weken.push(l.weekNumber);
    delen.set(k, d);
  }

  // Alleen regels die in de periode vallen (op de datum van de inkoop, anders van de verkoop).
  const facturen = koppelFacturen(inkoop, [...delen.values()]).filter((r) =>
    inPeriode(r.inkoop?.datum ?? r.verkoop!.datum),
  );

  const F: Record<string, Waarde> = {};
  // ponytail: meer regels dan het sjabloon heeft (1500/800) vallen weg; sjabloon vergroten als dat ooit gebeurt.
  facturen.slice(0, SJABLOON.facturen).forEach(({ inkoop: i, verkoop: v }, n) => {
    const r = SJABLOON.eersteRij + n;
    const concept = v && !v.verstuurdOp;
    F[`A${r}`] = i?.datum;
    F[`C${r}`] = i?.naam ?? v!.naam;
    F[`D${r}`] = v?.klant ?? klantVan.get(i!.consultantId) ?? "";
    F[`E${r}`] = [wekenTekst(i?.weken.length ? i.weken : (v?.weken ?? [])), concept ? `concept ${v!.nummer}` : ""]
      .filter(Boolean)
      .join(" · ");
    if (i) {
      F[`F${r}`] = i.nummer ?? "";
      F[`G${r}`] = i.ex;
      F[`H${r}`] = pct(i.btw, i.ex);
      F[`I${r}`] = i.btw; // het echte btw-bedrag van de factuur, niet herberekend
      F[`K${r}`] = i.betaaldOp;
    }
    if (v && !concept) {
      F[`L${r}`] = v.nummer;
      F[`M${r}`] = v.ex;
      F[`N${r}`] = v.btwPct;
      F[`Q${r}`] = v.verstuurdOp;
      F[`R${r}`] = v.betaaldOp;
    }
  });

  const K: Record<string, Waarde> = {};
  const kostRegels = [
    ...kosten.map((k) => ({
      datum: k.date, leverancier: k.description || kostenLabel(k.category), oms: "", soort: kostenLabel(k.category),
      ex: k.amount, btw: k.vatAmount, betaald: k.date as Date | null,
    })),
    ...declaraties.map((e) => {
      const btw = e.vatAmount ?? 0;
      return {
        datum: e.date ?? e.createdAt, leverancier: e.vendor || "Declaratie",
        oms: [e.description, e.consultant && `declaratie ${naamVan(e.consultant)}`].filter(Boolean).join(" · "),
        soort: "Declaraties", ex: round2(e.amount - btw), btw, betaald: e.status === "PAID" ? e.updatedAt : null,
      };
    }),
  ].sort((a, b) => a.datum.getTime() - b.datum.getTime());
  kostRegels.slice(0, SJABLOON.kosten).forEach((k, n) => {
    const r = SJABLOON.eersteRij + n;
    Object.assign(K, {
      [`A${r}`]: k.datum, [`C${r}`]: k.leverancier, [`D${r}`]: k.oms, [`E${r}`]: k.soort,
      [`G${r}`]: k.ex, [`H${r}`]: pct(k.btw, k.ex), [`I${r}`]: k.btw, [`K${r}`]: k.betaald,
    });
  });

  const titel = kwartaal ? `Factuuroverzicht Q${kwartaal} ${jaar}` : `Factuuroverzicht ${jaar}`;
  return {
    vulling: { Overzicht: { C1: titel, H4: jaar }, Facturen: F, Kosten: K },
    naam: `Q4S ${titel}.xlsx`,
  };
}
