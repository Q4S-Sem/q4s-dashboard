import { db } from "@/lib/db";
import { aiJSON, aiJSONFromFile, isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { ensureAiKeysLoaded } from "@/lib/ai-keys";
import { excelToText, isSpreadsheet } from "@/lib/excel";
import { matchByName } from "@/lib/name-match";
import { formatCurrency, formatHours, getISOWeek, round2 } from "@/lib/utils";

// ---------------------------------------------------------------------------
// AI-uitlezing van de EIGEN factuur van een ZZP'er (de inkoopkant van "optie A":
// de freelancer factureert zelf, wij registreren die factuur als ReceivedInvoice).
// Spiegelt src/lib/inbox-extract.ts (urenstaten), maar dan voor geld.
//
// REVIEW-FIRST: dit vult alleen het importformulier VOOR. Er wordt hier niets
// opgeslagen — een mens controleert de bedragen en bevestigt (createReceivedInvoice
// in ontvangen-facturen/actions.ts blijft de enige plek waar geld de DB in gaat).
//
// De pure delen (toReceivedInvoiceFormValues, isoWeekRange, parseWeekNumber,
// invoiceMediaType) staan bewust los van de netwerk-aanroep: zij zijn de naad die
// in tests/invoice-extract.test.ts volledig is afgedekt.
// ---------------------------------------------------------------------------

/** Wat de AI uit één ZZP-factuur haalt. Onbekend = lege string / 0. */
export type InvoiceExtracted = {
  invoiceNumber: string;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
  weekNumber: string;
  year: string;
  hours: number;
  hourlyRate: number;
  overtimeHours: number;
  amountExclVat: number;
  vatAmount: number;
  vatShifted: boolean;
  kilometers: number;
  totalAmount: number;
  name: string;
  confidence: number;
  notes: string;
};

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    invoiceNumber: { type: "string", description: "Het FACTUURNUMMER zoals de ZZP'er het vermeldt ('Factuurnummer', 'Factuur nr.', 'Invoice no.'), bv. '2026-014'. Neem het letterlijk over, inclusief streepjes/letters. Leeg laten als er geen nummer staat — verwar het NIET met een ordernummer, klantnummer, KvK- of BTW-nummer." },
    issueDate: { type: "string", description: "De FACTUURDATUM als YYYY-MM-DD ('Factuurdatum', 'Datum', 'Invoice date'). NIET de vervaldatum/betaaltermijn. Leeg laten als er geen datum staat." },
    periodStart: { type: "string", description: "Eerste dag van de gefactureerde PERIODE als YYYY-MM-DD, alleen als er echte datums op de factuur staan (bv. 'periode 17-08-2026 t/m 23-08-2026' of dagregels met datums). Staat er ALLEEN een weeknummer, laat dit dan LEEG en vul weekNumber + year — wij rekenen de maandag zelf uit." },
    periodEnd: { type: "string", description: "Laatste dag van de gefactureerde periode als YYYY-MM-DD (zelfde regels als periodStart). Leeg bij alleen een weeknummer." },
    weekNumber: { type: "string", description: "Het WEEKNUMMER waarover gefactureerd wordt, als de factuur dat noemt ('week 34', 'wk 34', 'Week nr. 34'); alleen het getal volstaat. Anders lege string. Meerdere weken op één factuur → de EERSTE week en meld dat in notes." },
    year: { type: "string", description: "Het JAAR (4 cijfers) waar de gefactureerde periode/week bij hoort. Meestal af te leiden uit de factuurdatum of de koptekst ('week 34 2026'). Anders lege string — nooit gokken." },
    hours: { type: "number", description: "Het aantal GEWERKTE UREN dat gefactureerd wordt (de urenregel, bv. '40 uur x € 65,00'), exclusief de aparte overuren-regel. 0 als de factuur geen uren noemt." },
    hourlyRate: { type: "number", description: "Het UURTARIEF in euro's per uur op de urenregel (bv. 65 bij '€ 65,00 per uur'). 0 als er geen tarief staat." },
    overtimeHours: { type: "number", description: "Uren op een APARTE overuren-/toeslagregel ('overuren', 'meeruren', 'overtime'). 0 als die regel er niet is." },
    amountExclVat: { type: "number", description: "Het SUBTOTAAL EXCLUSIEF BTW in euro's (som van alle regels vóór btw; 'subtotaal', 'totaal excl. btw'). 0 als het er niet staat. Let op de Nederlandse notatie: '3.146,00' is 3146.00 — de punt is een duizendtal-scheiding, de komma het decimaalteken." },
    vatAmount: { type: "number", description: "Het BTW-BEDRAG in euro's zoals apart vermeld ('BTW 21%', 'Omzetbelasting'). 0 als er geen btw in rekening is gebracht (bv. bij 'BTW verlegd') of als het bedrag er niet staat." },
    vatShifted: { type: "boolean", description: "True als de btw VERLEGD is: de factuur vermeldt 'btw verlegd', 'verleggingsregeling', 'BTW verlegd naar', 'reverse charge' of '0% i.v.m. verlegging'. Dan is er geen btw-bedrag. Anders false." },
    kilometers: { type: "number", description: "Het aantal KILOMETERS dat op de factuur staat (reiskosten-/kilometerregel, bv. '220 km x € 0,23'). Alleen het aantal km, niet het bedrag. 0 als er geen km op de factuur staan." },
    totalAmount: { type: "number", description: "Het TOTAALBEDRAG dat betaald moet worden ('Totaal', 'Te betalen', 'Total due') — inclusief btw als die in rekening is gebracht, anders gelijk aan het bedrag excl. btw. 0 als er geen totaal staat." },
    name: { type: "string", description: "De naam van de AFZENDER: de ZZP'er/zelfstandige die factureert (of zijn eenmanszaak), meestal linksboven of bij de bankgegevens. NIET de geadresseerde — Q4S (Q4S Group / Q4Solutions) is de ONTVANGER van deze factuur en mag hier nooit staan. Leeg laten als je de afzender niet zeker weet." },
    confidence: { type: "number", description: "Hoe zeker ben je over deze uitlezing, van 0 (gegokt) tot 1 (alles helder en eenduidig leesbaar)? Gebruik 0.4 of lager als bedragen slecht leesbaar waren of je moest interpreteren." },
    notes: { type: "string", description: "Korte opmerking in het NEDERLANDS over onzekerheden of opvallende zaken (bv. 'bedragen tellen niet op', 'meerdere weken op één factuur'). Lege string als alles duidelijk was." },
  },
  required: ["invoiceNumber", "issueDate", "periodStart", "periodEnd", "weekNumber", "year", "hours", "hourlyRate", "overtimeHours", "amountExclVat", "vatAmount", "vatShifted", "kilometers", "totalAmount", "name", "confidence", "notes"],
};

