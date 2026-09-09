import { db } from "./db";
import { round2, formatWeekLabel } from "./utils";
import { computeTimesheetMoney, type SideBreakdown } from "./toeslag";
import { createSalesInvoice } from "./invoicing";

// Shared money math + aggregations for the Facturatie hub: the guided per-person
// flow (/verwerken), the overview (/totaaloverzicht) and the dashboard.
// Single source of truth so every screen shows the same numbers. Per-timesheet
// money (incl. weekend/overuren toeslagen + km) lives in src/lib/toeslag.ts, so
// the wizard preview always equals the generated invoice.

// ---------------------------------------------------------------------------
// 1) Guided flow — per-consultant pending work
// ---------------------------------------------------------------------------

export type FlowWeek = {
  timesheetId: string;
  weekStart: Date;
  status: string;
  placementId: string;
  placementTitle: string;
  clientId: string | null; // null = plaatsing zonder gekoppeld bedrijf (niet te factureren)
  clientName: string;
  hours: number; // reguliere (dag)uren — basis voor het uurbedrag
  workedHours: number; // totaal gewerkt = reguliere uren + overuren (weergave)
  overtimeHours: number;
  kilometers: number; // km driven that week (reiskosten)
  costRate: number;
  chargeRate: number;
  cost: number; // inkoop-totaal incl. toeslagen + km (ex BTW)
  charge: number; // verkoop-totaal incl. toeslagen + km (ex BTW)
  sell: SideBreakdown; // verkoop opgesplitst: base / weekend / overtime / km
  buy: SideBreakdown; // inkoop opgesplitst
  margin: number; // charge - cost
  hasPurchase: boolean; // already on a purchase (inkoop) invoice
  hasSales: boolean; // already on a sales (verkoop) invoice
  noInkoop: boolean; // loondienst/eigen personeel → salaris i.p.v. inkoopfactuur
  source: string | null; // UPLOAD | EMAIL | null (manual)
};

/** Timesheets that still need work: submitted (needs approval), approved (needs
 *  invoicing), or sales-done-but-purchase-missing. Excludes fully-invoiced. */
function pendingWhere() {
  return {
    status: { in: ["SUBMITTED" as const, "APPROVED" as const] },
  };
}

function toFlowWeek(t: {
  id: string;
  weekStart: Date;
  status: string;
  placementId: string;
  overtimeHours: number | null;
  kilometers: number | null;
  entries: { date: Date; hours: number }[];
  placement: {
    title: string;
    clientId: string | null;
    costRate: number;
    chargeRate: number;
    weekendSurchargeBuy: number;
    weekendSurchargeSell: number;
    overtimeSurchargeBuy: number;
    overtimeSurchargeSell: number;
    overtimeCostRate: number | null;
    overtimeChargeRate: number | null;
    kmRateBuy: number;
    kmRateSell: number;
    // De zes losse toeslagen (doordeweeks/za/zo/offshore/ploeg/buitenland) —
    // dezelfde velden waar invoicing.ts de factuurregels mee bouwt.
    weekdaySurchargeBuy: number;
    weekdaySurchargeSell: number;
    weekdaySurchargeUnit: string;
    saturdaySurchargeBuy: number;
    saturdaySurchargeSell: number;
    saturdaySurchargeUnit: string;
    sundaySurchargeBuy: number;
    sundaySurchargeSell: number;
    sundaySurchargeUnit: string;
    offshoreEnabled: boolean;
    offshoreSurchargeBuy: number;
    offshoreSurchargeSell: number;
    offshoreSurchargeUnit: string;
    shiftEnabled: boolean;
    shiftSurchargeBuy: number;
    shiftSurchargeSell: number;
    shiftSurchargeUnit: string;
    abroadEnabled: boolean;
    abroadSurchargeBuy: number;
    abroadSurchargeSell: number;
    abroadSurchargeUnit: string;
    client: { companyName: string } | null;
    consultant: { employmentType: string };
  };
  invoiceLine: { id: string } | null;
  purchaseLine: { id: string } | null;
  inbox: { source: string } | null;
}): FlowWeek {
  // charge/cost include weekend/overuren toeslagen + km, exactly as invoiced.
  const money = computeTimesheetMoney(
    { entries: t.entries, overtimeHours: t.overtimeHours, kilometers: t.kilometers },
    t.placement,
  );
  return {
    timesheetId: t.id,
    weekStart: t.weekStart,
    status: t.status,
    placementId: t.placementId,
    placementTitle: t.placement.title,
    clientId: t.placement.clientId,
    clientName: t.placement.client?.companyName ?? "— geen bedrijf",
    hours: money.hours,
    workedHours: money.workedHours,
    overtimeHours: money.overtimeHours,
    kilometers: money.kilometers,
    costRate: t.placement.costRate,
    chargeRate: t.placement.chargeRate,
    cost: money.buy.total,
    charge: money.sell.total,
    sell: money.sell,
    buy: money.buy,
    margin: money.margin,
    hasPurchase: !!t.purchaseLine,
    hasSales: !!t.invoiceLine,
    noInkoop: t.placement.consultant.employmentType === "LOONDIENST",
    source: t.inbox?.source ?? null,
  };
}

