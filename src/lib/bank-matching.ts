// ---------------------------------------------------------------------------
// Bankafschrift ↔ factuur: VOORSTELLEN doen, niets afboeken.
//
// Dit bestand koppelt de boekingen uit een CAMT.053-afschrift (src/lib/camt053.ts)
// aan openstaande facturen en geeft per boeking één voorstel terug met een
// zekerheid (hoog/midden/laag) en een uitlegbare reden in het Nederlands.
//
// ALLEEN-LEZEN: hier wordt niets betaald, niets gemuteerd en niets verstuurd.
// Een mens vinkt op /betaalmonitor aan wat klopt en drukt op de knop; alleen
// "hoog" staat standaard voorgevinkt. Dat is bewust streng — een verkeerd
// afgeboekte factuur kost echt geld.
//
// Gedeelde regels met de rest van de app:
//   - openstaand = de aanroeper levert alleen niet-betaalde facturen aan
//     (verkoop: niet PAID/CANCELLED, ontvangen: niet PAID), net als betaalmonitor.ts;
//   - persoonsnamen matchen via nameMatches() uit name-match.ts — streng, want
//     "J. Jansen" mag nooit stilletjes "Johannes Jansen" worden;
//   - bedragen vergelijken via round2() uit utils.ts.
// ---------------------------------------------------------------------------

import type { CamtEntry } from "./camt053";
import type { Option } from "./domain";
import { nameMatches } from "./name-match";
import { formatCurrency, round2 } from "./utils";

/** Openstaande verkoopfactuur (Q4S → klant); de aanroeper filtert op status. */
export type OpenSalesInvoice = {
  id: string;
  number: string;
  clientName: string;
  /** Totaal incl. btw — dat is wat er op de rekening binnenkomt. */
  total: number;
};

/** Openstaande door een ZZP'er gestuurde factuur (Optie A); de aanroeper filtert op status. */
export type OpenReceivedInvoice = {
  id: string;
  number: string | null;
  firstName: string;
  lastName: string;
  companyName: string | null;
  iban: string | null;
  /** Bedrag incl. btw — dat is wat er van de rekening afgaat. */
  amount: number;
};

export type BankMatchConfidence = "hoog" | "midden" | "laag" | "geen";

/** Labels + badge-kleuren voor de reviewtabel (zelfde vorm als de sets in domain.ts). */
export const BANK_MATCH_CONFIDENCES: Option[] = [
  { value: "hoog", label: "Hoog", color: "green" },
  { value: "midden", label: "Midden", color: "amber" },
  { value: "laag", label: "Laag", color: "orange" },
  { value: "geen", label: "Geen match", color: "slate" },
];

export type BankMatchRow = {
  /** Volgnummer van de boeking in het afschrift — stabiele sleutel voor de UI. */
  index: number;
  entry: CamtEntry;
  /** "sales" = binnengekomen klantbetaling, "received" = uitbetaling aan een ZZP'er. */
  kind: "sales" | "received";
  invoiceId: string | null;
  invoiceNumber: string | null;
  /** Klant- of freelancernaam bij de voorgestelde factuur. */
  partyName: string | null;
  /** Factuurbedrag (incl. btw) van het voorstel, om naast de boeking te tonen. */
  invoiceAmount: number | null;
  confidence: BankMatchConfidence;
  /** Eén zin die uitlegt waaróm dit voorstel er staat; de UI toont 'm letterlijk. */
  reason: string;
  /** Alleen bij "hoog" staat het vinkje standaard aan. */
  preselected: boolean;
};

// ---------- Scores ----------
//
// De score bepaalt zowel de zekerheid als de volgorde waarin voorstellen een
// factuur mogen claimen. Alles onder HOOG_DREMPEL wordt nooit voorgevinkt.

const SCORE = {
  /** Factuurnummer in de omschrijving én het bedrag klopt. */
  nummerEnBedrag: 100,
  /** Bedrag klopt en de tegenrekening is de IBAN die we van de freelancer kennen. */
  bedragEnIban: 95,
  /** Bedrag klopt en het factuurnummer staat erbij (ontvangen facturen). */
  bedragEnNummer: 90,
  /** Bedrag klopt en de naam op het afschrift is herkenbaar. */
  bedragEnNaam: 86,
  /** Alleen het factuurnummer; het bedrag wijkt af (deelbetaling, creditnota…). */
  alleenNummer: 70,
  /** Alleen het bedrag; naam noch rekening herkend. */
  alleenBedrag: 45,
} as const;

