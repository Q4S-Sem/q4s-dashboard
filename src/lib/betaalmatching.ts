// Betaalmatching / cashflow-bescherming — PURE rekenfuncties, GEEN database.
// De pagina haalt de facturen met Prisma op en geeft ze als gewone arrays door;
// hier wordt alleen gekoppeld en geteld. Eén vraag staat centraal: mag Q4S deze
// freelancer al uitbetalen, oftewel heeft de KLANT de bijbehorende verkoopfactuur
// al betaald?
//
// Dit vult src/lib/betaalmonitor.ts aan: dáár staat wat er in- en uitgaat en wat
// te laat is, hier staat de KOPPELING tussen die twee kanten. Er wordt geen
// betaalgegeven verzonnen die het datamodel niet heeft: betaald/openstaand komt
// puur uit Invoice.status + paidDate + dueDate, en de uitbetaalverplichting uit
// de inkoopfactuur (PurchaseInvoice) of de zelf gestuurde factuur van de ZZP'er
// (ReceivedInvoice).
//
// ALLEEN-LEZEN SIGNALERING: dit bestand kan niets muteren, versturen of betalen.
// Het geeft een advies; de mens beslist en betaalt.

import type { BadgeColor } from "./domain";
import { formatCurrency, round2 } from "./utils";

// ---------- Invoer (platte, al opgehaalde records) ----------

/** Eén verkoopfactuur (Q4S → klant) met de plaatsingen/freelancers erachter. */
export type VerkoopFactuur = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  /** DRAFT | SENT | PAID | OVERDUE | CANCELLED (zie INVOICE_STATUSES). */
  status: string;
  total: number;
  issueDate: Date;
  dueDate: Date;
  paidDate: Date | null;
  /** Plaatsingen waarop deze factuur uren rekent (InvoiceLine.placementId). */
  placementIds: string[];
  /** De freelancers achter die plaatsingen (Placement.consultantId). */
  consultantIds: string[];
};

/** Eén openstaande verplichting van Q4S aan een freelancer: een inkoopfactuur
 *  (self-billing) of de factuur die de ZZP'er zelf stuurde. */
export type Uitbetaalverplichting = {
  id: string;
  soort: "inkoopfactuur" | "ontvangen-factuur";
  /** Factuurnummer; een ontvangen factuur heeft er niet altijd één. */
  number: string | null;
  consultantId: string;
  consultantName: string;
  /** Plaatsingen op de regels (PurchaseInvoiceLine.placementId). Een ontvangen
   *  factuur heeft geen regels → leeg, dan koppelen we op de freelancer. */
  placementIds: string[];
  /** Wat Q4S deze persoon moet betalen (incl. btw, zoals op de factuur). */
  amount: number;
  betaald: boolean;
};

// ---------- Buckets + Nederlandse labels ----------

export type FactuurBucket = "betaald" | "open" | "teLaat";

export type VrijgaveBucket =
  | "vrijgeven"
  | "wachtOpKlant"
  | "klantTeLaat"
  | "nietGekoppeld"
  | "alBetaald";

/** Nederlandse labels — de pagina toont deze letterlijk. */
export const BETAALMATCHING_LABELS = {
  betaald: "Betaald",
  open: "Openstaand",
  teLaat: "Te laat",
  vrijgeven: "Vrijgeven",
  wachtOpKlant: "Wacht op klant",
  klantTeLaat: "Klant te laat",
  nietGekoppeld: "Niet gekoppeld",
  alBetaald: "Al uitbetaald",
  invoice: "Factuurnr.",
  client: "Klant",
  amount: "Bedrag",
  status: "Status",
  days: "Dagen",
  freelancer: "Freelancer",
  obligation: "Uitbetaling",
  release: "Uitbetalen?",
  linkedInvoices: "Gekoppelde verkoopfactuur",
  cashflowNote:
    "Cashflow-bescherming: Q4S betaalt een freelancer pas nadat de klant de bijbehorende verkoopfactuur heeft betaald.",
} as const;

export type BetaalmatchingLabels = typeof BETAALMATCHING_LABELS;

export const FACTUUR_BUCKET_LABEL: Record<FactuurBucket, string> = {
  betaald: BETAALMATCHING_LABELS.betaald,
  open: BETAALMATCHING_LABELS.open,
  teLaat: BETAALMATCHING_LABELS.teLaat,
};

export const VRIJGAVE_LABEL: Record<VrijgaveBucket, string> = {
  vrijgeven: BETAALMATCHING_LABELS.vrijgeven,
  wachtOpKlant: BETAALMATCHING_LABELS.wachtOpKlant,
  klantTeLaat: BETAALMATCHING_LABELS.klantTeLaat,
  nietGekoppeld: BETAALMATCHING_LABELS.nietGekoppeld,
  alBetaald: BETAALMATCHING_LABELS.alBetaald,
};

