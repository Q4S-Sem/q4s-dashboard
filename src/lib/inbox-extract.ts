import { db } from "@/lib/db";
import { aiJSON, aiJSONFromFile } from "@/lib/ai";
import { readInboxBase64, readInboxBuffer } from "@/lib/uploads";
import { excelToText, isSpreadsheet } from "@/lib/excel";
import { resolveWeekStart, round2, formatHours } from "@/lib/utils";

// ---------------------------------------------------------------------------
// AI-uitlezing van één inbox-urenstaat (naam/week/uren/km/overuren + match op
// medewerker). Gedeeld door de handmatige upload/knop (inbox/actions.ts) én de
// e-mail-webhook (api/inbox/email), zodat ELKE binnengekomen bijlage — ook meer-
// dere in één mail (bv. week 29 én 30) — apart wordt uitgelezen en op zijn EIGEN
// week wordt gesorteerd (de week komt uit de staat zelf, niet uit de mail).
// ---------------------------------------------------------------------------

type Extracted = {
  name: string;
  weekStartDate: string;
  weekNumber: string;
  year: string;
  days: { date: string; hours: number }[];
  totalHours: number;
  reportedTotalHours: number;
  kilometers: number;
  reportedTotalKm: number;
  overtimeHours: number;
  project: string;
  notes: string;
};

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Volledige naam van de medewerker op de urenstaat (veld 'Name'/'Naam' of de handtekeningnaam). Leeg laten als onbekend." },
    weekStartDate: { type: "string", description: "De MAANDAG van de week als YYYY-MM-DD (het 'From'/'Van'-veld of de eerste dagkolom). Kies het jaar zó dat deze datum ÉCHT een maandag is en het dichtst bij vandaag ligt (zie CONTEXT) — gok geen eerder jaar. Een expliciet 2-cijferig jaar ('25') betekent 2025 (20xx)." },
    weekNumber: { type: "string", description: "Weeknummer als vermeld (bv. 'Week nr. 27'); anders lege string." },
    year: { type: "string", description: "Jaartal (4 cijfers) indien afleidbaar; anders lege string." },
    days: {
      type: "array",
      description: "Eén entry per weekdag met de datum en het OPGETELDE dagtotaal aan gewerkte uren: tel alle reguliere uren-regels (verschillende projecten/uurcodes) van die dag bij elkaar op, ZONDER overuren. Geef bij voorkeur alle 7 dagen (ma t/m zo), met 0 als er niet gewerkt is.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string", description: "Datum YYYY-MM-DD (of weekdagnaam ma/di/... als er geen datum bij de kolom staat)." },
          hours: { type: "number", description: "Totaal gewerkte uren die dag = som van alle reguliere regels, exclusief overuren." },
        },
        required: ["date", "hours"],
      },
    },
    totalHours: { type: "number", description: "Weektotaal aan gewerkte uren = de som van days (exclusief overuren)." },
    reportedTotalHours: { type: "number", description: "Het totaal aan gewerkte uren zoals de staat het ZELF vermeldt (bv. 'Hours worked Total: 40'). 0 als niet vermeld. Gebruik dit om je optelling te controleren." },
    kilometers: { type: "number", description: "Weektotaal aan gereden kilometers (reiskosten). Bij een From/To/Km-reisblok: neem het weektotaal (of tel de per-dag km op). 0 als er geen km op de staat staan." },
    reportedTotalKm: { type: "number", description: "Het kilometer-totaal zoals de staat het ZELF vermeldt (bv. 'Total Kilometers: 220'). 0 als niet vermeld." },
    overtimeHours: { type: "number", description: "Weektotaal aan OVERUREN/meeruren uit de aparte overuren-sectie (bv. 'Overtime Hrs. Total'). 0 als er geen overuren zijn." },
    project: { type: "string", description: "Project, opdrachtgever, locatie of uurcode indien vermeld (bv. 'HSM Stormpolder', 'Mistras'); anders lege string." },
    notes: { type: "string", description: "Onzekerheden of opvallende zaken, ALTIJD in het Nederlands (ook bij een Engelstalige staat); anders lege string." },
  },
  required: ["name", "weekStartDate", "weekNumber", "year", "days", "totalHours", "reportedTotalHours", "kilometers", "reportedTotalKm", "overtimeHours", "project", "notes"],
};

