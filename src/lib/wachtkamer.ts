// ---------------------------------------------------------------------------
// De wachtkamer — het pure hulpstuk onder /verwerken/wachtkamer.
//
// HR kan een weekstaat die niet klopt PARKEREN: hij verdwijnt dan van het
// weekoverzicht (dat blijft schoon) en wacht tot de freelancer een gecorrigeerde
// staat of factuur stuurt. Stuurt die persoon iets nieuws, dan komt dat vanzelf
// als nieuw inbox-item op het overzicht — de geparkeerde week blijft hier staan
// tot iemand hem bevestigt, afwijst of handmatig terugzet.
//
// Wat hier gebeurt is uitsluitend SPLITSEN en TELLEN:
//   1) wachtDagen      — hoeveel hele dagen staat dit al te wachten;
//   2) wachtLabel      — datzelfde getal als leesbaar Nederlands;
//   3) splitWachtkamer — de te controleren regels splitsen in wat op het
//      weekoverzicht blijft en wat in de wachtkamer staat.
//
// PUUR en DETERMINISTISCH, net als src/lib/weekverwerking.ts: geen Prisma, geen
// I/O en geen `Date.now()` — het "nu" komt er altijd van buiten in, zodat de
// wachttijd testbaar is en niet afhangt van het moment van renderen.
// ---------------------------------------------------------------------------

const DAG_MS = 86_400_000;

/** Wat de database over het parkeren weet: sinds wanneer, en waarom. */
export type WachtkamerMarkering = {
  /** TimesheetInbox.id — dezelfde sleutel als de regel op het weekoverzicht. */
  id: string;
  /** TimesheetInbox.wachtkamerSince — `null` betekent: niet geparkeerd. */
  since: Date | null;
  /** TimesheetInbox.wachtkamerReason — de gate-reden bij het parkeren. */
  reason?: string | null;
};

/** Eén regel zoals hij in de wachtkamer staat: de originele rij plus wachttijd. */
export type GeparkeerdeRij<T> = {
  row: T;
  since: Date;
  reason: string | null;
  /** Hele dagen sinds het parkeren (0 = vandaag geparkeerd). */
  dagen: number;
  /** Diezelfde wachttijd als tekst ("3 dagen", "2 weken"). */
  wachtLabel: string;
};

export type WachtkamerIndeling<T> = {
  /** Blijft op het weekoverzicht staan. */
  teControleren: T[];
  /** Geparkeerd — langst wachtende bovenaan. */
  inWachtkamer: GeparkeerdeRij<T>[];
};

/** Geldige datum? (`new Date("onzin")` is een Date, maar zonder tijd erin.) */
function isDatum(d: unknown): d is Date {
  return d instanceof Date && Number.isFinite(d.getTime());
}

/**
 * Hoeveel HELE dagen staat een geparkeerde week al te wachten. Naar beneden
 * afgerond, en nooit negatief: een klok die achterloopt of een datum in de
 * toekomst levert 0 op in plaats van "-2 dagen".
 */
export function wachtDagen(since: Date, now: Date): number {
  if (!isDatum(since) || !isDatum(now)) return 0;
  const verschil = now.getTime() - since.getTime();
  if (!(verschil > 0)) return 0;
  return Math.floor(verschil / DAG_MS);
}

/**
 * De wachttijd als gewoon Nederlands. Onder de week per dag, daarboven per hele
 * week — "17 dagen" zegt minder dan "2 weken" als je moet beslissen of je de
 * freelancer weer een herinnering stuurt.
 */
export function wachtLabel(dagen: number): string {
  const d = Number.isFinite(dagen) ? Math.floor(dagen) : 0;
  if (d <= 0) return "vandaag geparkeerd";
  if (d === 1) return "1 dag";
  if (d < 7) return `${d} dagen`;
  const weken = Math.floor(d / 7);
  return weken === 1 ? "1 week" : `${weken} weken`;
}

/** Lege reden, spaties of `undefined` → gewoon geen reden. */
function schoneReden(reason: string | null | undefined): string | null {
  const tekst = typeof reason === "string" ? reason.trim() : "";
  return tekst === "" ? null : tekst;
}

/**
 * Splits de te controleren regels in wat op het weekoverzicht blijft staan en
 * wat in de wachtkamer zit, en reken per geparkeerde regel uit hoe lang hij daar
 * al staat.
 *
 * Markeringen zonder datum (`since: null`) parkeren niets, en markeringen voor
 * een regel die niet (meer) in `rows` zit worden overgeslagen — zo kan een
 * geparkeerd item dat intussen bevestigd of afgewezen is nooit als spook in de
 * wachtkamer blijven hangen.
 */
export function splitWachtkamer<T extends { id: string }>(input: {
  rows: T[];
  parked: WachtkamerMarkering[];
  now: Date;
}): WachtkamerIndeling<T> {
  const rows = Array.isArray(input?.rows) ? input.rows : [];
  const parked = Array.isArray(input?.parked) ? input.parked : [];
  const now = input?.now;

  const markeringen = new Map<string, WachtkamerMarkering>();
  for (const m of parked) {
    if (!m || typeof m.id !== "string" || !isDatum(m.since)) continue;
    if (!markeringen.has(m.id)) markeringen.set(m.id, m); // eerste markering wint
  }

  const teControleren: T[] = [];
  const inWachtkamer: GeparkeerdeRij<T>[] = [];

  for (const row of rows) {
    const markering = row ? markeringen.get(row.id) : undefined;
    const since = markering?.since;
    if (!markering || !isDatum(since)) {
      teControleren.push(row);
      continue;
    }
    const dagen = wachtDagen(since, now);
    inWachtkamer.push({
      row,
      since,
      reason: schoneReden(markering.reason),
      dagen,
      wachtLabel: wachtLabel(dagen),
    });
  }

  // Langst wachtende bovenaan; bij gelijke wachttijd blijft de volgorde van het
  // weekoverzicht staan (Array.prototype.sort is stabiel).
  inWachtkamer.sort((a, b) => a.since.getTime() - b.since.getTime());

  return { teControleren, inWachtkamer };
}