const HOOG_DREMPEL = 85;
const MIDDEN_DREMPEL = 60;

function confidenceFor(score: number): BankMatchConfidence {
  if (score >= HOOG_DREMPEL) return "hoog";
  if (score >= MIDDEN_DREMPEL) return "midden";
  return "laag";
}

// ---------- Hulpjes ----------

/**
 * Een factuurnummer zoals je het in een omschrijving terugvindt: hoofdletters,
 * zonder streepjes/spaties/punten. Zo matcht "2026-0042" ook op "20260042" en
 * "fact. 2026/0042".
 */
function referenceKey(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Korter dan dit zoeken we niet op: "42" komt in élke omschrijving wel voor. */
const MIN_REFERENTIE_LENGTE = 4;

const RECHTSVORM_WOORDEN = new Set([
  "bv", "b", "v", "nv", "n", "vof", "cv", "holding", "group", "groep", "gmbh",
  "ltd", "limited", "inc", "sa", "ag", "sarl", "nl", "the", "en", "zn", "zonen",
]);

/**
 * Woorden uit een BEDRIJFSnaam. normalizeName() uit name-match.ts kan dit niet
 * doen: die gooit cijfers weg (bedoeld voor persoonsnamen), terwijl juist
 * "A1 Staalbouw" of "Q4S" die cijfers nodig heeft. Rechtsvormen vallen af, die
 * zeggen niets over wélk bedrijf het is.
 */
function companyTokens(s: string | null | undefined): Set<string> {
  const cleaned = (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return new Set(
    cleaned.split(" ").filter((t) => t.length >= 2 && !RECHTSVORM_WOORDEN.has(t)),
  );
}

/** Eén betekenisvol woord (≥ 3 tekens) gemeen → waarschijnlijk dezelfde partij. */
function companyOverlaps(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = companyTokens(a);
  const right = companyTokens(b);
  if (left.size === 0 || right.size === 0) return false;
  for (const token of left) {
    if (token.length >= 3 && right.has(token)) return true;
  }
  return false;
}

function sameIban(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? "").replace(/\s+/g, "").toUpperCase();
  const right = (b ?? "").replace(/\s+/g, "").toUpperCase();
  return left.length > 0 && left === right;
}

function freelancerName(inv: OpenReceivedInvoice): string {
  return inv.companyName?.trim() || `${inv.firstName} ${inv.lastName}`.trim();
}

/** Omschrijving + betaalkenmerk samen: banken zetten het factuurnummer in beide. */
function searchText(entry: CamtEntry): string {
  return referenceKey(`${entry.remittance} ${entry.endToEndId ?? ""}`);
}

function numberInRemittance(number: string | null | undefined, haystack: string): boolean {
  const needle = referenceKey(number);
  return needle.length >= MIN_REFERENTIE_LENGTE && haystack.includes(needle);
}

function afwijkendBedrag(number: string, afschrift: number, factuur: number): string {
  return (
    `Factuurnummer ${number} staat in de omschrijving, maar het bedrag wijkt af ` +
    `(afschrift ${formatCurrency(afschrift)} vs factuur ${formatCurrency(factuur)}).`
  );
}

// ---------- Kandidaten ----------

type Candidate = {
  invoiceId: string;
  invoiceNumber: string | null;
  partyName: string;
  invoiceAmount: number;
  score: number;
  reason: string;
};

function salesCandidates(entry: CamtEntry, invoices: OpenSalesInvoice[]): Candidate[] {
  const bedrag = round2(entry.amount);
  const haystack = searchText(entry);
  const out: Candidate[] = [];

  for (const inv of invoices) {
    const total = round2(inv.total);
    const bedragKlopt = total === bedrag;
    const nummerKlopt = numberInRemittance(inv.number, haystack);
    const naamKlopt = companyOverlaps(inv.clientName, entry.counterpartyName);
    const basis = {
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      partyName: inv.clientName,
      invoiceAmount: total,
    };

    if (nummerKlopt && bedragKlopt) {
      out.push({
        ...basis,
        score: SCORE.nummerEnBedrag,
        reason: `Factuurnummer ${inv.number} staat in de omschrijving en het bedrag komt exact overeen.`,
      });
    } else if (nummerKlopt) {
      out.push({
        ...basis,
        score: SCORE.alleenNummer,
        reason: afwijkendBedrag(inv.number, bedrag, total),
      });
    } else if (bedragKlopt && naamKlopt) {
      out.push({
        ...basis,
        score: SCORE.bedragEnNaam,
        reason:
          `Bedrag komt exact overeen en de naam op het afschrift (${entry.counterpartyName}) ` +
          `hoort bij ${inv.clientName}.`,
      });
    } else if (bedragKlopt) {
      out.push({
        ...basis,
        score: SCORE.alleenBedrag,
        reason:
          `Bedrag komt exact overeen met factuur ${inv.number}, maar de naam op het afschrift ` +
          `is niet herkend — zelf controleren.`,
      });
    }
  }
  return out;
}

function receivedCandidates(entry: CamtEntry, invoices: OpenReceivedInvoice[]): Candidate[] {
  // Een afschrijving staat negatief in het afschrift; de factuur is positief.
  const bedrag = round2(-entry.amount);
  const haystack = searchText(entry);
  const out: Candidate[] = [];

  for (const inv of invoices) {
    const amount = round2(inv.amount);
    const naam = freelancerName(inv);
    const bedragKlopt = amount === bedrag;
    const nummerKlopt = numberInRemittance(inv.number, haystack);
    const ibanKlopt = sameIban(inv.iban, entry.counterpartyIban);
    // Persoonsnaam streng (name-match.ts), bedrijfsnaam losser op woordniveau.
    const naamKlopt =
      (entry.counterpartyName != null &&
        nameMatches({ firstName: inv.firstName, lastName: inv.lastName }, entry.counterpartyName)) ||
      companyOverlaps(inv.companyName, entry.counterpartyName);
    const basis = {
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      partyName: naam,
      invoiceAmount: amount,
    };

    if (!bedragKlopt) {
      // Zonder bedragtreffer alleen een voorstel als het factuurnummer erbij staat.
      if (nummerKlopt && inv.number) {
        out.push({
          ...basis,
          score: SCORE.alleenNummer,
          reason: afwijkendBedrag(inv.number, bedrag, amount),
        });
      }
      continue;
    }

    if (ibanKlopt) {
      out.push({
        ...basis,
        score: SCORE.bedragEnIban,
        reason: `Bedrag komt exact overeen en de tegenrekening is de bij ${naam} bekende IBAN.`,
      });
    } else if (nummerKlopt && inv.number) {
      out.push({
        ...basis,
        score: SCORE.bedragEnNummer,
        reason: `Bedrag komt exact overeen en factuurnummer ${inv.number} staat in de omschrijving.`,
      });
    } else if (naamKlopt) {
      out.push({
        ...basis,
        score: SCORE.bedragEnNaam,
        reason:
          `Bedrag komt exact overeen en de naam op het afschrift (${entry.counterpartyName}) ` +
          `hoort bij ${naam}.`,
      });
    } else {
      out.push({
        ...basis,
        score: SCORE.alleenBedrag,
        reason:
          `Bedrag komt exact overeen met de factuur van ${naam}, maar naam noch tegenrekening ` +
          `is herkend — zelf controleren.`,
      });
    }
  }
  return out;
}

// ---------- Samenstelling ----------

function leeg(
  index: number,
  entry: CamtEntry,
  kind: BankMatchRow["kind"],
  reason: string,
): BankMatchRow {
  return {
    index,
    entry,
    kind,
    invoiceId: null,
    invoiceNumber: null,
    partyName: null,
    invoiceAmount: null,
    confidence: "geen",
    reason,
    preselected: false,
  };
}

/**
 * Zet elke boeking op het afschrift om in hooguit één factuurvoorstel.
 *
 * De regels, van sterk naar zwak:
 *   1. factuurnummer in de omschrijving + exact bedrag  → hoog (voorgevinkt)
 *   2. exact bedrag + bekende IBAN / herkenbare naam    → hoog (voorgevinkt)
 *   3. factuurnummer maar een afwijkend bedrag          → midden
 *   4. alleen het bedrag, en precies één kandidaat      → laag
 *   5. alleen het bedrag met meerdere kandidaten        → géén voorstel
 *
 * Eén factuur kan maar aan één boeking worden voorgesteld: de sterkste treffer
 * claimt 'm, een zwakkere boeking houdt dan niets over. Zo kan dezelfde factuur
 * nooit twee keer worden afgeboekt.
 *
 * De volgorde van het afschrift blijft staan — je leest de tabel naast je bank.
 */
export function matchBankEntries({
  entries,
  salesInvoices,
  receivedInvoices,
}: {
  entries: CamtEntry[];
  salesInvoices: OpenSalesInvoice[];
  receivedInvoices: OpenReceivedInvoice[];
}): BankMatchRow[] {
  // 1) Per boeking de kandidaten verzamelen, sterkste eerst.
  const perEntry = entries.map((entry, index) => {
    const kind: BankMatchRow["kind"] = entry.amount >= 0 ? "sales" : "received";
    const candidates =
      entry.amount === 0
        ? []
        : kind === "sales"
          ? salesCandidates(entry, salesInvoices)
          : receivedCandidates(entry, receivedInvoices);
    candidates.sort(
      (a, b) =>
        b.score - a.score ||
        (a.invoiceNumber ?? "").localeCompare(b.invoiceNumber ?? "", "nl") ||
        a.invoiceId.localeCompare(b.invoiceId),
    );
    return { entry, index, kind, candidates };
  });

  // 2) Sterkste boekingen eerst laten claimen, zodat één factuur maar één keer
  //    wordt voorgesteld (bij gelijke score wint de bovenste boeking).
  const claimed = new Set<string>();
  const rows = new Map<number, BankMatchRow>();
  const volgorde = [...perEntry].sort(
    (a, b) => (b.candidates[0]?.score ?? 0) - (a.candidates[0]?.score ?? 0) || a.index - b.index,
  );

  for (const { entry, index, kind, candidates } of volgorde) {
    if (entry.amount === 0) {
      rows.set(index, leeg(index, entry, kind, "Boeking zonder bedrag — niets om te koppelen."));
      continue;
    }
    if (candidates.length === 0) {
      rows.set(
        index,
        leeg(
          index,
          entry,
          kind,
          kind === "sales"
            ? "Geen openstaande verkoopfactuur met dit factuurnummer of bedrag gevonden."
            : "Geen openstaande ontvangen factuur met dit factuurnummer of bedrag gevonden.",
        ),
      );
      continue;
    }

    // Alleen-op-bedrag met meerdere even sterke kandidaten: dan is élke keuze een
    // gok. Liever geen voorstel dan het verkeerde geld afboeken.
    const beste = candidates[0];
    if (
      beste.score === SCORE.alleenBedrag &&
      candidates.filter((c) => c.score === SCORE.alleenBedrag).length > 1
    ) {
      rows.set(
        index,
        leeg(
          index,
          entry,
          kind,
          `Meerdere openstaande facturen (${candidates.length}) met exact dit bedrag — kies zelf welke het is.`,
        ),
      );
      continue;
    }

    const vrij = candidates.find((c) => !claimed.has(c.invoiceId));
    if (!vrij) {
      rows.set(
        index,
        leeg(
          index,
          entry,
          kind,
          "De best passende factuur is al aan een andere boeking op dit afschrift toegewezen.",
        ),
      );
      continue;
    }

    claimed.add(vrij.invoiceId);
    const confidence = confidenceFor(vrij.score);
    rows.set(index, {
      index,
      entry,
      kind,
      invoiceId: vrij.invoiceId,
      invoiceNumber: vrij.invoiceNumber,
      partyName: vrij.partyName,
      invoiceAmount: vrij.invoiceAmount,
      confidence,
      reason: vrij.reason,
      preselected: confidence === "hoog",
    });
  }

  return perEntry.map(({ index }) => rows.get(index)!);
}

// ---------- Samenvatting voor de reviewtabel ----------

export type BankMatchSummary = {
  entries: number;
  /** Aantal voorstellen per zekerheid (zonder voorstel telt als "geen"). */
  hoog: number;
  midden: number;
  laag: number;
  geen: number;
  /** Totaal bij- en afgeschreven op dit afschrift. */
  credit: number;
  debit: number;
};

export function summarizeBankMatches(rows: BankMatchRow[]): BankMatchSummary {
  const count = (c: BankMatchConfidence) => rows.filter((r) => r.confidence === c).length;
  return {
    entries: rows.length,
    hoog: count("hoog"),
    midden: count("midden"),
    laag: count("laag"),
    geen: count("geen"),
    credit: round2(rows.reduce((s, r) => s + Math.max(0, r.entry.amount), 0)),
    debit: round2(rows.reduce((s, r) => s + Math.min(0, r.entry.amount), 0)),
  };
}
