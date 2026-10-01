// ---------------------------------------------------------------------------
// CAMT.053 (ISO 20022 dagafschrift) uitlezen — PUUR: geen database, geen IO, geen
// bestand op schijf. Je geeft de XML-tekst mee en krijgt platte boekingen terug.
//
// Bewust zonder XML-dependency: het project heeft er geen en we voegen er geen
// toe. Een afschrift is een vlak, voorspelbaar document (Stmt → Ntry → TxDtls),
// dus een regex-lezer die namespace-prefixen afpelt is genoeg én veilig: we
// voeren niets uit, we lezen alleen tekst tussen tags. Bij onbekende of kapotte
// invoer komt er een lege lijst uit in plaats van een exception.
//
// Dit bestand KOPPELT NIETS en MARKEERT NIETS als betaald — dat doet
// src/lib/bank-matching.ts (voorstellen) en uiteindelijk een mens met een knop.
// ---------------------------------------------------------------------------

import { round2 } from "./utils";

/** Eén boeking (transactie) op het afschrift. */
export type CamtEntry = {
  /** Boekdatum (BookgDt); ontbreekt die, dan de valutadatum (ValDt). UTC-middernacht. */
  date: Date;
  /** Bedrag in de valuta van de boeking: bijschrijving positief, afschrijving negatief. */
  amount: number;
  currency: string | null;
  /** Naam van de tegenpartij: de betaler bij een bijschrijving, de ontvanger bij een afschrijving. */
  counterpartyName: string | null;
  counterpartyIban: string | null;
  /** Alle ongestructureerde omschrijvingsregels (Ustrd) aaneen. */
  remittance: string;
  endToEndId: string | null;
};

/** Eén dagafschrift (Stmt) uit het bestand — een bestand kan er meerdere bevatten. */
export type Camt053Statement = {
  id: string | null;
  /** IBAN van de eigen rekening waar dit afschrift bij hoort. */
  iban: string | null;
  entries: CamtEntry[];
};

// ---------- Mini XML-lezer ----------

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) {
      const code = Number.parseInt(name.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (name.startsWith("#")) {
      const code = Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name] ?? whole;
  });
}

/**
 * Haal commentaar/CDATA-ruis weg en pel namespace-prefixen van de tags af, zodat
 * `<ns2:Ntry>` en `<Ntry>` daarna hetzelfde zijn. De attributen blijven staan
 * (we hebben `Ccy` nog nodig).
 */
function normalizeXml(xml: string): string {
  return xml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<\/?[A-Za-z_][\w.-]*:/g, (m) => (m.startsWith("</") ? "</" : "<"));
}

function escapeTag(tag: string): string {
  return tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Alle `<Tag>…</Tag>`-blokken op het buitenste niveau van `xml` (niet genest). */
function blocks(xml: string, tag: string): string[] {
  const t = escapeTag(tag);
  const open = new RegExp(`<${t}(?:\\s[^>]*)?>`, "g");
  const close = `</${tag}>`;
  const out: string[] = [];
  while (open.exec(xml) !== null) {
    // Zoek de bijbehorende sluit-tag en sla geneste openingen over.
    let depth = 1;
    let cursor = open.lastIndex;
    const scan = new RegExp(`<${t}(?:\\s[^>]*)?>|</${t}>`, "g");
    scan.lastIndex = cursor;
    let hit: RegExpExecArray | null;
    while ((hit = scan.exec(xml))) {
      depth += hit[0] === close ? -1 : 1;
      if (depth === 0) {
        out.push(xml.slice(cursor, hit.index));
        cursor = scan.lastIndex;
        break;
      }
    }
    if (depth !== 0) break; // niet-gesloten tag → de rest is onbruikbaar
    open.lastIndex = cursor;
  }
  return out;
}

/** De tekst van de eerste `<Tag>`; `null` als de tag ontbreekt of leeg is. */
function text(xml: string, tag: string): string | null {
  const m = new RegExp(`<${escapeTag(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeTag(tag)}>`).exec(xml);
  if (!m) return null;
  const value = decodeEntities(m[1]).replace(/\s+/g, " ").trim();
  return value || null;
}

/** De tekst van álle `<Tag>`-voorkomens, in documentvolgorde. */
function texts(xml: string, tag: string): string[] {
  const re = new RegExp(`<${escapeTag(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeTag(tag)}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const value = decodeEntities(m[1]).replace(/\s+/g, " ").trim();
    if (value) out.push(value);
  }
  return out;
}

/** Het eerste `<Tag …>`-attribuut `attr`. */
function attr(xml: string, tag: string, name: string): string | null {
  const m = new RegExp(`<${escapeTag(tag)}\\s[^>]*${name}="([^"]*)"`).exec(xml);
  return m ? decodeEntities(m[1]).trim() || null : null;
}

// ---------- Veldjes ----------

/** `2026-03-02` of `2026-03-02T00:00:00+01:00` → UTC-middernacht van die dag. */
function parseIsoDay(raw: string | null): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function entryDate(entryXml: string): Date | null {
  for (const tag of ["BookgDt", "ValDt"]) {
    const [block] = blocks(entryXml, tag);
    if (!block) continue;
    const day = parseIsoDay(text(block, "Dt") ?? text(block, "DtTm"));
    if (day) return day;
  }
  return null;
}