const SYSTEM_EXTRACT = `Je bent een uiterst nauwkeurige administratieve assistent bij Q4S, een Nederlands detacheringsbureau. Je leest binnengekomen WEEKstaten (timesheets) uit die door gedetacheerde vakmensen worden aangeleverd. Elke aanleverder gebruikt een eigen opmaak; herken ook het Q4S-formulier (FO-Q4S-18).

Haal de gegevens er EXACT uit zoals ze er staan. Verzin niets: laat een tekstveld leeg of zet een getal op 0 als je het niet zeker uit het document kunt halen. Antwoord volgens het JSON-schema.

BELANGRIJK — ÉÉN WEEK PER BESTAND: dit document is ÉÉN weekstaat. Bevat het toch meerdere weken, lees dan ALLEEN de week die bij dit bestand hoort (meestal de eerste/bovenste week-tabel) en negeer de rest; meng nooit dagen van verschillende weken door elkaar.

TAAL: schrijf alle vrije tekst — met name het veld "notes"/opmerkingen — ALTIJD in het NEDERLANDS, ook als de urenstaat in het Engels is. Feitelijke waarden (namen, projectcodes, nummers) neem je letterlijk over.

Zo lees je de onderdelen:

UREN (per dag OPTELLEN):
- De staat heeft meestal een raster met één kolom per weekdag (Ma/Di/Wo/Do/Vr/Za/Zo of Mo/Tu/We/Th/Fr/Sa/Su) en per kolom een datum.
- Er kunnen MEERDERE uren-regels per dag zijn (verschillende projecten/uurcodes, bv. een regel 'Intern' én een regel 'UT 2'). TEL die per dag OP tot één dagtotaal aan gewerkte uren.
- Voorbeeld: staat er onder maandag een 0 (Intern) en een 8 (UT 2), dan is het dagtotaal 8. Staat er donderdag een 2 en een 6, dan is dat 8.
- Overuren horen NIET bij de dag-uren (zie hieronder).
- Vul voor elke dag (ma t/m zo) een entry met datum en dagtotaal (0 als niet gewerkt).

OVERUREN:
- Er is vaak een aparte 'Overtime'/'Overuren'-sectie met eigen regel(s) en een totaal (bv. 'Overtime Hrs. Total'). Zet het WEEKtotaal aan overuren in overtimeHours. Geen overuren → 0.

KILOMETERS / reiskosten:
- Dit kan een apart blok zijn (vaak aan de rechterkant) met per dag From/To/Km-regels en een 'Total Kilometers'. Of een enkele km-kolom of -totaal.
- Zet het WEEKtotaal aan kilometers in kilometers. Staat er een expliciet totaal ('Total Kilometers'), gebruik dat; anders tel de per-dag km op. Geen km → 0.

DATUMS & WEEK:
- De staat toont een weekbereik ('From'/'Van' en 'To'/'Tot') en/of per-kolom datums als '29-jun-25'.
- Zet datums om naar YYYY-MM-DD. Een 2-cijferig jaar ('25') betekent 2025 (20xx). Zowel Nederlandse als Engelse maand-/dagafkortingen komen voor (jun/jul ↔ jun/jul, mrt ↔ mar, ma/di ↔ Mo/Tu).
- weekStartDate = de MAANDAG (het 'From'-veld of de eerste dagkolom).

CONTROLE:
- Vul reportedTotalHours en reportedTotalKm met de totalen die de staat ZELF vermeldt ('Hours worked Total', 'Total Kilometers'). Laat je dag-optelling (totalHours) hiermee kloppen; wijkt het af, noem dat kort in notes.

NAAM: name = de naam van de medewerker.

Zaterdag- en zonduren leiden wij zelf af uit de datums; vul de uren gewoon bij de juiste dag/datum in.`;