const SYSTEM_EXTRACT = `Je bent een uiterst nauwkeurige administratieve assistent bij Q4S, een Nederlands detacheringsbureau. Je leest FACTUREN uit die door zelfstandige (ZZP) vakmensen aan Q4S gestuurd worden voor gewerkte weken. Elke ZZP'er gebruikt zijn eigen factuuropmaak.

Haal de gegevens er EXACT uit zoals ze er staan. Verzin NIETS en reken niets terug wat er niet staat: laat een tekstveld leeg of zet een getal op 0 als je het niet zeker uit het document kunt halen. Een mens controleert jouw uitlezing daarna en vult de rest zelf aan — een gok is dus schadelijker dan een leeg veld. Antwoord volgens het JSON-schema.

TAAL: schrijf alle vrije tekst (het veld "notes") ALTIJD in het NEDERLANDS, ook bij een Engelstalige factuur. Feitelijke waarden (namen, factuurnummers) neem je letterlijk over.

AFZENDER vs. ONTVANGER: deze factuur is AAN Q4S gericht. De naam die je in "name" zet is die van de ZZP'er die de factuur STUURT (afzender/eenmanszaak, meestal in de kop of bij de bankgegevens). Q4S, Q4S Group of Q4Solutions is nooit de afzender.

BEDRAGEN (Nederlandse notatie):
- '€ 3.146,00' is 3146.00: de PUNT is duizendtal-scheiding, de KOMMA het decimaalteken. Geef getallen terug als gewoon getal (3146.00), zonder euroteken of scheidingstekens.
- amountExclVat = het subtotaal vóór btw; vatAmount = het apart vermelde btw-bedrag; totalAmount = het te betalen totaal (incl. btw als die berekend is).
- Staat er maar één bedrag op de factuur, zet dat dan in totalAmount en laat de rest 0.

BTW:
- Vermeldt de factuur 'btw verlegd', 'verleggingsregeling' of 'reverse charge'? Dan vatShifted = true en vatAmount = 0. Het totaalbedrag is dan gelijk aan het bedrag excl. btw.
- Anders vatShifted = false en vatAmount = het btw-bedrag in euro's (dus NIET het percentage: bij 'BTW 21%: € 546,00' is vatAmount 546, niet 21).

PERIODE / WEEK:
- Staan er échte datums ('periode 17-08-2026 t/m 23-08-2026', of dagregels met datums)? Zet die dan als YYYY-MM-DD in periodStart en periodEnd.
- Noemt de factuur ALLEEN een weeknummer ('week 34')? Laat periodStart en periodEnd dan LEEG en vul weekNumber met het nummer en year met het jaar uit de factuurkop/factuurdatum. Wij rekenen de maandag t/m zondag van die week zelf uit — reken dat dus niet zelf uit.
- Beslaat de factuur meerdere weken, neem dan de EERSTE week/de hele periode en meld het in notes.

UREN, TARIEF, OVERUREN:
- hours = de gefactureerde gewerkte uren van de urenregel; hourlyRate = het uurtarief per uur; overtimeHours = uren op een aparte overuren-/toeslagregel.
- Regels voor kilometers, verblijfkosten, parkeren of materiaal zijn GEEN uren.

KILOMETERS: kilometers = het AANTAL km op de reiskosten-/kilometerregel (bij '220 km x € 0,23 = € 50,60' is dat 220, niet 50.60). Geen kilometerregel → 0.

ZEKERHEID: zet confidence laag (0.4 of minder) en leg in notes kort uit wat onduidelijk was zodra bedragen slecht leesbaar zijn, de optelling niet klopt of je moest interpreteren.`;