function parseAmount(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/\s/g, ""));
  return Number.isFinite(n) ? round2(n) : null;
}

function normalizeIban(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.replace(/\s+/g, "").toUpperCase();
  return v || null;
}

/**
 * De tegenpartij hangt van de richting af: bij een bijschrijving (CRDT) betaalt
 * de debiteur ons, bij een afschrijving (DBIT) betalen wij de crediteur.
 */
function counterparty(detailsXml: string, credit: boolean): { name: string | null; iban: string | null } {
  const [parties] = blocks(detailsXml, "RltdPties");
  const scope = parties ?? detailsXml;
  const partyTag = credit ? "Dbtr" : "Cdtr";
  const [party] = blocks(scope, partyTag);
  const [account] = blocks(scope, `${partyTag}Acct`);
  return {
    name: party ? text(party, "Nm") : null,
    iban: account ? normalizeIban(text(account, "IBAN")) : null,
  };
}

/**
 * Alleen `BOOK` is definitief geboekt; `PDNG` (in behandeling) en `INFO` zijn dat
 * niet. Ontbreekt de status, dan gaan we uit van geboekt (zo leveren veel banken
 * hun dagafschrift aan). Werkt met zowel `<Sts>BOOK</Sts>` als `<Sts><Cd>BOOK</Cd></Sts>`.
 */
function isBooked(entryXml: string): boolean {
  const [sts] = blocks(entryXml, "Sts");
  if (!sts) return true;
  const code = (text(sts, "Cd") ?? sts.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return !code || code.toUpperCase() === "BOOK";
}

/** `NOTPROVIDED` is de ISO-manier om "geen referentie" te zeggen. */
function reference(raw: string | null): string | null {
  if (!raw) return null;
  return raw.toUpperCase() === "NOTPROVIDED" ? null : raw;
}

// ---------- Hoofdingang ----------

function parseEntry(entryXml: string, detailsXml: string, fallbackDate: Date): CamtEntry | null {
  // Bedrag + richting staan op de boeking zelf; bij een verzamelboeking heeft
  // elke onderliggende transactie haar eigen bedrag (en soms eigen richting).
  const amount = parseAmount(text(detailsXml, "Amt") ?? text(entryXml, "Amt"));
  if (amount == null) return null;
  const indicator = (text(detailsXml, "CdtDbtInd") ?? text(entryXml, "CdtDbtInd") ?? "").toUpperCase();
  if (indicator !== "CRDT" && indicator !== "DBIT") return null;
  const credit = indicator === "CRDT";

  const party = counterparty(detailsXml, credit);
  return {
    date: entryDate(detailsXml) ?? fallbackDate,
    amount: credit ? Math.abs(amount) : -Math.abs(amount),
    currency: attr(detailsXml, "Amt", "Ccy") ?? attr(entryXml, "Amt", "Ccy"),
    counterpartyName: party.name,
    counterpartyIban: party.iban,
    remittance: texts(detailsXml, "Ustrd").join(" "),
    endToEndId: reference(text(detailsXml, "EndToEndId")),
  };
}

/**
 * Lees een CAMT.053-bestand (dagafschrift) uit. Eén `Stmt` per afschrift, één
 * `CamtEntry` per transactie — een verzamelboeking (`NtryDtls` met meerdere
 * `TxDtls`) valt daarbij uiteen in de losse transacties, want daar zit de
 * tegenpartij en de omschrijving in die we nodig hebben om te kunnen matchen.
 *
 * Boekingen zonder bruikbaar bedrag of richting worden overgeslagen; onleesbare
 * invoer levert een lege lijst op.
 */
export function parseCamt053(xml: string): Camt053Statement[] {
  if (!xml || !xml.includes("<")) return [];
  const doc = normalizeXml(xml);
  if (!doc.includes("<Stmt")) return [];

  return blocks(doc, "Stmt").map<Camt053Statement>((stmtXml) => {
    const [account] = blocks(stmtXml, "Acct");
    const entries: CamtEntry[] = [];

    for (const entryXml of blocks(stmtXml, "Ntry")) {
      // Alleen écht geboekte regels tellen: een PDNG/INFO-regel is nog geen geld.
      if (!isBooked(entryXml)) continue;

      const fallbackDate = entryDate(entryXml) ?? new Date(0);
      const [details] = blocks(entryXml, "NtryDtls");
      const transactions = details ? blocks(details, "TxDtls") : [];
      // Een verzamelboeking splitsen mag alleen als élke transactie haar eigen
      // bedrag draagt — anders zou het boekingsbedrag dubbel geteld worden.
      const splittable =
        transactions.length === 1 ||
        (transactions.length > 1 && transactions.every((t) => text(t, "Amt") != null));
      const scopes = splittable ? transactions : [entryXml];
      for (const scope of scopes) {
        const entry = parseEntry(entryXml, scope, fallbackDate);
        if (entry) entries.push(entry);
      }
    }

    return {
      // Het afschrift-id staat vóór de boekingen; pak het uit de kop, niet uit een Ntry.
      id: text(stmtXml.split("<Ntry")[0], "Id"),
      iban: account ? normalizeIban(text(account, "IBAN")) : null,
      entries,
    };
  });
}