const flowInclude = {
  entries: true,
  placement: {
    include: {
      client: { select: { companyName: true } },
      consultant: { select: { employmentType: true } },
    },
  },
  invoiceLine: { select: { id: true } },
  purchaseLine: { select: { id: true } },
  inbox: { select: { source: true } },
} as const;

export type ConsultantPending = {
  consultantId: string;
  name: string;
  discipline: string | null;
  weeks: number;
  hours: number;
  needApproval: number;
  teFactureren: number; // sales not yet generated (ex BTW)
  teBetalen: number; // purchase not yet generated (ex BTW)
};

/** One row per consultant who has pending work, for the /verwerken landing. */
export async function pendingWorkByConsultant(): Promise<ConsultantPending[]> {
  const timesheets = await db.timesheet.findMany({
    where: pendingWhere(),
    include: {
      ...flowInclude,
      placement: {
        include: {
          client: { select: { companyName: true } },
          consultant: { select: { id: true, firstName: true, lastName: true, discipline: true, employmentType: true } },
        },
      },
    },
    orderBy: { weekStart: "asc" },
  });

  const byConsultant = new Map<string, ConsultantPending & { _c: { firstName: string; lastName: string } }>();
  for (const t of timesheets) {
    const c = t.placement.consultant;
    const w = toFlowWeek(t);
    let row = byConsultant.get(c.id);
    if (!row) {
      row = {
        consultantId: c.id,
        name: `${c.firstName} ${c.lastName}`,
        discipline: c.discipline,
        weeks: 0,
        hours: 0,
        needApproval: 0,
        teFactureren: 0,
        teBetalen: 0,
        _c: c,
      };
      byConsultant.set(c.id, row);
    }
    row.weeks += 1;
    row.hours = round2(row.hours + w.workedHours); // incl. overuren, voor de weergave
    if (w.status === "SUBMITTED") row.needApproval += 1;
    // Sales pending = APPROVED and not yet on a sales invoice.
    if (w.status === "APPROVED" && !w.hasSales) row.teFactureren = round2(row.teFactureren + w.charge);
    // Verwachte kosten blijven zichtbaar voor margecontrole. De betaling loopt
    // uitsluitend via de ontvangen freelancerfactuur (ReceivedInvoice).
    if (!w.noInkoop && w.status === "APPROVED") row.teBetalen = round2(row.teBetalen + w.cost);
  }

  return [...byConsultant.values()]
    .map((row) => ({
      consultantId: row.consultantId,
      name: row.name,
      discipline: row.discipline,
      weeks: row.weeks,
      hours: row.hours,
      needApproval: row.needApproval,
      teFactureren: row.teFactureren,
      teBetalen: row.teBetalen,
    }))
    .sort((a, b) => b.teFactureren + b.teBetalen - (a.teFactureren + a.teBetalen));
}

/**
 * Live counts for the sidebar "shopping-cart" badges: medewerkers with pending
 * work, and freshly-created (DRAFT) sales / purchase invoices awaiting handling.
 */
