import { db } from "./db";
import { ontbrekendVoorActief } from "./ontbrekende-gegevens";
import { getCompanySettings } from "./settings";
import { summarizeRecentWeeks } from "./timesheet-gate-history";
import { computeTimesheetMoney } from "./toeslag";
import { formatWeekLabel, round2, startOfISOWeek } from "./utils";
import { weekBereikLabel, weekKeyVanDatum, weekSlotVanKey } from "./wizard-weeknav";
import { weekSlotVanDatum } from "./week-koppeling";
import { parseWeekNumber } from "./invoice-extract";
import { weekNummerUitTekst } from "./week-koppeling";
import {
  evaluateFacturatieWeek,
  parseApproverNames,
  timesheetEntries,
  weekDeadline,
  type Check,
  type ComparisonRow,
  type FacturatieCheckInput,
  type FacturatieCheckResult,
  type InvoiceExtraction,
  type PlacementTerms,
  type TimesheetExtraction,
  type WeekStatus,
} from "./facturatie-checks";

// ---------------------------------------------------------------------------
// DE DATA-LAAG onder "Week verwerken" (/facturatie).
//
// Twee ingangen:
//   • getWeekOverview(weekKey) — één regel per persoon-met-actieve-plaatsing in
//     die week (plus wie iets instuurde zónder actieve plaatsing), elk met de
//     uitkomst van de controle-machine;
//   • getWeekDossier(placementId, weekKey) — alles voor de detailpagina.
//
// Hier wordt NIETS besloten en NIETS gerekend: het oordeel komt uit de pure
// machine (src/lib/facturatie-checks.ts) en de bedragen uit
// `computeTimesheetMoney` (src/lib/toeslag.ts). Dit bestand haalt alleen op en
// legt naast elkaar. Het schrijft ook niets — dat doen de server-actions.
// ---------------------------------------------------------------------------

/** Statussen van een urenstaat die betekenen: deze week is al vastgelegd. */
const VASTGELEGD = ["APPROVED", "INVOICED"];
/** Inbox-statussen die nog op verwerking wachten. */
const OPENSTAAND = ["NEW", "EXTRACTED"];
/** Hoe ver terug we nog naar niet-uitgelezen scans kijken (dagen vóór de week). */
const ZONDER_WEEK_DAGEN = 60;

/** Activity-sleutels waarmee akkoorden en accepteringen vastgelegd worden. */
export const FACTURATIE_ENTITY = "facturatie-week";
export const ACK_PREFIX = "ack:";
export const ACCEPT_KEY = "accept";

/** De id waaronder een week zijn aantekeningen (akkoord/geaccepteerd) krijgt. */
export function weekEntityId(placementId: string, weekKey: string): string {
  return `${placementId}:${weekKey}`;
}

// ===========================================================================
// De week zelf
// ===========================================================================

export type WeekSlotInfo = {
  /** "2026-W40" */
  key: string;
  isoWeek: number;
  year: number;
  monday: Date;
  sunday: Date;
  /** Dinsdag 12:00 ná de gewerkte week. */
  deadline: Date;
  /** "Week 40 · 2026" */
  label: string;
  /** "28 sep – 4 okt 2026" */
  bereik: string;
  /** De maandag als "YYYY-MM-DD" — wat de WeekBalk in `?week=` zet. */
  mondayParam: string;
};

/**
 * De week waar de pagina over gaat. `?week=` mag als weeksleutel ("2026-W40")
 * óf als losse dag ("2026-09-30") binnenkomen: de bestaande WeekBalk navigeert
 * met een datum, de dossier-route met een sleutel. Leeg/onleesbaar → de week
 * waarin `today` valt.
 */