const WEEKDAY_NL = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

/** Datum-/jaar-context, aangehangen aan de systeemprompt zodat het model het jaar
 *  niet fout gokt bij staten die alleen dag+maand vermelden. */
function dateContext(today: Date): string {
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  return `\n\nCONTEXT — datum & jaar:
- Vandaag is ${iso} (${WEEKDAY_NL[today.getDay()]}).
- Vermeldt de staat GEEN jaartal (vaak alleen dag+maand zoals "13-jul"), kies dan het jaar zó dat de weekdag-labels kloppen met de datums: de Ma/Mo-kolom moet een ÉCHTE maandag zijn. Voorbeeld: "Ma 13-jul" valt alleen in een jaar waarin 13 juli daadwerkelijk een maandag is.
- Kies bij twijfel het jaar het dichtst bij vandaag (bijna altijd het huidige jaar) — NOOIT zomaar een eerder jaar. weekStartDate = de maandag met dat correcte jaar.`;
}

/** Parse "YYYY-MM-DD" → {month, day} (jaar genegeerd). Null bij ongeldig formaat. */
function parseMonthDay(s?: string | null): { month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  return { month: Number(m[2]), day: Number(m[3]) };
}

/** Loosely compare an extracted name to a consultant's first + last name. */
function nameMatches(
  c: { firstName: string; lastName: string },
  extracted: string,
): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const tokens = new Set(norm(extracted).split(" ").filter(Boolean));
  if (tokens.size === 0) return false;
  // Require every part of the first AND last name to appear as a whole token,
  // so "An Berg" does not match "Johanna van den Berg".
  const parts = [...norm(c.firstName).split(" "), ...norm(c.lastName).split(" ")].filter(Boolean);
  return parts.length > 0 && parts.every((p) => tokens.has(p));
}

/**
 * Core AI extraction for ONE inbox item (name/week/hours/km/overtime + best-effort
 * consultant match). Throws on any failure (no redirect) so it's reusable by the
 * manual "uitlezen" button, the bulk/ZIP upload auto-read, én de e-mail-webhook.
 * De week komt UIT de staat zelf → meerdere bijlagen sorteren elk op hun eigen week.
 */