export async function getNavBadges(): Promise<{
  verwerken: number;
  facturen: number;
  inkoop: number;
  ontvangen: number;
  verzenden: number;
  teDoen: number;
}> {
  const [pending, facturen, ontvangen, verzendSales, teDoen] =
    await Promise.all([
      db.timesheet.findMany({
        where: pendingWhere(),
        select: { placement: { select: { consultantId: true } } },
      }),
      // Open sales invoices (concept/klaargezet/verzonden, niet betaald of geannuleerd).
      db.invoice.count({ where: { status: { in: ["DRAFT", "READY", "SENT"] } } }),
      // Inkomende ZZP-facturen die nog niet betaald zijn.
      db.receivedInvoice.count({ where: { status: { not: "PAID" } } }),
      // Verzendmap: uitsluitend vrijgegeven verkoopfacturen (READY) voor klanten.
      db.invoice.count({ where: { status: "READY" } }),
      // Te-late open taken (chatter/automatisering) — de "Te doen"-badge.
      db.activity.count({ where: { kind: "TODO", done: false, dueAt: { lt: new Date() } } }),
    ]);
  const verwerken = new Set(pending.map((t) => t.placement.consultantId)).size;
  return { verwerken, facturen, inkoop: 0, ontvangen, verzenden: verzendSales, teDoen };
}

export type SalesGroup = {
  clientId: string;
  clientName: string;
  timesheetIds: string[];
  hours: number;
  charge: number;
  cost: number;
  margin: number;
};

export type ConsultantFlow = {
  consultant: { id: string; firstName: string; lastName: string; discipline: string | null };
  weeks: FlowWeek[];
  needApprovalIds: string[];
  inkoopPendingIds: string[]; // purchase not yet generated
  inkoopTotals: { hours: number; cost: number };
  verkoopByClient: SalesGroup[]; // sales not yet generated, grouped per client
  ownStaff: boolean; // loondienst/eigen personeel → geen inkoopfactuur (loon)
  done: boolean; // nothing left to invoice
};

/** Everything the wizard needs for one consultant, derived from the DB. */
export async function consultantFlow(consultantId: string): Promise<ConsultantFlow | null> {
  const consultant = await db.consultant.findUnique({
    where: { id: consultantId },
    select: { id: true, firstName: true, lastName: true, discipline: true, employmentType: true },
  });
  if (!consultant) return null;
  const ownStaff = consultant.employmentType === "LOONDIENST";

  const timesheets = await db.timesheet.findMany({
    where: { ...pendingWhere(), placement: { consultantId } },
    include: flowInclude,
    orderBy: { weekStart: "asc" },
  });
  const weeks = timesheets.map((t) => toFlowWeek(t));

  const needApprovalIds = weeks.filter((w) => w.status === "SUBMITTED").map((w) => w.timesheetId);

  // Q4S gebruikt de ontvangen factuur van de freelancer; self-billing staat uit.
  const inkoopPending: FlowWeek[] = [];
  const inkoopTotals = {
    hours: round2(inkoopPending.reduce((s, w) => s + w.hours, 0)),
    cost: round2(inkoopPending.reduce((s, w) => s + w.cost, 0)),
  };

  // Alleen weken MET een klant kunnen op een verkoopfactuur — een plaatsing zonder
  // gekoppeld bedrijf slaan we hier over (blijft wel zichtbaar in de wekenlijst).
  const verkoopPending = weeks.filter((w) => w.status === "APPROVED" && !w.hasSales && w.clientId);
  const groups = new Map<string, SalesGroup>();
  for (const w of verkoopPending) {
    if (!w.clientId) continue;
    let g = groups.get(w.clientId);
    if (!g) {
      g = { clientId: w.clientId, clientName: w.clientName, timesheetIds: [], hours: 0, charge: 0, cost: 0, margin: 0 };
      groups.set(w.clientId, g);
    }
    g.timesheetIds.push(w.timesheetId);
    g.hours = round2(g.hours + w.hours);
    g.charge = round2(g.charge + w.charge);
    g.cost = round2(g.cost + w.cost);
    g.margin = round2(g.margin + w.margin);
  }

  return {
    consultant,
    weeks,
    needApprovalIds,
    inkoopPendingIds: inkoopPending.map((w) => w.timesheetId),
    inkoopTotals,
    verkoopByClient: [...groups.values()],
    ownStaff,
    done: weeks.length === 0,
  };
}