export const FACTUUR_BUCKET_KLEUR: Record<FactuurBucket, BadgeColor> = {
  betaald: "green",
  open: "amber",
  teLaat: "red",
};

export const VRIJGAVE_KLEUR: Record<VrijgaveBucket, BadgeColor> = {
  vrijgeven: "green",
  wachtOpKlant: "amber",
  klantTeLaat: "red",
  nietGekoppeld: "violet",
  alBetaald: "slate",
};

export const SOORT_LABEL: Record<Uitbetaalverplichting["soort"], string> = {
  inkoopfactuur: "Inkoopfactuur",
  "ontvangen-factuur": "Ontvangen factuur",
};

// ---------- Hulpjes ----------

function startOfUtcDay(date: Date): Date {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Hele kalenderdagen tussen twee momenten (UTC), zoals elders in de app. */
function daysBetween(from: Date, to: Date): number {
  return Math.floor((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / 86_400_000);
}

function byName(a: string, b: string): number {
  return a.localeCompare(b, "nl");
}

const FACTUUR_VOLGORDE: Record<FactuurBucket, number> = { teLaat: 0, open: 1, betaald: 2 };

// Risico eerst: wat je NIET mag betalen staat bovenaan, wat af is onderaan.
const VRIJGAVE_VOLGORDE: Record<VrijgaveBucket, number> = {
  klantTeLaat: 0,
  wachtOpKlant: 1,
  nietGekoppeld: 2,
  vrijgeven: 3,
  alBetaald: 4,
};

function facturen(n: number): string {
  return n === 1 ? "verkoopfactuur" : "verkoopfacturen";
}

// ---------- Verkoopfacturen: heeft de klant betaald? ----------

export type FactuurStatus = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  status: string;
  total: number;
  dueDate: Date;
  paidDate: Date | null;
  bucket: FactuurBucket;
  /** Nederlands label bij de bucket. */
  label: string;
  betaald: boolean;
  /** Hele dagen dat de factuur openstond/-staat: factuurdatum → betaaldatum, of
   *  → vandaag als er nog niet betaald is. Nooit negatief. */
  dagenOpen: number;
  /** Hele dagen ná de vervaldatum (0 zolang die niet verstreken is). Bij een
   *  betaalde factuur gemeten tot de betaaldatum: hoe laat betaalde de klant. */
  dagenTeLaat: number;
};

/**
 * Zet elke verkoopfactuur in precies één bucket en bereken hoe lang hij openstaat.
 *
 * De regels, puur uit het datamodel (er wordt geen betaling verzonnen):
 *   - status PAID                         → "betaald"  (paidDate = wanneer)
 *   - status OVERDUE óf vervaldatum voorbij → "teLaat"
 *   - anders                              → "open"
 *
 * Geannuleerde facturen (CANCELLED) tellen niet mee: daar valt niets te innen,
 * en ze mogen dus ook geen uitbetaling blokkeren.
 */
export function matchClientPayments({
  salesInvoices,
  now,
}: {
  salesInvoices: VerkoopFactuur[];
  now: Date;
}): FactuurStatus[] {
  return salesInvoices
    .filter((inv) => inv.status !== "CANCELLED")
    .map((inv) => {
      const betaald = inv.status === "PAID";
      // Betaald → tot de betaaldatum (valt die weg, dan tot vandaag).
      const tot = betaald ? (inv.paidDate ?? now) : now;
      const dagenOpen = Math.max(0, daysBetween(inv.issueDate, tot));
      const dagenTeLaat = Math.max(0, daysBetween(inv.dueDate, tot));
      const bucket: FactuurBucket = betaald
        ? "betaald"
        : inv.status === "OVERDUE" || dagenTeLaat > 0
          ? "teLaat"
          : "open";

      return {
        id: inv.id,
        number: inv.number,
        clientId: inv.clientId,
        clientName: inv.clientName,
        status: inv.status,
        total: round2(inv.total),
        dueDate: inv.dueDate,
        paidDate: inv.paidDate,
        bucket,
        label: FACTUUR_BUCKET_LABEL[bucket],
        betaald,
        dagenOpen,
        dagenTeLaat,
      };
    })
    .sort(
      (a, b) =>
        FACTUUR_VOLGORDE[a.bucket] - FACTUUR_VOLGORDE[b.bucket] ||
        b.dagenTeLaat - a.dagenTeLaat ||
        b.dagenOpen - a.dagenOpen ||
        byName(a.number, b.number) ||
        byName(a.id, b.id),
    );
}

// ---------- Uitbetalen: mag deze freelancer al geld zien? ----------

/** Compacte verwijzing naar een gekoppelde verkoopfactuur, voor de uitleg. */
export type GekoppeldeFactuur = {
  id: string;
  number: string;
  clientName: string;
  total: number;
  bucket: FactuurBucket;
  label: string;
  dagenTeLaat: number;
};

export type VrijgaveRegel = {
  id: string;
  soort: Uitbetaalverplichting["soort"];
  soortLabel: string;
  number: string | null;
  consultantId: string;
  consultantName: string;
  amount: number;
  betaald: boolean;
  bucket: VrijgaveBucket;
  /** Nederlands label bij de bucket. */
  label: string;
  /** Uitlegbare reden in één zin — de pagina toont deze letterlijk. */
  toelichting: string;
  /** Hoe de koppeling gelegd is: via de plaatsing, via de freelancer, of niet. */
  gekoppeldVia: "plaatsing" | "freelancer" | "geen";
  facturen: GekoppeldeFactuur[];
};

function compact(f: FactuurStatus): GekoppeldeFactuur {
  return {
    id: f.id,
    number: f.number,
    clientName: f.clientName,
    total: f.total,
    bucket: f.bucket,
    label: f.label,
    dagenTeLaat: f.dagenTeLaat,
  };
}

/**
 * Per uitbetaalverplichting: mag Q4S deze al betalen?
 *
 * Koppelen gebeurt zo specifiek mogelijk: eerst op PLAATSING (de inkoopregel en
 * de verkoopregel wijzen naar dezelfde placementId), en pas als dat niets
 * oplevert op de FREELANCER (consultantId) — een zelf gestuurde ZZP-factuur kent
 * namelijk geen regels met een plaatsing.
 *
 * Daarna beslist de voorzichtigste van de gekoppelde facturen:
 *   - al uitbetaald                        → "alBetaald"   (niets meer te doen)
 *   - geen enkele gekoppelde verkoopfactuur → "nietGekoppeld" (eerst uitzoeken)
 *   - één ervan is te laat                  → "klantTeLaat" (eerst innen)
 *   - ALLE gekoppelde facturen zijn betaald → "vrijgeven"
 *   - anders                                → "wachtOpKlant"
 *
 * `vrijgeven` vraagt bewust dat élke gekoppelde factuur binnen is: één openstaande
 * factuur ertussen betekent dat Q4S het geld nog niet heeft.
 *
 * `now` hoort bij de invoer omdat "te laat" van de vervaldatum t.o.v. vandaag komt;
 * meegeven houdt de functie deterministisch en testbaar.
 */
export function freelancerReleaseStatus({
  salesInvoices,
  purchaseObligations,
  now,
}: {
  salesInvoices: VerkoopFactuur[];
  purchaseObligations: Uitbetaalverplichting[];
  now: Date;
}): VrijgaveRegel[] {
  const statuses = matchClientPayments({ salesInvoices, now });
  const byId = new Map(statuses.map((s) => [s.id, s]));

  // Index: welke facturen horen bij welke plaatsing / welke freelancer?
  const perPlaatsing = new Map<string, string[]>();
  const perFreelancer = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, key: string, id: string) => {
    const list = map.get(key);
    if (list) {
      if (!list.includes(id)) list.push(id);
    } else map.set(key, [id]);
  };
  for (const inv of salesInvoices) {
    if (!byId.has(inv.id)) continue; // geannuleerd → telt niet mee
    for (const pid of inv.placementIds) push(perPlaatsing, pid, inv.id);
    for (const cid of inv.consultantIds) push(perFreelancer, cid, inv.id);
  }

  return purchaseObligations
    .map<VrijgaveRegel>((v) => {
      // Zoek de facturen: eerst per plaatsing, anders per freelancer.
      const viaPlaatsing = new Set<string>();
      for (const pid of v.placementIds) {
        for (const id of perPlaatsing.get(pid) ?? []) viaPlaatsing.add(id);
      }
      const gekoppeldVia: VrijgaveRegel["gekoppeldVia"] =
        viaPlaatsing.size > 0 ? "plaatsing" : "freelancer";
      const ids =
        viaPlaatsing.size > 0 ? [...viaPlaatsing] : (perFreelancer.get(v.consultantId) ?? []);

      // Volgorde van matchClientPayments aanhouden: risico eerst.
      const gekoppeld = statuses.filter((s) => ids.includes(s.id)).map(compact);
      const teLaat = gekoppeld.filter((f) => f.bucket === "teLaat");
      const nogOpen = gekoppeld.filter((f) => f.bucket !== "betaald");
      const amount = round2(v.amount);

      let bucket: VrijgaveBucket;
      let toelichting: string;
      if (v.betaald) {
        bucket = "alBetaald";
        toelichting = "Q4S heeft deze uitbetaling al gedaan.";
      } else if (gekoppeld.length === 0) {
        bucket = "nietGekoppeld";
        toelichting =
          "Geen verkoopfactuur gevonden voor deze plaatsing of freelancer — handmatig controleren of de uren al doorbelast zijn voordat je uitbetaalt.";
      } else if (teLaat.length > 0) {
        const ergste = teLaat[0];
        bucket = "klantTeLaat";
        toelichting =
          `${ergste.clientName} is ${ergste.dagenTeLaat} dagen te laat met factuur ${ergste.number} ` +
          `(${formatCurrency(ergste.total)}). Eerst innen, dan pas uitbetalen.`;
      } else if (nogOpen.length === 0) {
        bucket = "vrijgeven";
        toelichting =
          `De klant betaalde alle ${gekoppeld.length} gekoppelde ${facturen(gekoppeld.length)} ` +
          `(${formatCurrency(round2(gekoppeld.reduce((s, f) => s + f.total, 0)))}). Veilig uit te betalen.`;
      } else {
        bucket = "wachtOpKlant";
        toelichting =
          `${nogOpen.length} van de ${gekoppeld.length} gekoppelde ${facturen(gekoppeld.length)} ` +
          `staat nog open bij de klant (${formatCurrency(round2(nogOpen.reduce((s, f) => s + f.total, 0)))}). ` +
          `Nog niet uitbetalen.`;
      }

      return {
        id: v.id,
        soort: v.soort,
        soortLabel: SOORT_LABEL[v.soort],
        number: v.number,
        consultantId: v.consultantId,
        consultantName: v.consultantName,
        amount,
        betaald: v.betaald,
        bucket,
        label: VRIJGAVE_LABEL[bucket],
        toelichting,
        gekoppeldVia: gekoppeld.length === 0 ? "geen" : gekoppeldVia,
        facturen: gekoppeld,
      };
    })
    .sort(
      (a, b) =>
        VRIJGAVE_VOLGORDE[a.bucket] - VRIJGAVE_VOLGORDE[b.bucket] ||
        b.amount - a.amount ||
        byName(a.consultantName, b.consultantName) ||
        byName(a.id, b.id),
    );
}

