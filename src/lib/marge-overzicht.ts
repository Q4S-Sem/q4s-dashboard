// Marge-overzicht — PURE rekenfuncties, GEEN database.
// De pagina haalt de gefactureerde uren met Prisma op en geeft ze als gewone
// arrays door; hier wordt alleen gerekend. Eén vraag staat centraal: waar
// verdienen we, en waar staat de marge onder druk — per klant en per freelancer.
//
// De rekenregel is dezelfde als elders in de app: de marge van een plaatsing is
// verkooptarief − inkooptarief (Placement.chargeRate − Placement.costRate), maal
// de gefactureerde uren. Er wordt hier GEEN nieuwe factuurwiskunde bedacht:
// toeslagen en kilometers horen niet bij het uurtarief en blijven buiten deze
// regels (de pagina levert alleen uren-regels aan).
//
// Alleen-lezen: dit bestand kan niets muteren, versturen of van status wisselen.

import { round2 } from "./utils";

// ---------- Invoer (platte, al opgehaalde records) ----------

/** Eén gefactureerde uren-regel met het tarievenpaar van zijn plaatsing. */
export type MargeRegel = {
  clientId: string;
  clientName: string;
  consultantId: string;
  consultantName: string;
  /** Gefactureerde uren op deze regel. */
  hours: number;
  /** Wat Q4S de freelancer per uur betaalt (ex btw). */
  costRate: number;
  /** Wat Q4S de klant per uur rekent (ex btw). */
  chargeRate: number;
};

/** Nederlandse labels bij elke kolom/KPI — de pagina toont deze letterlijk. */
export const MARGE_LABELS = {
  client: "Klant",
  freelancer: "Freelancer",
  freelancers: "Freelancers",
  clients: "Klanten",
  hours: "Uren",
  marginPerHour: "Marge per uur",
  totalMargin: "Marge totaal",
  avgMarginPerHour: "Gemiddelde marge per uur",
  bestClient: "Beste klant",
  worstClient: "Laagste marge per uur",
  belowNorm: "Onder druk",
  norm: "Marge-norm per uur",
} as const;

export type MargeLabels = typeof MARGE_LABELS;

// ---------- Hulpjes ----------

/** Marge van één regel = uren × (verkoop − inkoop). */
function marginOf(row: MargeRegel): number {
  return row.hours * (row.chargeRate - row.costRate);
}

/** Marge per uur = totale marge ÷ uren; zonder uren 0 (nooit NaN of ∞). */
function perHour(totalMargin: number, hours: number): number {
  if (hours === 0) return 0;
  return round2(totalMargin / hours);
}

/** Namen vergelijken zoals een Nederlandse lijst ze sorteert. */
function byName(a: string, b: string): number {
  return a.localeCompare(b, "nl");
}

/** Een norm telt alleen als het een echt getal is; anders "geen norm opgegeven". */
function normOrNull(norm: number | null | undefined): number | null {
  return typeof norm === "number" && Number.isFinite(norm) ? norm : null;
}

// ---------- Marge per klant ----------

export type ClientMargin = {
  clientId: string;
  clientName: string;
  /** Aantal verschillende freelancers dat hier uren schreef. */
  freelancers: number;
  hours: number;
  /** GEWOGEN marge per uur (totale marge ÷ totale uren), dus niet het
   *  gemiddelde van de losse regels — een grote plaatsing weegt zwaarder. */
  marginPerHour: number;
  totalMargin: number;
  /** Marge onder druk: met een norm zodra de marge per uur STRIKT onder die
   *  norm ligt; zonder norm zodra er per uur niets (meer) overblijft (≤ 0). */
  belowNorm: boolean;
};

/**
 * Marge per klant, aflopend op totale marge. Bij gelijke marge wint de klant met
 * de meeste uren; blijft het gelijk, dan de klantnaam (alfabetisch).
 *
 * @param norm Marge-norm per uur. Wordt door de aanroeper meegegeven — er staat
 *             hier bewust geen bedrag hard in de code. Zonder norm geldt ≤ 0.
 */
export function marginPerClient(rows: MargeRegel[], norm?: number | null): ClientMargin[] {
  const limit = normOrNull(norm);
  const map = new Map<
    string,
    { clientId: string; clientName: string; hours: number; totalMargin: number; consultants: Set<string> }
  >();

  for (const row of rows) {
    let entry = map.get(row.clientId);
    if (!entry) {
      entry = {
        clientId: row.clientId,
        clientName: row.clientName,
        hours: 0,
        totalMargin: 0,
        consultants: new Set<string>(),
      };
      map.set(row.clientId, entry);
    }
    entry.hours += row.hours;
    entry.totalMargin += marginOf(row);
    entry.consultants.add(row.consultantId);
  }

  return [...map.values()]
    .map((e) => {
      const hours = round2(e.hours);
      const totalMargin = round2(e.totalMargin);
      const marginPerHour = perHour(totalMargin, hours);
      return {
        clientId: e.clientId,
        clientName: e.clientName,
        freelancers: e.consultants.size,
        hours,
        marginPerHour,
        totalMargin,
        belowNorm: limit === null ? marginPerHour <= 0 : marginPerHour < limit,
      };
    })
    .sort(
      (a, b) =>
        b.totalMargin - a.totalMargin ||
        b.hours - a.hours ||
        byName(a.clientName, b.clientName) ||
        byName(a.clientId, b.clientId),
    );
}