// ---------------------------------------------------------------------------
// 1b) Batch — genereer alle facturen in één keer
// ---------------------------------------------------------------------------

export type BatchResult = {
  consultants: number; // hoeveel medewerkers hadden werk
  inkoop: number; // aangemaakte inkoopfacturen
  verkoop: number; // aangemaakte verkoopfacturen
  skippedApproval: number; // weekstaten die eerst goedgekeurd moeten worden
  errors: string[];
};

/**
 * Genereer voor ELKE medewerker met openstaand werk de verkoopfactuur(en) per
 * klant. De eigen freelancerfactuur wordt apart als ReceivedInvoice geregistreerd.
 * Alleen GOEDGEKEURDE
 * weekstaten worden verwerkt; nog-in-te-dienen (SUBMITTED) weekstaten worden
 * geteld en overgeslagen zodat een mens ze eerst controleert. Elke factuur is
 * atomair (zie invoicing.ts); we recomputen per medewerker uit de DB.
 */
export async function processAllPending(): Promise<BatchResult> {
  const rows = await pendingWorkByConsultant();
  const inkoop = 0;
  let verkoop = 0;
  let skippedApproval = 0;
  const errors: string[] = [];

  for (const row of rows) {
    // Eén medewerker die faalt mag de rest van de batch niet wegvagen: elke
    // factuur is atomair (invoicing.ts), maar een echte DB-fout WERPT — vang die
    // per medewerker af, log 'm en ga door.
    try {
      // Verse snapshot per medewerker (state kan door eerdere iteraties wijzigen).
      const flow = await consultantFlow(row.consultantId);
      if (!flow) continue;
      skippedApproval += flow.needApprovalIds.length;

      for (const g of flow.verkoopByClient) {
        const res = await createSalesInvoice({
          clientId: g.clientId,
          timesheetIds: g.timesheetIds,
          issueDate: new Date(),
          notes: null,
        });
        if (res.ok) verkoop++;
        else errors.push(`Verkoop ${row.name} → ${g.clientName}: ${res.error}`);
      }
    } catch (e) {
      errors.push(`${row.name}: ${e instanceof Error ? e.message : "onbekende fout"}`);
    }
  }

  return { consultants: rows.length, inkoop, verkoop, skippedApproval, errors };
}

export type ConsultantProcessResult = {
  ok: boolean;
  approved: number; // ingediende weken die zijn goedgekeurd
  inkoop: number; // aangemaakte inkoopfacturen
  verkoop: number; // aangemaakte verkoopfacturen
  errors: string[];
};

/**
 * Verwerk ÉÉN medewerker: keur alle ingediende (SUBMITTED) weken goed en maak
 * daarna de verkoopfactuur(en) per klant aan. Een eventuele oude `inkoop`-optie
 * wordt bewust genegeerd: Q4S gebruikt de ontvangen freelancerfactuur. De mens
 * controleert vooraf in het overzicht; alles wordt server-side hercomputed en
 * elke factuur is atomair (invoicing.ts).
 */