export async function runInboxExtraction(id: string): Promise<void> {
  const item = await db.timesheetInbox.findUnique({ where: { id } });
  if (!item) throw new Error("Inbox-item niet gevonden.");

  const lowerName = item.originalName.toLowerCase();
  const spreadsheet = isSpreadsheet(item.originalName, item.mimeType);
  let mediaType = "";
  if (!spreadsheet) {
    if (item.mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
      mediaType = "application/pdf";
    } else if (/^image\/(png|jpe?g|gif|webp)$/.test(item.mimeType)) {
      mediaType = item.mimeType;
    } else {
      throw new Error("Niet-ondersteund bestandstype.");
    }
  }

  let sheetText = "";
  if (spreadsheet) {
    sheetText = excelToText(await readInboxBuffer(item.fileName));
    if (!sheetText.trim()) throw new Error("Leeg of onleesbaar werkblad.");
  }

  const now = new Date();
  const system = SYSTEM_EXTRACT + dateContext(now);

  const data = spreadsheet
    ? await aiJSON<Extracted>({
        system,
        prompt: `Hieronder de inhoud van een binnengekomen Excel-urenstaat, elk werkblad als CSV (kolommen gescheiden door ';'). Door samengevoegde cellen en soms een twee-koloms layout (uren links, kilometers rechts) kan het rommelig ogen — lees zorgvuldig, TEL meerdere uren-regels per dag op tot één dagtotaal (excl. overuren), haal de overuren uit de aparte overuren-sectie en de kilometers uit het reisblok of het 'Total Kilometers'-totaal. Geef het resultaat volgens het schema.\n\n${sheetText}`,
        schema: EXTRACT_SCHEMA,
        maxTokens: 2500,
        effort: "medium",
      })
    : await aiJSONFromFile<Extracted>({
        system,
        prompt:
          "Lees deze weekstaat (timesheet) uit. Let op: tel per dag ALLE reguliere uren-regels op tot één dagtotaal (excl. overuren), haal de overuren uit de aparte overuren-sectie, en de kilometers uit het reisblok (From/To/Km) of het 'Total Kilometers'-veld. Geef naam, week (maandag), de uren per dag, het weektotaal, de kilometers en de overuren terug volgens het schema.",
        schema: EXTRACT_SCHEMA,
        file: { base64: await readInboxBase64(item.fileName), mediaType },
        maxTokens: 2500,
        effort: "medium",
      });

  // Bepaal de maandag robuust: het AI-model kan het JAAR verkeerd gokken (een staat
  // vermeldt vaak alleen dag+maand). resolveWeekStart kiest het jaar waarin de
  // maandag-kolom écht een maandag is, het dichtst bij vandaag — tenzij de staat een
  // eigen jaartal noemt. Zonder dit sprong bv. "Ma 13-jul" (maandag pas in 2026) via
  // het gegokte 2025 naar de verkeerde week, waardoor de dag-uren fout gemapt werden.
  const explicitYear = /^\d{4}$/.test((data.year ?? "").trim())
    ? Number((data.year ?? "").trim())
    : null;
  const monthDay =
    parseMonthDay(data.weekStartDate) ??
    parseMonthDay((data.days ?? []).find((d) => /^\d{4}-\d{2}-\d{2}$/.test(d?.date ?? ""))?.date);
  const weekStart = resolveWeekStart(monthDay, explicitYear, now);

  // Reconciliatie: de dag-optelling is wat straks de urenstaat wordt. Vergelijk
  // met het door de staat vermelde totaal en meld een afwijking. Kies voor km het
  // expliciet vermelde totaal (bv. 'Total Kilometers: 220') als dat er is.
  const daySum = round2(
    (data.days ?? []).reduce((s, d) => s + (typeof d.hours === "number" && d.hours > 0 ? d.hours : 0), 0),
  );
  const statedHours =
    typeof data.reportedTotalHours === "number" && data.reportedTotalHours > 0 ? data.reportedTotalHours : null;
  const finalHours =
    daySum > 0 ? daySum : typeof data.totalHours === "number" && data.totalHours > 0 ? data.totalHours : statedHours;
  const statedKm =
    typeof data.reportedTotalKm === "number" && data.reportedTotalKm > 0 ? data.reportedTotalKm : null;
  const finalKm = statedKm ?? (typeof data.kilometers === "number" && data.kilometers > 0 ? data.kilometers : null);

  const noteParts: string[] = [];
  if (statedHours != null && daySum > 0 && Math.abs(statedHours - daySum) > 0.01) {
    noteParts.push(
      `Let op: opgeteld dagtotaal (${formatHours(daySum)} u) wijkt af van het op de staat vermelde totaal (${formatHours(statedHours)} u) — controleer de uren.`,
    );
  }
  if (data.notes?.trim()) noteParts.push(data.notes.trim());
  const aiNotes = noteParts.join(" ") || null;

  // Best-effort match to a consultant by name (+ their single active placement).
  let consultantId: string | null = null;
  let placementId: string | null = null;
  if (data.name && data.name.trim()) {
    const consultants = await db.consultant.findMany({
      include: { placements: { where: { status: "ACTIVE" } } },
    });
    const matches = consultants.filter((c) => nameMatches(c, data.name));
    if (matches.length === 1) {
      consultantId = matches[0].id;
      if (matches[0].placements.length === 1) placementId = matches[0].placements[0].id;
    }
  }

  await db.timesheetInbox.update({
    where: { id },
    data: {
      status: "EXTRACTED",
      extractedName: data.name?.trim() || null,
      extractedWeekStart: weekStart,
      extractedTotalHours: finalHours ?? null,
      extractedKilometers: finalKm,
      extractedOvertimeHours:
        typeof data.overtimeHours === "number" && data.overtimeHours > 0 ? data.overtimeHours : null,
      extractedJson: JSON.stringify(data),
      aiNotes,
      consultantId,
      placementId,
    },
  });
}