// ---------- Samenvatting ----------

export type BucketTotaal = { count: number; total: number };

export type BetaalmatchingSamenvatting = {
  facturen: Record<FactuurBucket | "totaal", BucketTotaal>;
  verplichtingen: Record<VrijgaveBucket | "totaal", BucketTotaal>;
};

function totaal(rows: { total?: number; amount?: number }[]): BucketTotaal {
  return {
    count: rows.length,
    total: round2(rows.reduce((s, r) => s + (r.total ?? r.amount ?? 0), 0)),
  };
}

/** Aantallen en bedragen per bucket — voor de statkaarten. Elke regel telt in
 *  precies één bucket mee, dus de totalen sluiten aan op de tabellen. */
export function betaalmatchingSamenvatting({
  facturen: rows,
  vrijgave,
}: {
  facturen: FactuurStatus[];
  vrijgave: VrijgaveRegel[];
}): BetaalmatchingSamenvatting {
  const inFactuurBucket = (b: FactuurBucket) => rows.filter((r) => r.bucket === b);
  const inVrijgaveBucket = (b: VrijgaveBucket) => vrijgave.filter((r) => r.bucket === b);

  return {
    facturen: {
      betaald: totaal(inFactuurBucket("betaald")),
      open: totaal(inFactuurBucket("open")),
      teLaat: totaal(inFactuurBucket("teLaat")),
      totaal: totaal(rows),
    },
    verplichtingen: {
      vrijgeven: totaal(inVrijgaveBucket("vrijgeven")),
      wachtOpKlant: totaal(inVrijgaveBucket("wachtOpKlant")),
      klantTeLaat: totaal(inVrijgaveBucket("klantTeLaat")),
      nietGekoppeld: totaal(inVrijgaveBucket("nietGekoppeld")),
      alBetaald: totaal(inVrijgaveBucket("alBetaald")),
      totaal: totaal(vrijgave),
    },
  };
}

// ---------- Samenstelling ----------

export type Betaalmatching = {
  generatedAt: Date;
  facturen: FactuurStatus[];
  vrijgave: VrijgaveRegel[];
  samenvatting: BetaalmatchingSamenvatting;
  labels: BetaalmatchingLabels;
};

/** Het hele betaalmatching-beeld in één keer, uit al opgehaalde records. */
export function buildBetaalmatching({
  salesInvoices,
  purchaseObligations,
  now,
}: {
  salesInvoices: VerkoopFactuur[];
  purchaseObligations: Uitbetaalverplichting[];
  now: Date;
}): Betaalmatching {
  const facturen = matchClientPayments({ salesInvoices, now });
  const vrijgave = freelancerReleaseStatus({ salesInvoices, purchaseObligations, now });

  return {
    generatedAt: now,
    facturen,
    vrijgave,
    samenvatting: betaalmatchingSamenvatting({ facturen, vrijgave }),
    labels: BETAALMATCHING_LABELS,
  };
}