export async function processConsultant(
  consultantId: string,
  opts: { inkoop?: boolean; verkoop?: boolean } = {},
): Promise<ConsultantProcessResult | null> {
  const doVerkoop = opts.verkoop ?? true;

  const flow0 = await consultantFlow(consultantId);
  if (!flow0) return null;

  // 1) Keur alle ingediende weken goed — atomair, alleen wat nog SUBMITTED is.
  //    Nodig voor beide factuursoorten (alleen goedgekeurde weken factureren).
  let approved = 0;
  if (flow0.needApprovalIds.length > 0) {
    const res = await db.timesheet.updateMany({
      where: { id: { in: flow0.needApprovalIds }, status: "SUBMITTED" },
      data: { status: "APPROVED" },
    });
    approved = res.count;
  }

  // 2) Herbereken ná goedkeuring: nu zijn die weken factureerbaar.
  const flow = await consultantFlow(consultantId);
  if (!flow) return { ok: false, approved, inkoop: 0, verkoop: 0, errors: ["Flow verdween."] };

  const inkoop = 0;
  let verkoop = 0;
  const errors: string[] = [];

  // Eén factuur die faalt mag de rest niet wegvagen (elke factuur is atomair),
  // maar een echte DB-fout WERPT — vang die af, log 'm en ga door.
  try {
    if (doVerkoop) {
      for (const g of flow.verkoopByClient) {
        const res = await createSalesInvoice({
          clientId: g.clientId,
          timesheetIds: g.timesheetIds,
          issueDate: new Date(),
          notes: null,
        });
        if (res.ok) verkoop++;
        else errors.push(`Verkoopfactuur → ${g.clientName}: ${res.error}`);
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "onbekende fout");
  }

  return { ok: errors.length === 0, approved, inkoop, verkoop, errors };
}

// ---------------------------------------------------------------------------
// 1c) Facturatie-archief — volledig verwerkte medewerker-weken, per week
// ---------------------------------------------------------------------------

export type ArchivedRow = {
  timesheetId: string;
  consultantId: string;
  consultantName: string;
  placementTitle: string;
  clientName: string;
  hours: number;
  sales: { id: string; number: string; status: string } | null;
  purchase: { id: string; number: string; status: string } | null;
};

export type ArchivedWeek = {
  key: string;
  weekStart: Date;
  weekLabel: string;
  rows: ArchivedRow[];
  hours: number;
};

/**
 * Alle weekstaten die het volledige proces hebben doorlopen: INVOICED en op een
 * verkoopfactuur. De freelancerfactuur is een apart ontvangen brondocument.
 * Gegroepeerd per week (nieuwste
 * eerst). De vorige flows (verwerken/verzendmap) blijven zo schoon; hier vind je
 * de historie terug en kun je via de factuur-links aanpassen — het bestaande
 * factuurnummer blijft behouden (bewerken wijzigt het nummer niet).
 */
export async function archivedBillingByWeek(): Promise<ArchivedWeek[]> {
  const timesheets = await db.timesheet.findMany({
    where: {
      status: "INVOICED",
      invoiceLine: { isNot: null },
    },
    include: {
      entries: { select: { hours: true } },
      placement: {
        include: {
          client: { select: { companyName: true } },
          consultant: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      invoiceLine: { select: { invoice: { select: { id: true, number: true, status: true } } } },
      purchaseLine: { select: { purchaseInvoice: { select: { id: true, number: true, status: true } } } },
    },
    orderBy: [{ weekStart: "desc" }],
  });

  const map = new Map<string, ArchivedWeek>();
  for (const t of timesheets) {
    const key = String(t.weekStart.getTime());
    let g = map.get(key);
    if (!g) {
      g = { key, weekStart: t.weekStart, weekLabel: formatWeekLabel(t.weekStart), rows: [], hours: 0 };
      map.set(key, g);
    }
    const hours = round2(t.entries.reduce((s, e) => s + e.hours, 0));
    const inv = t.invoiceLine?.invoice ?? null;
    const pinv = t.purchaseLine?.purchaseInvoice ?? null;
    g.rows.push({
      timesheetId: t.id,
      consultantId: t.placement.consultant.id,
      consultantName: `${t.placement.consultant.firstName} ${t.placement.consultant.lastName}`,
      placementTitle: t.placement.title,
      clientName: t.placement.client?.companyName ?? "— geen bedrijf",
      hours,
      sales: inv ? { id: inv.id, number: inv.number, status: inv.status } : null,
      purchase: pinv ? { id: pinv.id, number: pinv.number, status: pinv.status } : null,
    });
    g.hours = round2(g.hours + hours);
  }

  for (const g of map.values()) {
    g.rows.sort((a, b) => a.consultantName.localeCompare(b.consultantName, "nl"));
  }
  return [...map.values()].sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
}

// ---------------------------------------------------------------------------
// 2) Invoicing overview — dashboard + /totaaloverzicht
// ---------------------------------------------------------------------------

const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "short" });

export type OverviewMonth = { key: string; label: string; omzet: number; inkoop: number; marge: number };
export type OverviewClient = { clientId: string; name: string; omzet: number; openstaand: number; facturen: number };
export type OverviewConsultant = {
  consultantId: string;
  name: string;
  omzet: number;
  kosten: number;
  marge: number;
  teBetalen: number;
  /** Eigen loondienst-personeel: geen inkoopfactuur → kosten 0 hier, de loonkost
   *  loopt via de eigen loonkosten (nettowinst). Marge = brutomarge (schijnbaar 100%). */
  loondienst: boolean;
};

export type InvoicingOverview = {
  omzet: number; // ex BTW, non-cancelled, this year
  inkoop: number; // ex BTW, non-cancelled, this year
  marge: number;
  margePct: number;
  openstaand: number; // sales SENT (incl BTW)
  openstaandCount: number;
  teBetalen: number; // purchase APPROVED (incl BTW)
  teBetalenCount: number;
  overdue: number; // sales SENT past due (incl BTW)
  perMonth: OverviewMonth[];
  perClient: OverviewClient[];
  perConsultant: OverviewConsultant[];
  salesStatus: { status: string; count: number; total: number }[];
  purchaseStatus: { status: string; count: number; total: number }[];
};

export async function invoicingOverview(range?: { start: Date; end: Date }): Promise<InvoicingOverview> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const twelveAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  // Optionele periode-scope: komt er een 'range' mee (bijv. vanaf het dashboard-
  // filter), dan scopen we de bedragen op die datums; zonder range = dit
  // kalenderjaar (default — zoals /totaaloverzicht 'm gebruikt, ongewijzigd).
  const scoped = Boolean(range);
  const start = range?.start ?? yearStart;
  const end = range?.end ?? new Date(now.getFullYear() + 1, 0, 1);
  const inRange = (d: Date) => d >= start && d < end;

  const [invoices, received, invoiceLines] = await Promise.all([
    db.invoice.findMany({ include: { client: { select: { id: true, companyName: true } } } }),
    db.receivedInvoice.findMany({
      include: { consultant: { select: { id: true, firstName: true, lastName: true } } },
    }),
    db.invoiceLine.findMany({
      include: {
        invoice: { select: { status: true, issueDate: true } },
        placement: { select: { consultantId: true } },
      },
    }),
  ]);

  const live = (s: string) => s !== "CANCELLED";
  const acceptedReceived = received.filter(
    (r): r is typeof r & { issueDate: Date } =>
      (r.status === "APPROVED" || r.status === "PAID") && r.issueDate !== null,
  );
  const receivedNet = (r: (typeof acceptedReceived)[number]) => round2(r.amount - (r.vatAmount ?? 0));

  // Headline totals (periode, ex BTW voor omzet/marge).
  const omzet = round2(
    invoices.filter((i) => live(i.status) && inRange(new Date(i.issueDate))).reduce((s, i) => s + i.subtotal, 0),
  );
  const inkoop = round2(
    acceptedReceived.filter((p) => inRange(p.issueDate)).reduce((s, p) => s + receivedNet(p), 0),
  );
  const marge = round2(omzet - inkoop);
  const margePct = omzet > 0 ? Math.round((marge / omzet) * 100) : 0;

  // Openstaand/te-betalen: alleen op de periode scopen als er een range meekomt;
  // anders de live snapshot van álles wat open staat (zoals voorheen).
  const sentInvoices = invoices.filter(
    (i) => i.status === "SENT" && (!scoped || inRange(new Date(i.issueDate))),
  );
  const openstaand = round2(sentInvoices.reduce((s, i) => s + i.total, 0));
  const overdue = round2(sentInvoices.filter((i) => i.dueDate < now).reduce((s, i) => s + i.total, 0));
  const toPay = acceptedReceived.filter(
    (p) => p.status === "APPROVED" && (!scoped || inRange(p.issueDate)),
  );
  const teBetalen = round2(toPay.reduce((s, p) => s + p.amount, 0));

  // Per month (last 12), ex BTW.
  const perMonth: OverviewMonth[] = Array.from({ length: 12 }, (_, idx) => {
    const d = new Date(twelveAgo.getFullYear(), twelveAgo.getMonth() + idx, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: monthFmt.format(d), omzet: 0, inkoop: 0, marge: 0 };
  });
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  for (const i of invoices) {
    if (!live(i.status)) continue;
    const m = perMonth.find((x) => x.key === monthKey(new Date(i.issueDate)));
    if (m) m.omzet = round2(m.omzet + i.subtotal);
  }
  for (const p of acceptedReceived) {
    const m = perMonth.find((x) => x.key === monthKey(p.issueDate));
    if (m) m.inkoop = round2(m.inkoop + receivedNet(p));
  }
  for (const m of perMonth) m.marge = round2(m.omzet - m.inkoop);

  // Per client.
  const clientMap = new Map<string, OverviewClient>();
  for (const i of invoices) {
    if (!live(i.status)) continue;
    if (scoped && !inRange(new Date(i.issueDate))) continue;
    let c = clientMap.get(i.clientId);
    if (!c) {
      c = { clientId: i.clientId, name: i.client.companyName, omzet: 0, openstaand: 0, facturen: 0 };
      clientMap.set(i.clientId, c);
    }
    c.omzet = round2(c.omzet + i.subtotal);
    c.facturen += 1;
    if (i.status === "SENT") c.openstaand = round2(c.openstaand + i.total);
  }
  const perClient = [...clientMap.values()].sort((a, b) => b.omzet - a.omzet);

  // Per consultant: omzet uit verkoopregels, kosten/te betalen uit ontvangen facturen.
  const consMap = new Map<string, OverviewConsultant>();
  const ensureCons = (id: string): OverviewConsultant => {
    let c = consMap.get(id);
    if (!c) {
      c = { consultantId: id, name: id, omzet: 0, kosten: 0, marge: 0, teBetalen: 0, loondienst: false };
      consMap.set(id, c);
    }
    return c;
  };
  for (const l of invoiceLines) {
    if (!live(l.invoice.status) || !l.placement) continue;
    ensureCons(l.placement.consultantId).omzet += l.amount;
  }
  for (const p of acceptedReceived) {
    const c = ensureCons(p.consultantId);
    c.kosten += receivedNet(p);
  }
  for (const p of toPay) ensureCons(p.consultantId).teBetalen = round2(ensureCons(p.consultantId).teBetalen + p.amount);
  // Resolve names + dienstverband in één query (voor het loondienst-label).
  const consInfo = new Map<string, { name: string; loondienst: boolean }>();
  const consIds = [...consMap.keys()];
  if (consIds.length) {
    const rows = await db.consultant.findMany({
      where: { id: { in: consIds } },
      select: { id: true, firstName: true, lastName: true, employmentType: true },
    });
    for (const c of rows)
      consInfo.set(c.id, {
        name: `${c.firstName} ${c.lastName}`,
        loondienst: c.employmentType === "LOONDIENST",
      });
  }
  const perConsultant = [...consMap.values()]
    .map((c) => {
      const info = consInfo.get(c.consultantId);
      return {
        ...c,
        name: info?.name ?? "—",
        loondienst: info?.loondienst ?? false,
        omzet: round2(c.omzet),
        kosten: round2(c.kosten),
        marge: round2(c.omzet - c.kosten),
      };
    })
    .sort((a, b) => b.omzet - a.omzet);

  // Status distribution.
  const countBy = (rows: { status: string; total: number; dueDate?: Date }[], overdueAware: boolean) => {
    const m = new Map<string, { status: string; count: number; total: number }>();
    for (const r of rows) {
      let st = r.status;
      if (overdueAware && r.status === "SENT" && r.dueDate && r.dueDate < now) st = "OVERDUE";
      let e = m.get(st);
      if (!e) {
        e = { status: st, count: 0, total: 0 };
        m.set(st, e);
      }
      e.count += 1;
      e.total = round2(e.total + r.total);
    }
    return [...m.values()];
  };

  return {
    omzet,
    inkoop,
    marge,
    margePct,
    openstaand,
    openstaandCount: sentInvoices.length,
    teBetalen,
    teBetalenCount: toPay.length,
    overdue,
    perMonth,
    perClient,
    perConsultant,
    salesStatus: countBy(invoices, true),
    purchaseStatus: countBy(received.map((r) => ({ status: r.status, total: r.amount })), false),
  };
}