export function resolveWeek(value: string | null | undefined, today: Date): WeekSlotInfo {
  const raw = String(value ?? "").trim();
  const slot =
    weekSlotVanKey(raw) ??
    weekSlotVanDatum(raw || null) ??
    weekSlotVanDatum(today);
  // weekSlotVanDatum(today) kan niet null zijn, maar TypeScript weet dat niet.
  const veilig = slot ?? weekSlotVanDatum(new Date())!;
  const monday = new Date(`${veilig.monday}T00:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    key: veilig.key,
    isoWeek: veilig.isoWeek,
    year: veilig.year,
    monday,
    sunday,
    deadline: weekDeadline(monday),
    label: formatWeekLabel(monday),
    bereik: weekBereikLabel(veilig),
    mondayParam: veilig.monday,
  };
}

// ===========================================================================
// Eén regel op het weekoverzicht
// ===========================================================================

export type WeekRow = {
  /** Unieke sleutel voor de tabelrij (plaatsing, of persoon zonder plaatsing). */
  key: string;
  placementId: string | null;
  consultantId: string;
  naam: string;
  klantNaam: string | null;
  locatie: string | null;
  /** ZZP | LOONDIENST | UITZEND */
  employmentType: string;
  isZZP: boolean;
  /** TimesheetInbox.id van de (nog) openstaande scan. */
  inboxId: string | null;
  /** Timesheet.id als de week al als urenstaat is vastgelegd. */
  timesheetId: string | null;
  receivedInvoiceId: string | null;
  /** Ligt er al een urenstaat (APPROVED/INVOICED)? */
  vastgelegd: boolean;
  /** Staat de week al op een verkoopfactuur? Dan nooit opnieuw factureren. */
  gefactureerd: boolean;
  verkoopFactuurId: string | null;
  verkoopFactuurNummer: string | null;
  /** Staat deze week in de wachtkamer (geparkeerd)? */
  wachtkamerSinds: Date | null;
  timesheetOntvangen: boolean;
  factuurOntvangen: boolean;
  /** Een medewerker in dienst hoeft geen factuur te sturen. */
  factuurNvt: boolean;
  /** Gewerkte (reguliere) uren; null = niets ontvangen. */
  uren: number | null;
  status: WeekStatus;
  /** De eerste fouttitels — de kolom "Wat is er mis". */
  problemen: string[];
  aantalControles: number;
  aantalFouten: number;
  aantalWaarschuwingen: number;
  /** Zijn de fouten bewust geaccepteerd (mét reden)? */
  geaccepteerd: boolean;
  /** Link naar het dossier; null zonder actieve plaatsing. */
  href: string | null;
};

export type WeekStats = {
  actief: number;
  klaar: number;
  fout: number;
  wacht: number;
  nietIngeleverd: number;
};

/** Een handmatige upload die (nog) aan niemand gekoppeld is. */
export type LosseUpload = {
  id: string;
  soort: "timesheet" | "factuur";
  originalName: string;
  mimeType: string | null;
  /** De naam die de AI op het document las. */
  gelezenNaam: string | null;
  reden: string | null;
  /** De auth-gated route die het bestand toont. */
  src: string;
};

export type WeekOverview = {
  week: WeekSlotInfo;
  rows: WeekRow[];
  stats: WeekStats;
  losseUploads: LosseUpload[];
  /** Alle actieve mensen — de keuzelijst bij een losse upload. */
  personen: { id: string; naam: string }[];
};

type PlacementRow = Awaited<ReturnType<typeof ladenPlaatsingen>>[number];

function ladenPlaatsingen(monday: Date, sunday: Date) {
  return db.placement.findMany({
    where: {
      // Ook "nog niet actief": die staan erin met een rode melding wat er
      // ontbreekt, zodat een binnengekomen urenstaat niet onzichtbaar wordt.
      status: { in: ["ACTIVE", "INCOMPLETE"] },
      startDate: { lte: sunday },
      OR: [{ endDate: null }, { endDate: { gte: monday } }],
    },
    include: {
      consultant: true,
      client: { select: { id: true, companyName: true } },
    },
    orderBy: [{ consultant: { lastName: "asc" } }, { startDate: "desc" }],
  });
}

/** De contractvoorwaarden van een plaatsing, in de vorm die de machine wil. */
/**
 * De controle-machine + de harde regel "alleen een complete plaatsing gaat door
 * de facturatie": ontbreekt er iets (werknemer, klant, tarieven), dan is het een
 * fout die NIET weg te accepteren is — eerst aanvullen bij de plaatsing.
 */
function beoordeelMetPlaatsing(input: FacturatieCheckInput, p: PlacementRow | null): FacturatieCheckResult {
  const result = evaluateFacturatieWeek(input);
  if (!p) return result;
  const ontbreekt = ontbrekendVoorActief({ heeftKlant: Boolean(p.clientId), ...p }, p.consultant);
  if (ontbreekt.length === 0) return result;
  return {
    ...result,
    status: result.status === "NIET_INGELEVERD" ? result.status : "FOUT",
    checks: [
      {
        id: "contract-compleet",
        group: "contract",
        level: "error",
        title: "Plaatsing nog niet compleet",
        detail: `Nog niet ingevuld bij de plaatsing: ${ontbreekt.join(", ")}. Vul dit eerst aan — pas dan kan de week gefactureerd worden.`,
      },
      ...result.checks,
    ],
  };
}

function termsVan(p: PlacementRow): PlacementTerms {
  return {
    ...p,
    approverNames: parseApproverNames(p.approverNames),
    currency: p.currency || "EUR",
    clientName: p.client?.companyName ?? null,
    workLocation: p.workLocation,
    hasClient: Boolean(p.clientId),
  };
}

function naamVan(c: { firstName: string; lastName: string }): string {
  return `${c.firstName} ${c.lastName}`.trim();
}

/** Nummer → number, maar alleen als het een bruikbaar getal is. */
function getal(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tekst(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** JSON-kolom veilig uitpakken; rommel levert een leeg object op. */
function leesJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** De handmatige correctie (draftJson) van het controle-scherm, als die er is. */
type Concept = { dagUren: string[]; overuren: string; kilometers: string } | null;

function leesConcept(draftJson: string | null): Concept {
  const raw = leesJson(draftJson);
  const dagen = raw.dagUren;
  if (!Array.isArray(dagen)) return null;
  return {
    dagUren: [0, 1, 2, 3, 4, 5, 6].map((i) => String(dagen[i] ?? "")),
    overuren: String(raw.overuren ?? ""),
    kilometers: String(raw.kilometers ?? ""),
  };
}

/** "8" / "8,5" / "" → number | null (dezelfde notatie als het formulier). */
function parseGetal(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isoDag(monday: Date, i: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type InboxRow = {
  id: string;
  originalName: string;
  mimeType: string;
  fileName: string;
  consultantId: string | null;
  placementId: string | null;
  timesheetId: string | null;
  status: string;
  extractedName: string | null;
  extractedWeekStart: Date | null;
  extractedKilometers: number | null;
  extractedOvertimeHours: number | null;
  extractedJson: string | null;
  draftJson: string | null;
  confidence: string | null;
  senderEmail: string | null;
  emailSubject: string | null;
  receivedAt: Date | null;
  createdAt: Date;
  wachtkamerSince: Date | null;
  wachtkamerReason: string | null;
};

type TimesheetRow = {
  id: string;
  placementId: string;
  weekStart: Date;
  status: string;
  kilometers: number | null;
  overtimeHours: number | null;
  entries: { date: Date; hours: number }[];
  invoiceLine: { invoice: { id: string; number: string; status: string } } | null;
};

type ReceivedRow = {
  id: string;
  consultantId: string;
  number: string | null;
  issueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  amount: number;
  vatAmount: number | null;
  vatRate: number | null;
  kilometers: number | null;
  status: string;
  weekKey: string | null;
  extractedJson: string | null;
  notes: string | null;
  fileName: string | null;
  originalName: string | null;
  mimeType: string | null;
};

/**
 * De uitlezing van de urenstaat in de vorm die de machine wil. De HANDMATIGE
 * correctie wint altijd van de AI-uitlezing, en een al vastgelegde urenstaat
 * wint van allebei — dat is immers wat er écht geboekt staat.
 */
function timesheetExtractionVan(args: {
  inbox: InboxRow | null;
  timesheet: TimesheetRow | null;
  monday: Date;
}): TimesheetExtraction | null {
  const { inbox, timesheet, monday } = args;
  if (!inbox && !timesheet) return null;

  const raw = leesJson(inbox?.extractedJson ?? null);
  const concept = leesConcept(inbox?.draftJson ?? null);

  let days: { date: string; hours: number }[];
  let overtimeHours: number | null;
  let kilometers: number | null;
  if (timesheet) {
    days = timesheet.entries.map((e) => ({
      date: `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}-${String(e.date.getDate()).padStart(2, "0")}`,
      hours: e.hours,
    }));
    overtimeHours = timesheet.overtimeHours;
    kilometers = timesheet.kilometers;
  } else if (concept) {
    days = concept.dagUren
      .map((h, i) => ({ date: isoDag(monday, i), hours: parseGetal(h) ?? 0 }))
      .filter((d) => d.hours > 0);
    overtimeHours = parseGetal(concept.overuren);
    kilometers = parseGetal(concept.kilometers);
  } else {
    const gelezen = Array.isArray(raw.days) ? (raw.days as { date?: string; hours?: number }[]) : [];
    days = gelezen
      .map((d, i) => ({
        date: tekst(d?.date) ?? isoDag(monday, i),
        hours: getal(d?.hours) ?? 0,
      }))
      .filter((d) => d.hours > 0);
    overtimeHours = inbox?.extractedOvertimeHours ?? getal(raw.overtimeHours);
    kilometers = inbox?.extractedKilometers ?? getal(raw.kilometers);
  }

  const getypt =
    parseWeekNumber(tekst(raw.weekNumber)) ??
    (inbox ? weekNummerUitTekst(inbox.originalName) : null);

  return {
    days,
    overtimeHours,
    kilometers,
    travelHours: getal(raw.travelHours),
    expenses: getal(raw.expenses),
    signaturePresent: bool(raw.signaturePresent),
    signerName: tekst(raw.signerName),
    typedWeekNumber: getypt,
    name: inbox?.extractedName ?? tekst(raw.name),
    clientName: tekst(raw.clientName),
    projectName: tekst(raw.projectName) ?? tekst(raw.project),
    location: tekst(raw.location),
    poNumber: tekst(raw.poNumber),
    confidence: inbox?.confidence ?? tekst(raw.confidence),
    pagesComplete: bool(raw.pagesComplete),
    receivedAt: inbox?.receivedAt ?? inbox?.createdAt ?? null,
  };
}

/** Zijn factuur in de vorm die de machine wil: de vastgelegde kolommen plus de
 *  controlevelden uit `extractedJson`. De kolommen winnen (die zijn nagekeken). */
function invoiceExtractionVan(inv: ReceivedRow | null): InvoiceExtraction | null {
  if (!inv) return null;
  const raw = leesJson(inv.extractedJson);
  const btwPct = getal(raw.vatPercent);
  const verlegd = bool(raw.vatShifted);
  const regels = Array.isArray(raw.surchargeLines)
    ? (raw.surchargeLines as Record<string, unknown>[]).map((r) => ({
        label: String(r?.label ?? ""),
        quantity: getal(r?.quantity),
        unit: tekst(r?.unit),
        amount: getal(r?.amount),
      }))
    : [];

  // Het bedrag EX btw uit de vastgelegde kolommen (amount is incl. btw).
  const btwBedrag = inv.vatAmount;
  const exBtw =
    btwBedrag != null
      ? round2(inv.amount - btwBedrag)
      : verlegd === true
        ? round2(inv.amount)
        : getal(raw.amountExclVat);

  return {
    number: inv.number,
    issueDate: inv.issueDate,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    hours: getal(raw.hours),
    hourlyRate: getal(raw.hourlyRate),
    overtimeHours: getal(raw.overtimeHours),
    surchargeLines: regels,
    kilometers: inv.kilometers ?? getal(raw.kilometers),
    vatPercent: btwPct !== null && btwPct >= 0 ? btwPct : inv.vatRate,
    vatShifted: verlegd,
    currency: tekst(raw.currency),
    addressee: tekst(raw.addressee),
    kvkNumber: tekst(raw.kvkNumber),
    vatId: tekst(raw.vatId),
    iban: tekst(raw.iban),
    poNumber: tekst(raw.poNumber),
    mentionsAttachment: bool(raw.mentionsAttachment),
    amountExclVat: exBtw,
    totalAmount: inv.amount > 0 ? inv.amount : getal(raw.totalAmount),
  };
}

/** Hoort deze factuur bij deze week? Eerst op de vastgelegde weeksleutel, anders
 *  op de periode (de maandag van de week moet erin vallen). */
function factuurHoortBijWeek(inv: ReceivedRow, week: WeekSlotInfo): boolean {
  if (inv.weekKey) return inv.weekKey === week.key;
  if (!inv.periodStart || !inv.periodEnd) return false;
  const m = week.monday.getTime();
  return startOfISOWeek(inv.periodStart).getTime() <= m && inv.periodEnd.getTime() >= m;
}

// ===========================================================================
// getWeekOverview
// ===========================================================================

/**
 * Het weekoverzicht: één regel per persoon met een actieve plaatsing in deze
 * week, plus een regel voor wie wél iets instuurde maar geen actieve plaatsing
 * heeft (die komt als FOUT "geen actieve plaatsing" bovendrijven in plaats van
 * stil te verdwijnen).
 */
function rondMaandag(monday: Date, uren: number): Date {
  return new Date(monday.getTime() + uren * 3600_000);
}

/** Iemand met een actieve plaatsing die na de deadline nog niets heeft gestuurd. */
export type TeLaat = { naam: string; klantNaam: string | null; href: string | null; weken: number[] };

/**
 * Wie heeft na de deadline (DEADLINE_LABEL) nog NIETS ingeleverd? Kijkt naar de
 * twee laatst afgesloten weken, los van de week die op het scherm staat — op
 * dinsdagmiddag kijk je naar de nieuwe week, maar de rode melding gaat over de
 * vorige.
 */
export async function getTeLaat(now: Date = new Date()): Promise<TeLaat[]> {
  const perPersoon = new Map<string, TeLaat>();
  for (const terug of [2, 1]) {
    const dag = new Date(now);
    dag.setDate(dag.getDate() - 7 * terug);
    const week = resolveWeek(null, dag);
    if (now.getTime() <= week.deadline.getTime()) continue;
    const { rows } = await getWeekOverview(week.key, now);
    for (const r of rows) {
      if (r.status !== "NIET_INGELEVERD") continue;
      const bestaand = perPersoon.get(r.key);
      if (bestaand) {
        bestaand.weken.push(week.isoWeek);
        bestaand.href = r.href; // de meest recente week openen
      } else {
        perPersoon.set(r.key, { naam: r.naam, klantNaam: r.klantNaam, href: r.href, weken: [week.isoWeek] });
      }
    }
  }
  return [...perPersoon.values()].sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

export async function getWeekOverview(
  weekParam: string | null | undefined,
  now: Date = new Date(),
): Promise<WeekOverview> {
  const week = resolveWeek(weekParam, now);
  const settings = await getCompanySettings();

  const plaatsingen = await ladenPlaatsingen(week.monday, week.sunday);
  const consultantIds = [...new Set(plaatsingen.map((p) => p.consultantId))];

  // Scans die (nog) geen week hebben omdat het uitlezen niet lukte: die mogen
  // niet onzichtbaar blijven hangen, dus ze komen bij "Niet gekoppeld" te staan.
  const nietUitgelezenVanaf = new Date(week.monday);
  nietUitgelezenVanaf.setDate(nietUitgelezenVanaf.getDate() - ZONDER_WEEK_DAGEN);

  // Alles wat in deze week binnenkwam of al vastligt.
  const [inboxItems, urenstaten, facturen, losseFacturen, zonderWeek] = await Promise.all([
    db.timesheetInbox.findMany({
      where: {
        status: { not: "REJECTED" },
        extractedWeekStart: { gte: week.monday, lte: week.sunday },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.timesheet.findMany({
      // Bereik i.p.v. exact: een maandag die ooit in een andere tijdzone is
      // opgeslagen (22:00 UTC de dag ervoor) moet óók als deze week tellen.
      where: { weekStart: { gte: rondMaandag(week.monday, -12), lte: rondMaandag(week.monday, 12) } },
      include: {
        entries: { select: { date: true, hours: true } },
        invoiceLine: { select: { invoice: { select: { id: true, number: true, status: true } } } },
      },
    }),
    db.receivedInvoice.findMany({
      where: {
        OR: [
          { weekKey: week.key },
          { periodStart: { lte: week.sunday }, periodEnd: { gte: week.monday } },
        ],
      },
      orderBy: { createdAt: "desc" },
    }),
    db.facturatieUpload.findMany({ orderBy: { createdAt: "desc" } }),
    db.timesheetInbox.findMany({
      where: {
        status: { in: OPENSTAAND },
        timesheetId: null,
        extractedWeekStart: null,
        createdAt: { gte: nietUitgelezenVanaf },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  // Historie voor de "wijkt af van zijn eigen gemiddelde"-controle.
  const historie = await db.timesheet.findMany({
    where: {
      placement: { consultantId: { in: consultantIds.length ? consultantIds : ["-"] } },
      status: { not: "DRAFT" },
      weekStart: { lt: week.monday },
    },
    select: {
      weekStart: true,
      placement: { select: { consultantId: true } },
      entries: { select: { hours: true } },
    },
    orderBy: { weekStart: "desc" },
    take: 400,
  });
  const historiePerPersoon = new Map<string, { weekStart: Date; hours: number }[]>();
  for (const h of historie) {
    const id = h.placement.consultantId;
    const lijst = historiePerPersoon.get(id) ?? [];
    lijst.push({ weekStart: h.weekStart, hours: round2(h.entries.reduce((s, e) => s + e.hours, 0)) });
    historiePerPersoon.set(id, lijst);
  }

  // Dagen die al op een ANDERE urenstaat van dezelfde persoon staan — de
  // dubbele-urenregistratie-controle. (Dezelfde dag, andere staat.)
  const dagRegels = await db.timesheetEntry.findMany({
    where: {
      date: { gte: week.monday, lte: week.sunday },
      timesheet: { placement: { consultantId: { in: consultantIds.length ? consultantIds : ["-"] } } },
    },
    select: {
      date: true,
      timesheet: { select: { id: true, placement: { select: { consultantId: true } } } },
    },
  });

  // Alle eerdere facturen per persoon — voor dubbel nummer / dubbele periode.
  const alleFacturen = await db.receivedInvoice.findMany({
    where: { consultantId: { in: consultantIds.length ? consultantIds : ["-"] } },
    select: { id: true, consultantId: true, number: true, periodStart: true, periodEnd: true },
  });

  const inboxPerConsultant = new Map<string, InboxRow[]>();
  const inboxZonderPersoon: InboxRow[] = [];
  for (const item of inboxItems as InboxRow[]) {
    if (!item.consultantId) {
      inboxZonderPersoon.push(item);
      continue;
    }
    const lijst = inboxPerConsultant.get(item.consultantId) ?? [];
    lijst.push(item);
    inboxPerConsultant.set(item.consultantId, lijst);
  }

  const urenstaatPerPlaatsing = new Map<string, TimesheetRow>();
  for (const t of urenstaten as TimesheetRow[]) urenstaatPerPlaatsing.set(t.placementId, t);

  const factuurPerConsultant = new Map<string, ReceivedRow>();
  for (const inv of facturen as ReceivedRow[]) {
    if (!factuurHoortBijWeek(inv, week)) continue;
    // Een expliciete weeksleutel wint van een periode-treffer.
    const bestaand = factuurPerConsultant.get(inv.consultantId);
    if (!bestaand || (inv.weekKey === week.key && bestaand.weekKey !== week.key)) {
      factuurPerConsultant.set(inv.consultantId, inv);
    }
  }

  // Aantekeningen (akkoord gegeven / fouten geaccepteerd) van deze week.
  const entityIds = plaatsingen.map((p) => weekEntityId(p.id, week.key));
  const notities = entityIds.length
    ? await db.activity.findMany({
        where: { entityType: FACTURATIE_ENTITY, entityId: { in: entityIds } },
        select: { entityId: true, sourceKey: true },
      })
    : [];
  const geaccepteerd = new Set(
    notities.filter((n) => n.sourceKey === ACCEPT_KEY).map((n) => n.entityId),
  );

  const company = { companyName: settings.companyName || "Q4S", aliases: ["Q4S", "Q4Solutions"] };

  const rows: WeekRow[] = [];
  const gebruikteInbox = new Set<string>();
  const gebruikteFactuur = new Set<string>();
  const plaatsingenPerConsultant = new Map<string, PlacementRow[]>();
  for (const p of plaatsingen) {
    const lijst = plaatsingenPerConsultant.get(p.consultantId) ?? [];
    lijst.push(p);
    plaatsingenPerConsultant.set(p.consultantId, lijst);
  }

  for (const p of plaatsingen) {
    const eigen = plaatsingenPerConsultant.get(p.consultantId) ?? [];
    const kandidaten = inboxPerConsultant.get(p.consultantId) ?? [];
    // Koppel de scan aan DEZE plaatsing als hij daar expliciet aan hangt, of als
    // de persoon maar één actieve plaatsing heeft (dan is er geen twijfel).
    const inbox =
      kandidaten.find((i) => i.placementId === p.id) ??
      (eigen.length === 1 ? (kandidaten.find((i) => !i.placementId) ?? kandidaten[0]) : null) ??
      null;
    if (inbox) gebruikteInbox.add(inbox.id);

    const urenstaat = urenstaatPerPlaatsing.get(p.id) ?? null;
    // Eén factuur hoort bij ÉÉN regel: werkt iemand op twee plaatsingen, dan komt
    // zijn factuur bij de regel waar ook zijn urenstaat/scan ligt — nooit dubbel.
    const mogelijkeFactuur = factuurPerConsultant.get(p.consultantId) ?? null;
    const factuur =
      mogelijkeFactuur &&
      !gebruikteFactuur.has(mogelijkeFactuur.id) &&
      (eigen.length === 1 || inbox || urenstaat)
        ? mogelijkeFactuur
        : null;
    if (factuur) gebruikteFactuur.add(factuur.id);

    const row = await beoordeelRij({
      placement: p,
      inbox,
      urenstaat,
      factuur,
      week,
      now,
      company,
      historie: historiePerPersoon.get(p.consultantId) ?? [],
      dagRegels,
      alleFacturen,
      geaccepteerd: geaccepteerd.has(weekEntityId(p.id, week.key)),
    });
    rows.push(row);
  }

  // Wie stuurde iets in zonder actieve plaatsing in deze week?
  const zonderPlaatsing = new Map<string, { inbox: InboxRow | null; factuur: ReceivedRow | null }>();
  for (const item of inboxItems as InboxRow[]) {
    if (!item.consultantId || gebruikteInbox.has(item.id)) continue;
    if (plaatsingenPerConsultant.has(item.consultantId)) continue;
    const huidig = zonderPlaatsing.get(item.consultantId) ?? { inbox: null, factuur: null };
    huidig.inbox ??= item;
    zonderPlaatsing.set(item.consultantId, huidig);
  }
  for (const inv of facturen as ReceivedRow[]) {
    if (!factuurHoortBijWeek(inv, week) || gebruikteFactuur.has(inv.id)) continue;
    if (plaatsingenPerConsultant.has(inv.consultantId)) continue;
    const huidig = zonderPlaatsing.get(inv.consultantId) ?? { inbox: null, factuur: null };
    huidig.factuur ??= inv;
    zonderPlaatsing.set(inv.consultantId, huidig);
  }
  if (zonderPlaatsing.size > 0) {
    const losse = await db.consultant.findMany({
      where: { id: { in: [...zonderPlaatsing.keys()] } },
    });
    for (const c of losse) {
      const bron = zonderPlaatsing.get(c.id);
      if (!bron) continue;
      rows.push(
        await beoordeelRij({
          placement: null,
          consultant: c,
          inbox: bron.inbox,
          urenstaat: null,
          factuur: bron.factuur,
          week,
          now,
          company,
          historie: [],
          dagRegels: [],
          alleFacturen,
          geaccepteerd: false,
        }),
      );
    }
  }

  const stats: WeekStats = {
    actief: plaatsingen.length,
    klaar: rows.filter((r) => r.status === "KLAAR").length,
    fout: rows.filter((r) => r.status === "FOUT").length,
    wacht: rows.filter((r) => r.status === "WACHT").length,
    nietIngeleverd: rows.filter((r) => r.status === "NIET_INGELEVERD").length,
  };

  const losseUploads: LosseUpload[] = [
    ...inboxZonderPersoon.map((i) => ({
      id: i.id,
      soort: "timesheet" as const,
      originalName: i.originalName,
      mimeType: i.mimeType,
      gelezenNaam: i.extractedName,
      reden: "De naam op de urenstaat hoort bij niemand (of bij meerdere mensen).",
      src: `/api/inbox/${i.id}`,
    })),
    // Scans waarvan de week niet uitgelezen is: zonder week kunnen ze nergens
    // staan, dus hier — anders raken ze stil kwijt.
    ...zonderWeek.map((i) => ({
      id: i.id,
      soort: "timesheet" as const,
      originalName: i.originalName,
      mimeType: i.mimeType,
      gelezenNaam: i.extractedName,
      reden:
        "De week is niet uit deze urenstaat te lezen — bekijk het bestand en voeg 'm opnieuw toe, of vul de uren handmatig in via de timesheet-inbox.",
      src: `/api/inbox/${i.id}`,
    })),
    ...losseFacturen
      .filter((f) => !f.weekKey || f.weekKey === week.key)
      .map((f) => ({
        id: f.id,
        soort: "factuur" as const,
        originalName: f.originalName,
        mimeType: f.mimeType,
        gelezenNaam: f.extractedName,
        reden: f.reason,
        src: `/api/facturatie-upload/${f.id}`,
      })),
  ];

  const personen = [...plaatsingenPerConsultant.values()]
    .map((lijst) => ({ id: lijst[0].consultantId, naam: naamVan(lijst[0].consultant) }))
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));

  return { week, rows, stats, losseUploads, personen };
}

/** Eén regel beoordelen: invoer samenstellen, de machine erop en samenvatten. */
async function beoordeelRij(args: {
  placement: PlacementRow | null;
  consultant?: PlacementRow["consultant"];
  inbox: InboxRow | null;
  urenstaat: TimesheetRow | null;
  factuur: ReceivedRow | null;
  week: WeekSlotInfo;
  now: Date;
  company: { companyName: string; aliases: string[] };
  historie: { weekStart: Date; hours: number }[];
  dagRegels: { date: Date; timesheet: { id: string; placement: { consultantId: string } } }[];
  alleFacturen: {
    id: string;
    consultantId: string;
    number: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
  }[];
  geaccepteerd: boolean;
}): Promise<WeekRow> {
  const { placement: p, inbox, urenstaat, factuur, week, now, company } = args;
  const consultant = p?.consultant ?? args.consultant;
  if (!consultant) throw new Error("Geen medewerker bij deze regel.");
  const consultantId = p?.consultantId ?? consultant.id;

  const input = bouwCheckInput({
    week,
    now,
    company,
    consultant,
    placement: p ? termsVan(p) : null,
    inbox,
    urenstaat,
    factuur,
    historie: args.historie,
    dagRegels: args.dagRegels,
    alleFacturen: args.alleFacturen,
    consultantId,
    geaccepteerd: args.geaccepteerd,
  });

  const result = beoordeelMetPlaatsing(input, p);
  const isZZP = (consultant.employmentType ?? "").toUpperCase() === "ZZP";
  const uren = input.timesheet
    ? round2(
        input.timesheet.days.reduce((s, d) => s + (Number.isFinite(d.hours) ? d.hours : 0), 0),
      )
    : null;
  const verkoop = urenstaat?.invoiceLine?.invoice ?? null;

  return {
    key: p?.id ?? `los-${consultantId}`,
    placementId: p?.id ?? null,
    consultantId,
    naam: naamVan(consultant),
    klantNaam: p?.client?.companyName ?? null,
    locatie: p?.workLocation ?? null,
    employmentType: consultant.employmentType,
    isZZP,
    inboxId: inbox?.id ?? null,
    timesheetId: urenstaat?.id ?? null,
    receivedInvoiceId: factuur?.id ?? null,
    vastgelegd: Boolean(urenstaat && VASTGELEGD.includes(urenstaat.status)),
    gefactureerd: Boolean(verkoop),
    verkoopFactuurId: verkoop?.id ?? null,
    verkoopFactuurNummer: verkoop?.number ?? null,
    wachtkamerSinds: inbox?.wachtkamerSince ?? null,
    timesheetOntvangen: input.timesheet !== null,
    factuurOntvangen: input.invoice !== null,
    factuurNvt: !isZZP,
    uren,
    status: result.status,
    problemen: result.checks
      .filter((c) => c.level === "error")
      .slice(0, 3)
      .map((c) => c.title),
    aantalControles: result.checks.length,
    aantalFouten: result.checks.filter((c) => c.level === "error").length,
    aantalWaarschuwingen: result.checks.filter((c) => c.level === "warn").length,
    geaccepteerd: args.geaccepteerd,
    href: p ? `/facturatie/${p.id}/${week.key}` : null,
  };
}

/** De volledige invoer voor de controle-machine, uit wat er opgehaald is. */
function bouwCheckInput(args: {
  week: WeekSlotInfo;
  now: Date;
  company: { companyName: string; aliases: string[] };
  consultant: PlacementRow["consultant"];
  placement: PlacementTerms | null;
  inbox: InboxRow | null;
  urenstaat: TimesheetRow | null;
  factuur: ReceivedRow | null;
  historie: { weekStart: Date; hours: number }[];
  dagRegels: { date: Date; timesheet: { id: string; placement: { consultantId: string } } }[];
  alleFacturen: {
    id: string;
    consultantId: string;
    number: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
  }[];
  consultantId: string;
  geaccepteerd: boolean;
}): FacturatieCheckInput {
  const { week, consultantId } = args;
  const samenvatting = summarizeRecentWeeks(args.historie, { before: week.monday });

  // Dagen van deze persoon die op een ANDERE urenstaat staan dan die van deze week.
  const andereDagen = args.dagRegels
    .filter(
      (e) =>
        e.timesheet.placement.consultantId === consultantId &&
        e.timesheet.id !== args.urenstaat?.id,
    )
    .map(
      (e) =>
        `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}-${String(e.date.getDate()).padStart(2, "0")}`,
    );

  return {
    weekKey: week.key,
    weekMonday: week.monday,
    now: args.now,
    company: args.company,
    consultant: {
      firstName: args.consultant.firstName,
      lastName: args.consultant.lastName,
      employmentType: args.consultant.employmentType,
      iban: args.consultant.iban,
      kvkNumber: args.consultant.kvkNumber,
      vatNumber: args.consultant.vatNumber,
      companyName: args.consultant.companyName,
    },
    placement: args.placement,
    timesheet: timesheetExtractionVan({
      inbox: args.inbox,
      timesheet: args.urenstaat,
      monday: week.monday,
    }),
    invoice: invoiceExtractionVan(args.factuur),
    prior: {
      otherTimesheetDays: [...new Set(andereDagen)],
      priorInvoices: args.alleFacturen
        .filter((q) => q.consultantId === consultantId && q.id !== args.factuur?.id)
        .map((q) => ({ number: q.number, periodStart: q.periodStart, periodEnd: q.periodEnd })),
      recentAvgHours: samenvatting.recentAvgHours,
      recentWeeks: samenvatting.recentWeeks,
    },
    acceptedErrors: args.geaccepteerd,
  };
}

// ===========================================================================
// getWeekDossier
// ===========================================================================

export type WeekDocument = {
  src: string;
  originalName: string;
  mimeType: string | null;
};

export type DossierInvoer = {
  /** Ma t/m zo, als tekst zoals het formulier ze aanlevert. */
  dagUren: string[];
  overuren: string;
  kilometers: string;
  factuurNummer: string;
  factuurDatum: string;
  factuurPeriodeStart: string;
  factuurPeriodeEind: string;
  factuurUren: string;
  factuurTarief: string;
  factuurOveruren: string;
  /** Bedrag INCL. btw, zoals ReceivedInvoice het bewaart. */
  factuurBedrag: string;
  factuurBtw: string;
  factuurKilometers: string;
};

export type WeekDossier = {
  week: WeekSlotInfo;
  row: WeekRow;
  checks: Check[];
  comparison: ComparisonRow[];
  /** Controle-id's waarvoor al "Akkoord" is gegeven. */
  akkoorden: string[];
  /** De reden waarmee de fouten geaccepteerd zijn; null = niet geaccepteerd. */
  accepteerReden: string | null;
  timesheetDoc: WeekDocument | null;
  factuurDoc: WeekDocument | null;
  mail: {
    sender: string | null;
    subject: string | null;
    receivedAt: Date | null;
    notes: string | null;
  } | null;
  invoer: DossierInvoer;
  /** De dagen van de week, voor de labels boven de invoervelden. */
  dagen: { iso: string; label: string; weekend: boolean }[];
  geld: { uren: number; verkoop: number; inkoop: number; marge: number } | null;
  /** Mag de akkoord-knop aan? Zo niet: waarom niet. */
  akkoordGeblokkeerd: string | null;
};

const DAG_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/** Date → "YYYY-MM-DD" voor een date-input. */
function datumVeld(d: Date | null | undefined): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Getal → "8,5" (NL-notatie), 0/null → "". */
function getalVeld(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "";
  return String(round2(value)).replace(".", ",");
}

/**
 * Alles voor de dossierpagina van één plaatsing in één week: het document, de
 * controles, de vergelijkingstabel, de al gegeven akkoorden en de velden die
 * inline te corrigeren zijn. Geeft `null` als de plaatsing niet bestaat.
 */
export async function getWeekDossier(
  placementId: string,
  weekParam: string,
  now: Date = new Date(),
): Promise<WeekDossier | null> {
  const week = resolveWeek(weekParam, now);
  const p = await db.placement.findUnique({
    where: { id: placementId },
    include: {
      consultant: true,
      client: { select: { id: true, companyName: true } },
    },
  });
  if (!p) return null;

  const settings = await getCompanySettings();
  const company = { companyName: settings.companyName || "Q4S", aliases: ["Q4S", "Q4Solutions"] };

  const [inboxItems, urenstaat, facturen, alleFacturen, historieRaw, dagRegels, notities] =
    await Promise.all([
      db.timesheetInbox.findMany({
        where: {
          status: { not: "REJECTED" },
          consultantId: p.consultantId,
          extractedWeekStart: { gte: week.monday, lte: week.sunday },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.timesheet.findUnique({
        where: { placementId_weekStart: { placementId: p.id, weekStart: week.monday } },
        include: {
          entries: { select: { date: true, hours: true } },
          invoiceLine: { select: { invoice: { select: { id: true, number: true, status: true } } } },
        },
      }),
      db.receivedInvoice.findMany({
        where: {
          consultantId: p.consultantId,
          OR: [
            { weekKey: week.key },
            { periodStart: { lte: week.sunday }, periodEnd: { gte: week.monday } },
          ],
        },
        orderBy: { createdAt: "desc" },
      }),
      db.receivedInvoice.findMany({
        where: { consultantId: p.consultantId },
        select: { id: true, consultantId: true, number: true, periodStart: true, periodEnd: true },
      }),
      db.timesheet.findMany({
        where: {
          placement: { consultantId: p.consultantId },
          status: { not: "DRAFT" },
          weekStart: { lt: week.monday },
        },
        select: { weekStart: true, entries: { select: { hours: true } } },
        orderBy: { weekStart: "desc" },
        take: 20,
      }),
      db.timesheetEntry.findMany({
        where: {
          date: { gte: week.monday, lte: week.sunday },
          timesheet: { placement: { consultantId: p.consultantId } },
        },
        select: {
          date: true,
          timesheet: { select: { id: true, placement: { select: { consultantId: true } } } },
        },
      }),
      db.activity.findMany({
        where: { entityType: FACTURATIE_ENTITY, entityId: weekEntityId(p.id, week.key) },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const inbox =
    (inboxItems as InboxRow[]).find((i) => i.placementId === p.id) ??
    (inboxItems as InboxRow[])[0] ??
    null;
  const factuur =
    (facturen as ReceivedRow[]).find((f) => f.weekKey === week.key) ??
    (facturen as ReceivedRow[]).find((f) => factuurHoortBijWeek(f, week)) ??
    null;

  const accepteerNotitie = notities.find((n) => n.sourceKey === ACCEPT_KEY) ?? null;
  const akkoorden = notities
    .filter((n) => n.sourceKey?.startsWith(ACK_PREFIX))
    .map((n) => n.sourceKey!.slice(ACK_PREFIX.length));

  const historie = historieRaw.map((h) => ({
    weekStart: h.weekStart,
    hours: round2(h.entries.reduce((s, e) => s + e.hours, 0)),
  }));

  const row = await beoordeelRij({
    placement: p,
    inbox,
    urenstaat: (urenstaat as TimesheetRow | null) ?? null,
    factuur,
    week,
    now,
    company,
    historie,
    dagRegels,
    alleFacturen,
    geaccepteerd: Boolean(accepteerNotitie),
  });

  const input = bouwCheckInput({
    week,
    now,
    company,
    consultant: p.consultant,
    placement: termsVan(p),
    inbox,
    urenstaat: (urenstaat as TimesheetRow | null) ?? null,
    factuur,
    historie,
    dagRegels,
    alleFacturen,
    consultantId: p.consultantId,
    geaccepteerd: Boolean(accepteerNotitie),
  });
  const result = beoordeelMetPlaatsing(input, p);

  // De dagvelden: een al vastgelegde urenstaat wint, dan de handmatige correctie,
  // dan de AI-uitlezing — exact dezelfde rangorde als de controle-machine ziet.
  const dagUren = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const iso = isoDag(week.monday, i);
    const dag = input.timesheet?.days.find((d) => d.date === iso);
    return dag ? getalVeld(dag.hours) : "";
  });

  // Dezelfde dagregels als de controle-machine gebruikt (timesheetEntries), zodat
  // het weekbedrag op het scherm nooit kan afwijken van waar de controle op afging.
  const geld = computeTimesheetMoney(
    {
      entries: timesheetEntries(input.timesheet?.days ?? [], week.monday),
      overtimeHours: input.timesheet?.overtimeHours ?? null,
      kilometers: input.timesheet?.kilometers ?? null,
    },
    termsVan(p),
  );

  const factuurRaw = leesJson(factuur?.extractedJson ?? null);

  const fouten = result.checks.filter((c) => c.level === "error");
  const onvolledig = result.checks.find((c) => c.id === "contract-compleet");
  const akkoordGeblokkeerd =
    row.gefactureerd && row.verkoopFactuurNummer
      ? `Deze week staat al op verkoopfactuur ${row.verkoopFactuurNummer} — er wordt niets dubbel gefactureerd.`
      : onvolledig
        ? onvolledig.detail
      : fouten.length > 0 && !accepteerNotitie
        ? `Er ${fouten.length === 1 ? "is 1 fout" : `zijn ${fouten.length} fouten`} die eerst opgelost of bewust geaccepteerd moet${fouten.length === 1 ? "" : "en"} worden.`
        : !input.timesheet
          ? "Er is nog geen urenstaat voor deze week ontvangen."
          : null;

  return {
    week,
    row,
    checks: result.checks,
    comparison: result.comparison,
    akkoorden,
    accepteerReden: accepteerNotitie?.body ?? null,
    timesheetDoc: inbox
      ? { src: `/api/inbox/${inbox.id}`, originalName: inbox.originalName, mimeType: inbox.mimeType }
      : null,
    factuurDoc:
      factuur?.fileName
        ? {
            src: `/api/ontvangen-factuur/${factuur.id}`,
            originalName: factuur.originalName ?? factuur.fileName,
            mimeType: factuur.mimeType,
          }
        : null,
    mail: inbox
      ? {
          sender: inbox.senderEmail,
          subject: inbox.emailSubject,
          receivedAt: inbox.receivedAt ?? inbox.createdAt,
          notes: factuur?.notes ?? null,
        }
      : null,
    invoer: {
      dagUren,
      overuren: getalVeld(input.timesheet?.overtimeHours ?? null),
      kilometers: getalVeld(input.timesheet?.kilometers ?? null),
      factuurNummer: factuur?.number ?? "",
      factuurDatum: datumVeld(factuur?.issueDate),
      factuurPeriodeStart: datumVeld(factuur?.periodStart),
      factuurPeriodeEind: datumVeld(factuur?.periodEnd),
      factuurUren: getalVeld(getal(factuurRaw.hours)),
      factuurTarief: getalVeld(getal(factuurRaw.hourlyRate)),
      factuurOveruren: getalVeld(getal(factuurRaw.overtimeHours)),
      factuurBedrag: getalVeld(factuur?.amount ?? null),
      factuurBtw: getalVeld(factuur?.vatAmount ?? null),
      factuurKilometers: getalVeld(factuur?.kilometers ?? null),
    },
    dagen: [0, 1, 2, 3, 4, 5, 6].map((i) => ({
      iso: isoDag(week.monday, i),
      label: DAG_LABELS[i],
      weekend: i >= 5,
    })),
    geld: {
      uren: geld.hours,
      verkoop: geld.sell.total,
      inkoop: geld.buy.total,
      marge: geld.margin,
    },
    akkoordGeblokkeerd,
  };
}

/** De weeksleutel van een datum — handig voor de acties. */
export function weekKeyVan(date: Date): string | null {
  return weekKeyVanDatum(datumVeld(date));
}

/** De eerstvolgende openstaande inbox-scan van deze persoon in deze week. */
export async function openstaandeScan(
  consultantId: string,
  week: WeekSlotInfo,
): Promise<{ id: string } | null> {
  return db.timesheetInbox.findFirst({
    where: {
      consultantId,
      status: { in: OPENSTAAND },
      timesheetId: null,
      extractedWeekStart: { gte: week.monday, lte: week.sunday },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
}