// ---------- Marge per freelancer ----------

export type FreelancerMargin = {
  consultantId: string;
  consultantName: string;
  /** Aantal verschillende klanten waar deze freelancer uren schreef. */
  clients: number;
  hours: number;
  /** Gemiddelde marge per uur, gewogen over de uren. */
  marginPerHour: number;
  totalMargin: number;
};

/**
 * Marge per freelancer, aflopend op totale marge. Bij gelijke marge wint de
 * meeste uren; blijft het gelijk, dan de naam (alfabetisch).
 */
export function marginPerFreelancer(rows: MargeRegel[]): FreelancerMargin[] {
  const map = new Map<
    string,
    { consultantId: string; consultantName: string; hours: number; totalMargin: number; clients: Set<string> }
  >();

  for (const row of rows) {
    let entry = map.get(row.consultantId);
    if (!entry) {
      entry = {
        consultantId: row.consultantId,
        consultantName: row.consultantName,
        hours: 0,
        totalMargin: 0,
        clients: new Set<string>(),
      };
      map.set(row.consultantId, entry);
    }
    entry.hours += row.hours;
    entry.totalMargin += marginOf(row);
    entry.clients.add(row.clientId);
  }

  return [...map.values()]
    .map((e) => {
      const hours = round2(e.hours);
      const totalMargin = round2(e.totalMargin);
      return {
        consultantId: e.consultantId,
        consultantName: e.consultantName,
        clients: e.clients.size,
        hours,
        marginPerHour: perHour(totalMargin, hours),
        totalMargin,
      };
    })
    .sort(
      (a, b) =>
        b.totalMargin - a.totalMargin ||
        b.hours - a.hours ||
        byName(a.consultantName, b.consultantName) ||
        byName(a.consultantId, b.consultantId),
    );
}

// ---------- Totaalbeeld ----------

export type MarginSummary = {
  clients: number;
  freelancers: number;
  hours: number;
  totalMargin: number;
  /** Gewogen marge per uur over álle regels samen. */
  avgMarginPerHour: number;
  /** Aantal klanten dat onder de norm zit (zie ClientMargin.belowNorm). */
  belowNormCount: number;
  /** Hoogste/laagste marge per uur — alleen klanten MET uren doen mee, want
   *  zonder uren valt er geen marge per uur te vergelijken. */
  bestClient: ClientMargin | null;
  worstClient: ClientMargin | null;
};

export function overallMarginSummary(rows: MargeRegel[], norm?: number | null): MarginSummary {
  const perClient = marginPerClient(rows, norm);
  const perFreelancer = marginPerFreelancer(rows);

  const hours = round2(perClient.reduce((s, c) => s + c.hours, 0));
  const totalMargin = round2(perClient.reduce((s, c) => s + c.totalMargin, 0));

  // Alleen klanten met uren kunnen "de beste" of "de zwakste" zijn.
  const rated = perClient.filter((c) => c.hours > 0);

  // Beste: hoogste marge per uur; gelijk → de grootste totale marge; dan de naam.
  const best = [...rated].sort(
    (a, b) =>
      b.marginPerHour - a.marginPerHour ||
      b.totalMargin - a.totalMargin ||
      byName(a.clientName, b.clientName) ||
      byName(a.clientId, b.clientId),
  )[0];
  // Zwakste: laagste marge per uur; gelijk → de kleinste totale marge; dan de naam.
  const worst = [...rated].sort(
    (a, b) =>
      a.marginPerHour - b.marginPerHour ||
      a.totalMargin - b.totalMargin ||
      byName(a.clientName, b.clientName) ||
      byName(a.clientId, b.clientId),
  )[0];

  return {
    clients: perClient.length,
    freelancers: perFreelancer.length,
    hours,
    totalMargin,
    avgMarginPerHour: perHour(totalMargin, hours),
    belowNormCount: perClient.filter((c) => c.belowNorm).length,
    bestClient: best ?? null,
    worstClient: worst ?? null,
  };
}

// ---------- Samenstelling ----------

export type MargeOverzicht = {
  /** De gebruikte marge-norm per uur, of null als er geen norm meekwam. */
  norm: number | null;
  perClient: ClientMargin[];
  perFreelancer: FreelancerMargin[];
  summary: MarginSummary;
  labels: MargeLabels;
};

/** Alle marge-overzichten in één keer, uit al opgehaalde regels. */
export function buildMargeOverzicht({
  rows,
  norm,
}: {
  rows: MargeRegel[];
  norm?: number | null;
}): MargeOverzicht {
  return {
    norm: normOrNull(norm),
    perClient: marginPerClient(rows, norm),
    perFreelancer: marginPerFreelancer(rows),
    summary: overallMarginSummary(rows, norm),
    labels: MARGE_LABELS,
  };
}