/** Datum-context, zodat een factuur met alleen 'week 34' of een 2-cijferig jaar
 *  niet in het verkeerde jaar belandt. */
function dateContext(today: Date): string {
  return `\n\nCONTEXT — datum & jaar:\n- Vandaag is ${toIsoString(today)}.\n- Vermeldt de factuur geen jaartal, kies dan het jaar dat het dichtst bij vandaag ligt (bijna altijd het huidige jaar) — nooit zomaar een eerder jaar. Een 2-cijferig jaar ('26') betekent 20xx.`;
}

// --- pure helpers ----------------------------------------------------------

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function toIsoString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Geldige kalenderdatum? (vangt '2026-02-30' en '2026-13-01' af) */
function validDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * Normaliseer een uitgelezen datum naar YYYY-MM-DD (wat het formulier verwacht).
 * Slikt ook de Nederlandse schrijfwijze 24-08-2026 / 24/08/2026 / 24.08.2026.
 * Onleesbaar of onmogelijk → lege string; nooit gokken.
 */
export function toIsoDate(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  if (!s) return "";
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return validDate(y, m, d) ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "";
  }
  const nl = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (nl) {
    const [d, m, y] = [Number(nl[1]), Number(nl[2]), Number(nl[3])];
    return validDate(y, m, d) ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "";
  }
  return "";
}

/** Weeknummer (1–53) uit vrije tekst ('week 34', 'wk 34/2026'); anders null.
 *  Een los 4-cijferig getal is een jaartal, geen week. */
export function parseWeekNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value >= 1 && value <= 53 ? value : null;
  const m = /(?<!\d)(\d{1,2})(?!\d)/.exec((value ?? "").trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 53 ? n : null;
}

/**
 * Maandag t/m zondag (YYYY-MM-DD) van ISO-week `week` in `year`. Week 1 is de week
 * met 4 januari erin. Bestaat die week dat jaar niet (week 53 in een 52-weeks jaar),
 * dan null — dan blijft de periode liever leeg dan verkeerd.
 */
export function isoWeekRange(week: number, year: number): { start: string; end: string } | null {
  if (!Number.isInteger(week) || week < 1 || week > 53) return null;
  if (!Number.isInteger(year) || year < 1970 || year > 2999) return null;
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  if (getISOWeek(monday) !== week) return null; // week 53 in een jaar met er 52
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toIsoString(monday), end: toIsoString(sunday) };
}

/** Geldbedrag → "3146,00" (NL-notatie, zonder duizendtal-punten zodat het
 *  ongewijzigd door parseAmount van createReceivedInvoice komt). 0 → "". */
function money(value: number): string {
  const n = round2(value);
  return n > 0 ? n.toFixed(2).replace(".", ",") : "";
}

/** Aantal → "220" / "220,5" (geen overbodige decimalen). 0 of minder → "". */
function quantity(value: number): string {
  const n = round2(value);
  return n > 0 ? String(n).replace(".", ",") : "";
}