// ---------------------------------------------------------------------------
// 3) Eigen bedrijfskosten — de stap van brutomarge naar NETTOWINST
// ---------------------------------------------------------------------------

export type CompanyCosts = {
  loonkosten: number; // eigen team, dit kalenderjaar
  bonussen: number; // uitbetaalde/vastgelegde bonussen dit jaar
  declaraties: number; // goedgekeurde + betaalde declaraties dit jaar
  totaal: number;
  /** true = loonkosten geschat op maandsalaris × verstreken maanden (nog geen loonstroken). */
  loonkostenGeschat: boolean;
  monthsElapsed: number;
  year: number;
};

/**
 * Q4S' EIGEN operationele kosten voor het lopende kalenderjaar — nodig om van de
 * brutomarge (omzet − inkoop, wat we de gedetacheerde werkers betalen) naar de
 * echte NETTOWINST te komen: wat we ná onze eigen kosten overhouden.
 * Basis = hetzelfde kalenderjaar als invoicingOverview() zodat marge en kosten
 * over dezelfde periode lopen. Loonkosten uit de vastgelegde loonstroken
 * (EmployeePayslip); zijn die er nog niet, dan een run-rate schatting op basis
 * van de maandsalarissen van het actieve team × verstreken maanden.
 */
export async function companyCostsThisYear(range?: { start: Date; end: Date }): Promise<CompanyCosts> {
  const now = new Date();
  const start = range?.start ?? new Date(now.getFullYear(), 0, 1);
  const end = range?.end ?? new Date(now.getFullYear() + 1, 0, 1);
  const year = start.getFullYear(); // een periode (kwartaal/jaar) valt binnen één kalenderjaar
  const inRange = (d: Date) => d >= start && d < end;

  // De maanden in de periode + hoeveel daarvan al zijn begonnen (voor de schatting).
  const monthStarts: Date[] = [];
  for (
    let d = new Date(start.getFullYear(), start.getMonth(), 1);
    d < end;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    monthStarts.push(d);
  }
  const monthsElapsed = monthStarts.filter((d) => d <= now).length;

  const [payslips, employees, bonuses, expenses] = await Promise.all([
    db.employeePayslip.findMany({ where: { year }, select: { grossAmount: true, month: true } }),
    db.employee.findMany({ where: { active: true }, select: { monthlySalary: true } }),
    db.employeeBonus.findMany({
      where: { date: { gte: start, lt: end } },
      select: { amount: true },
    }),
    // Declaraties tellen als kost zodra ze goedgekeurd of uitbetaald zijn.
    db.expense.findMany({
      where: { status: { in: ["APPROVED", "PAID"] } },
      select: { amount: true, date: true, createdAt: true },
    }),
  ]);

  const payslipSum = round2(
    payslips.filter((p) => inRange(new Date(year, p.month - 1, 1))).reduce((s, p) => s + p.grossAmount, 0),
  );
  const loonkostenGeschat = payslipSum <= 0;
  const loonkosten = loonkostenGeschat
    ? round2(employees.reduce((s, e) => s + e.monthlySalary, 0) * monthsElapsed)
    : payslipSum;

  const bonussen = round2(bonuses.reduce((s, b) => s + b.amount, 0));

  const declaraties = round2(
    expenses.filter((e) => inRange(e.date ?? e.createdAt)).reduce((s, e) => s + e.amount, 0),
  );

  const totaal = round2(loonkosten + bonussen + declaraties);
  return { loonkosten, bonussen, declaraties, totaal, loonkostenGeschat, monthsElapsed, year };
}