/** Media-type voor de vision-uitlezing, of null als het bestand niet te lezen is.
 *  Kijkt naar de MIME én de extensie (browsers sturen soms application/octet-stream). */
export function invoiceMediaType(
  originalName: string,
  mimeType: string,
  hint?: string | null,
): string | null {
  const name = (originalName ?? "").toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();
  const given = (hint ?? "").toLowerCase();
  if (given === "application/pdf" || mime.includes("pdf") || name.endsWith(".pdf")) return "application/pdf";
  const image = /^image\/(png|jpeg|gif|webp)$/;
  if (image.test(given)) return given;
  if (mime === "image/jpg") return "image/jpeg";
  if (image.test(mime)) return mime;
  if (/\.(jpe?g)$/.test(name)) return "image/jpeg";
  if (/\.png$/.test(name)) return "image/png";
  if (/\.gif$/.test(name)) return "image/gif";
  if (/\.webp$/.test(name)) return "image/webp";
  return null;
}

/** De velden van het importformulier (/ontvangen-facturen/importeren). */
export type ReceivedInvoiceFormValues = {
  number: string;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
  /** Bedrag INCL. btw, zoals het formulier het vraagt. */
  amount: string;
  /** null = geen btw-bedrag (verlegd of niet vermeld); anders het bedrag. */
  vatAmount: string | null;
  kilometers: string;
  notes: string;
};

/**
 * PUUR: zet een AI-uitlezing om naar exact de velden die het importformulier
 * verwacht (datums YYYY-MM-DD, bedragen in NL-notatie). Vult NIETS aan wat niet
 * uit de factuur volgt — behalve de periode, die we uit het weeknummer mogen
 * afleiden. Een mens controleert het resultaat vóór opslaan.
 *
 * @param data   De uitlezing (mag onvolledig, null of undefined zijn).
 * @param today  Referentiedatum voor het jaar als de factuur er geen noemt.
 */
export function toReceivedInvoiceFormValues(
  data: Partial<InvoiceExtracted> | null | undefined,
  today: Date = new Date(),
): ReceivedInvoiceFormValues {
  const d = data ?? {};

  const issueDate = toIsoDate(d.issueDate);
  let periodStart = toIsoDate(d.periodStart);
  let periodEnd = toIsoDate(d.periodEnd);
  if (!periodStart || !periodEnd) {
    const week = parseWeekNumber(d.weekNumber);
    const year = /^\d{4}$/.test((d.year ?? "").trim())
      ? Number((d.year ?? "").trim())
      : issueDate
        ? Number(issueDate.slice(0, 4))
        : today.getFullYear();
    const range = week ? isoWeekRange(week, year) : null;
    if (range) {
      if (!periodStart) periodStart = range.start;
      if (!periodEnd) periodEnd = range.end;
    }
  }

  // Bedrag incl. btw: het vermelde totaal wint; anders zelf optellen. Bij verlegde
  // btw telt een toch ingevuld btw-bedrag niet mee (dan is excl. = het totaal).
  const shifted = d.vatShifted === true;
  const excl = num(d.amountExclVat);
  const vat = shifted ? 0 : num(d.vatAmount);
  const total = num(d.totalAmount);
  const amount = total > 0 ? total : excl > 0 ? round2(excl + Math.max(vat, 0)) : 0;

  const hours = num(d.hours);
  const rate = num(d.hourlyRate);
  const overtime = num(d.overtimeHours);
  const noteParts: string[] = [];
  if (hours > 0) noteParts.push(`Uren: ${formatHours(hours)}${rate > 0 ? ` à ${formatCurrency(rate)}` : ""}.`);
  if (overtime > 0) noteParts.push(`Overuren: ${formatHours(overtime)}.`);
  if (shifted) noteParts.push("BTW verlegd.");
  if (d.notes?.trim()) noteParts.push(d.notes.trim());

  return {
    number: (d.invoiceNumber ?? "").trim(),
    issueDate,
    periodStart,
    periodEnd,
    amount: money(amount),
    vatAmount: shifted || vat <= 0 ? null : money(vat),
    kilometers: quantity(num(d.kilometers)),
    notes: noteParts.join(" "),
  };
}

// --- uitlezing -------------------------------------------------------------

export type InvoiceCandidate = { id: string; name: string };

export type InvoiceExtractFailure = "niet-geconfigureerd" | "bestandstype" | "leeg" | "mislukt";

export type InvoiceExtractResult =
  | {
      ok: true;
      data: InvoiceExtracted;
      /** Voorgevulde formulierwaarden (review-first: nog niets opgeslagen). */
      values: ReceivedInvoiceFormValues;
      /** Alleen gevuld bij precies één naam-treffer. */
      matchedConsultantId: string | null;
      candidates: InvoiceCandidate[];
    }
  | { ok: false; reason: InvoiceExtractFailure; message: string };

function fail(reason: InvoiceExtractFailure, message: string): InvoiceExtractResult {
  return { ok: false, reason, message };
}

/** Best-effort: welke actieve medewerker hoort bij de uitgelezen naam? */
async function matchConsultant(
  name: string | null | undefined,
): Promise<{ matchedConsultantId: string | null; candidates: InvoiceCandidate[] }> {
  if (!name?.trim()) return { matchedConsultantId: null, candidates: [] };
  const consultants = await db.consultant.findMany({
    where: { active: true },
    select: { id: true, firstName: true, lastName: true },
  });
  const { match, candidates } = matchByName(consultants, name);
  return {
    matchedConsultantId: match?.id ?? null,
    candidates: candidates.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })),
  };
}

/**
 * Lees één ontvangen ZZP-factuur uit (PDF/afbeelding via het vision-model, of een
 * werkblad via de tekst-AI) en geef de voorgevulde formulierwaarden + een
 * naam-match terug. Slaat NIETS op.
 *
 * Gooit nooit: elke fout (geen sleutel, onleesbaar bestand, AI-fout) komt terug
 * als `{ ok: false, reason, message }`, zodat de wizard netjes kan terugvallen op
 * handmatig invullen.
 */
export async function extractReceivedInvoiceFromFile(input: {
  base64: string;
  /** Optionele hint; anders afgeleid uit mimeType/originalName. */
  mediaType?: string | null;
  originalName: string;
  mimeType: string;
}): Promise<InvoiceExtractResult> {
  try {
    await ensureAiKeysLoaded(); // serverless: sleutels uit de DB vóór de provider-keuze
    if (!input.base64) return fail("leeg", "Het bestand is leeg.");

    const now = new Date();
    const system = SYSTEM_EXTRACT + dateContext(now);
    let data: InvoiceExtracted;

    if (isSpreadsheet(input.originalName, input.mimeType)) {
      if (!isAIConfigured()) {
        return fail("niet-geconfigureerd", "Er is geen AI ingesteld om de factuur uit te lezen.");
      }
      const sheetText = excelToText(Buffer.from(input.base64, "base64"));
      if (!sheetText.trim()) return fail("leeg", "Leeg of onleesbaar werkblad.");
      data = await aiJSON<InvoiceExtracted>({
        system,
        prompt: `Hieronder de inhoud van een factuur die als werkblad is aangeleverd, elk blad als CSV (kolommen gescheiden door ';'). Door samengevoegde cellen kan het rommelig ogen — lees zorgvuldig en haal factuurnummer, factuurdatum, periode/week, uren, uurtarief, bedragen, btw en kilometers eruit. Geef het resultaat volgens het schema.\n\n${sheetText}`,
        schema: EXTRACT_SCHEMA,
        maxTokens: 2500,
        effort: "medium",
      });
    } else {
      const mediaType = invoiceMediaType(input.originalName, input.mimeType, input.mediaType);
      if (!mediaType) return fail("bestandstype", "Niet-ondersteund bestandstype (kies een PDF, afbeelding of werkblad).");
      if (!isVisionConfigured()) {
        return fail("niet-geconfigureerd", "Er is geen AI ingesteld om PDF's/afbeeldingen uit te lezen.");
      }
      data = await aiJSONFromFile<InvoiceExtracted>({
        system,
        prompt:
          "Lees deze factuur van een zelfstandige (ZZP'er) uit. Geef factuurnummer, factuurdatum, de gefactureerde periode (of het weeknummer + jaar), de uren, het uurtarief, eventuele overuren, het bedrag excl. btw, het btw-bedrag (of dat de btw verlegd is), de kilometers, het totaalbedrag en de naam van de afzender terug volgens het schema.",
        schema: EXTRACT_SCHEMA,
        file: { base64: input.base64, mediaType },
        maxTokens: 2500,
        effort: "medium",
      });
    }

    const { matchedConsultantId, candidates } = await matchConsultant(data?.name);
    return {
      ok: true,
      data,
      values: toReceivedInvoiceFormValues(data, now),
      matchedConsultantId,
      candidates,
    };
  } catch (e) {
    return fail("mislukt", e instanceof Error ? e.message : "De factuur kon niet uitgelezen worden.");
  }
}
