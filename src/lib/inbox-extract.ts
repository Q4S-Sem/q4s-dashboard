import { db } from "@/lib/db";
import { aiJSON, aiJSONFromFile } from "@/lib/ai";
import { readInboxBase64, readInboxBuffer } from "@/lib/uploads";
import { excelToText, isSpreadsheet } from "@/lib/excel";
import { matchByName } from "@/lib/name-match";
import {
  buildCorrectionHint,
  correctionFieldLabel,
  correctionFieldUnit,
  learnedSuggestions,
  type CorrectionPair,
  type LearnedSuggestion,
} from "@/lib/timesheet-correction-core";
import { distributeDayHours, resolveWeekStart, round2, formatHours } from "@/lib/utils";

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
  confidence: string;
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
      description: "Eén entry per weekdag met de datum en het OPGETELDE dagtotaal aan gewerkte uren: tel alle reguliere uren-regels (verschillende projecten/uurcodes) van die dag bij elkaar op, ZONDER overuren uit een aparte overuren-sectie. Lees elk getal onder ZIJN EIGEN dag/datum-kolomkop (kolom voor kolom, links naar rechts); een lege dagkolom blijft 0 — schuif de ingevulde getallen NOOIT naar links naar eerdere dagen. Uren op zaterdag/zondag horen gewoon in de entry van die dag. Geef bij voorkeur alle 7 dagen (ma t/m zo), met 0 als er niet gewerkt is.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string", description: "Datum YYYY-MM-DD (of weekdagnaam ma/di/... als er geen datum bij de kolom staat)." },
          hours: { type: "number", description: "Totaal gewerkte uren die dag = som van alle regels die ONDER de kolomkop van déze dag staan, exclusief overuren uit een aparte overuren-sectie. Staat er onder deze dag niets, dan 0 (niet opvullen met uren van een andere kolom). Zaterdag-/zondaguren horen hier gewoon bij." },
        },
        required: ["date", "hours"],
      },
    },
    totalHours: { type: "number", description: "Weektotaal aan gewerkte uren = de som van days (exclusief overuren)." },
    reportedTotalHours: { type: "number", description: "Het totaal aan gewerkte uren zoals de staat het ZELF vermeldt (bv. 'Hours worked Total: 40'). 0 als niet vermeld. Gebruik dit om je optelling te controleren." },
    kilometers: { type: "number", description: "Weektotaal aan gereden kilometers (reiskosten). Bij een From/To/Km-reisblok: neem het weektotaal (of tel de per-dag km op). 0 als er geen km op de staat staan." },
    reportedTotalKm: { type: "number", description: "Het kilometer-totaal zoals de staat het ZELF vermeldt (bv. 'Total Kilometers: 220'). 0 als niet vermeld." },
    overtimeHours: { type: "number", description: "Weektotaal aan OVERUREN/meeruren UITSLUITEND uit een apart als zodanig gelabelde overuren-sectie/kolom ('Overtime', 'Overuren', bv. 'Overtime Hrs. Total'). Uren op zaterdag/zondag zijn GEEN overuren — die horen in days bij die dag. Geen expliciete overuren-sectie → 0." },
    project: { type: "string", description: "Project, opdrachtgever, locatie of uurcode indien vermeld (bv. 'HSM Stormpolder', 'Mistras'); anders lege string." },
    notes: { type: "string", description: "Onzekerheden of opvallende zaken, ALTIJD in het Nederlands (ook bij een Engelstalige staat); anders lege string." },
    confidence: { type: "string", enum: ["high", "medium", "low"], description: "Hoe zeker ben je over deze uitlezing? 'low' als de opmaak onduidelijk was, cijfers slecht leesbaar zijn, of je moest gokken; 'high' als alles helder en eenduidig was; anders 'medium'." },
  },
  required: ["name", "weekStartDate", "weekNumber", "year", "days", "totalHours", "reportedTotalHours", "kilometers", "reportedTotalKm", "overtimeHours", "project", "notes", "confidence"],
};

const SYSTEM_EXTRACT = `Je bent een uiterst nauwkeurige administratieve assistent bij Q4S, een Nederlands detacheringsbureau. Je leest binnengekomen WEEKstaten (timesheets) uit die door gedetacheerde vakmensen worden aangeleverd. Elke aanleverder gebruikt een eigen opmaak; herken ook het Q4S-formulier (FO-Q4S-18).

Haal de gegevens er EXACT uit zoals ze er staan. Verzin niets: laat een tekstveld leeg of zet een getal op 0 als je het niet zeker uit het document kunt halen. Antwoord volgens het JSON-schema.

BELANGRIJK — ÉÉN WEEK PER BESTAND: dit document is ÉÉN weekstaat. Bevat het toch meerdere weken, lees dan ALLEEN de week die bij dit bestand hoort (meestal de eerste/bovenste week-tabel) en negeer de rest; meng nooit dagen van verschillende weken door elkaar.

TAAL: schrijf alle vrije tekst — met name het veld "notes"/opmerkingen — ALTIJD in het NEDERLANDS, ook als de urenstaat in het Engels is. Feitelijke waarden (namen, projectcodes, nummers) neem je letterlijk over.

Zo lees je de onderdelen:

UREN (per dag OPTELLEN):
- De staat heeft meestal een raster met één kolom per weekdag (Ma/Di/Wo/Do/Vr/Za/Zo of Mo/Tu/We/Th/Fr/Sa/Su) en per kolom een datum.
- ⚠️ KOLOM-UITLIJNING — DIT IS DE BELANGRIJKSTE REGEL: elk getal hoort bij de dag/datum-kolom waar het ONDER staat. Lees kolom voor kolom van LINKS naar RECHTS en koppel elke cel aan de weekdag waarvan de kop er PRECIES BOVEN staat. Volg de kolomkop, niet de volgorde waarin de getallen toevallig in beeld komen.
- Is een dagkolom LEEG (of bevat hij een streepje/0), dan is die dag 0. Schuif NOOIT de ingevulde getallen naar links om ze bij maandag te laten beginnen ('left-packen'): een lege dag blijft 0, ook als de ingevulde getallen daardoor pas LATER in de week staan.
- Voorbeeld (verplicht zo doen): 'Ma leeg, Di t/m Vr = 8, Za = 3' → Ma=0, Di=8, Wo=8, Do=8, Vr=8, Za=3, Zo=0. NIET Ma=8, Di=8, Wo=8, Do=8, Vr=0, Za=0.
- Controleer per ingevulde cel: welke dagkop/datum staat hier exact boven? Twijfel je over de uitlijning van de kolommen, zet confidence dan op 'low' en meld het in notes.
- Er kunnen MEERDERE uren-regels per dag zijn (verschillende projecten/uurcodes, bv. een regel 'Intern' én een regel 'UT 2'). TEL die per dag OP tot één dagtotaal aan gewerkte uren.
- Voorbeeld: staat er onder maandag een 0 (Intern) en een 8 (UT 2), dan is het dagtotaal 8. Staat er donderdag een 2 en een 6, dan is dat 8.
- Uren op ZATERDAG of ZONDAG zijn gewone dag-uren van die weekenddag: zet ze in de entry van die dag (Za/Zo), NOOIT in overtimeHours.
- Overuren uit een aparte overuren-sectie horen NIET bij de dag-uren (zie hieronder).
- Vul voor elke dag (ma t/m zo) een entry met datum en dagtotaal (0 als niet gewerkt).

OVERUREN:
- overtimeHours is UITSLUITEND het totaal uit een duidelijk APARTE sectie/kolom die zelf als overuren is gelabeld ('Overtime', 'Overuren', 'Meeruren', bv. 'Overtime Hrs. Total'). Alleen dát telt als overuren.
- Uren gewerkt op ZATERDAG of ZONDAG zijn GEEN overuren. Het zijn normale dag-uren van die weekenddag (wij rekenen daar zelf een weekendtoeslag over) en horen in de entry van die dag in days. Zet weekenduren dus NOOIT in overtimeHours.
- Heeft de staat geen expliciete overuren-sectie, dan is overtimeHours = 0 — ook als er wel op zaterdag/zondag is gewerkt.

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

// --- correctie-geheugen per plaatsing --------------------------------------
//
// Eerlijk: het AI-model wordt hier NIET bijgetraind. We houden per plaatsing bij
// wat de AI las tegenover wat de mens ervan maakte (TimesheetCorrection, gevuld
// bij het bevestigen in inbox-confirm.ts) en zetten dat twee keer in:
//
//   • vóór de uitlezing als aandachtspunt in het prompt (buildCorrectionHint);
//   • ná de uitlezing als zichtbaar VOORSTEL, maar alleen voor een fout die de
//     mens al minstens twee keer identiek verbeterde én die nu terugkomt.
//
// Het oordeel zelf is puur en getest: src/lib/timesheet-correction-core.ts.

/** Hoeveel eerdere correcties we van een plaatsing meenemen. */
const CORRECTION_HISTORY = 3;

/** De laatste correcties van deze plaatsing, nieuwste eerst. */
async function correctieHistorie(placementId: string | null): Promise<CorrectionPair[]> {
  if (!placementId) return [];
  const rows = await db.timesheetCorrection.findMany({
    where: { placementId },
    orderBy: { createdAt: "desc" },
    take: CORRECTION_HISTORY,
  });
  return rows.flatMap((r) => {
    try {
      return [{ ai: JSON.parse(r.aiJson), human: JSON.parse(r.humanJson) } as CorrectionPair];
    } catch {
      return [];
    }
  });
}

/**
 * De plaatsing waarvan we VÓÓR de uitlezing al weten dat hij erbij hoort — nodig
 * omdat de hint met het prompt mee moet, terwijl de naam-match pas ná de uitlezing
 * rond is. Dat is het geval bij "opnieuw uitlezen" van een al gekoppeld item, en
 * bij een medewerker met precies één actieve plaatsing. Weten we het niet, dan
 * gaat de scan gewoon zonder hint — precies zoals voorheen.
 */
async function bekendePlaatsing(item: {
  placementId: string | null;
  consultantId: string | null;
}): Promise<string | null> {
  if (item.placementId) return item.placementId;
  if (!item.consultantId) return null;
  const actief = await db.placement.findMany({
    where: { consultantId: item.consultantId, status: "ACTIVE" },
    select: { id: true },
  });
  return actief.length === 1 ? actief[0].id : null;
}

/** De i-de dag ná de maandag als "YYYY-MM-DD" (lokaal, net als de rest). */
function isoDatum(monday: Date, i: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Ma (8 → 0 u)" — hoe het scherm en de vlag een geleerde correctie noemen. */
function suggestieLabel(s: LearnedSuggestion): string {
  const eenheid = correctionFieldUnit(s.field);
  return `${correctionFieldLabel(s.field)} (${formatHours(s.from)} → ${formatHours(s.to)} ${eenheid})`;
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

  // Leer-lus: aandachtspunten uit eerdere correcties voor deze afzender meegeven,
  // zodat de AI die punten (die eerder misgingen) extra controleert.
  const senderKey = item.senderEmail?.trim().toLowerCase() || null;
  let senderHints = "";
  if (senderKey) {
    const profile = await db.senderProfile.findUnique({ where: { key: senderKey } });
    if (profile?.hints.trim()) senderHints = profile.hints.trim();
  }

  // Tweede leer-lus: de correcties van DEZE plaatsing (per dag/overuren/km).
  // Alleen bruikbaar als de plaatsing nu al bekend is — de naam-match komt pas ná
  // de uitlezing. Is hij dat niet, dan blijft het prompt onveranderd.
  const bekendeId = await bekendePlaatsing(item);
  const vooraf = await correctieHistorie(bekendeId);
  const correctieHint = buildCorrectionHint(vooraf);

  const now = new Date();
  const system =
    SYSTEM_EXTRACT +
    dateContext(now) +
    (senderHints
      ? `\n\nLET OP — AANDACHTSPUNTEN bij deze afzender (uit eerdere correcties; deze gingen eerder mis, controleer ze hier extra — laat je niet leiden naar één vast getal, kijk gewoon extra goed):\n${senderHints}`
      : "") +
    (correctieHint ? `\n\n${correctieHint}` : "");

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

  // De totalen die de staat ZELF vermeldt — de maatstaf voor de reconciliatie
  // hieronder, en (voor km) wat er zonder tegenbericht wordt vastgelegd.
  const statedHours =
    typeof data.reportedTotalHours === "number" && data.reportedTotalHours > 0 ? data.reportedTotalHours : null;
  const statedKm =
    typeof data.reportedTotalKm === "number" && data.reportedTotalKm > 0 ? data.reportedTotalKm : null;
  const gelezenKm =
    statedKm ?? (typeof data.kilometers === "number" && data.kilometers > 0 ? data.kilometers : null);

  // Best-effort match to a consultant by name (+ their single active placement).
  // Bewust vóór de reconciliatie: pas mét de plaatsing in de hand kunnen de
  // geleerde correcties van deze persoon nog op de uitlezing worden toegepast.
  let consultantId: string | null = null;
  let placementId: string | null = null;
  if (data.name && data.name.trim()) {
    const consultants = await db.consultant.findMany({
      include: { placements: { where: { status: "ACTIVE" } } },
    });
    const { match } = matchByName(consultants, data.name);
    if (match) {
      consultantId = match.id;
      if (match.placements.length === 1) placementId = match.placements[0].id;
    }
  }

  // Geleerde correcties toepassen: alleen waar de mens dezelfde fout al minstens
  // twee keer identiek verbeterde én de AI hem nu opnieuw maakt. Nooit stil — wat
  // er verandert gaat als learnedJson mee naar het controle-scherm, staat als vlag
  // bij de uitlezing, en is daar gewoon te overschrijven.
  const historie =
    placementId && placementId !== bekendeId ? await correctieHistorie(placementId) : vooraf;
  const gelezenDagen = distributeDayHours(data.days ?? [], weekStart);
  const suggesties = placementId
    ? learnedSuggestions(historie, {
        dagUren: gelezenDagen,
        overuren: data.overtimeHours,
        kilometers: gelezenKm,
      })
    : [];
  let kmGeleerd = false;
  if (suggesties.length > 0) {
    const dagen = gelezenDagen.map((h) => (h === "" ? 0 : h));
    for (const s of suggesties) {
      if (s.field === "overuren") data.overtimeHours = s.to;
      else if (s.field === "kilometers") {
        data.kilometers = s.to;
        kmGeleerd = true;
      } else dagen[Number(s.field.slice(3))] = s.to;
    }
    // De dagregels opnieuw opschrijven op de maandag van déze week: het scherm
    // leest de uren uit extractedJson, dus daar moet het resultaat in staan.
    // Zonder bekende maandag blijven de datums leeg — dan leest het scherm ze
    // (net als nu) positioneel als Ma..Zo.
    data.days = dagen.map((hours, i) => ({
      date: weekStart ? isoDatum(weekStart, i) : "",
      hours,
    }));
    data.totalHours = round2(dagen.reduce((som, h) => som + h, 0));
  }

  // Reconciliatie: de dag-optelling is wat straks de urenstaat wordt. Vergelijk
  // met het door de staat vermelde totaal en meld een afwijking. Kies voor km het
  // expliciet vermelde totaal (bv. 'Total Kilometers: 220') als dat er is — tenzij
  // een geleerde correctie de km net heeft bijgesteld.
  const daySum = round2(
    (data.days ?? []).reduce((s, d) => s + (typeof d.hours === "number" && d.hours > 0 ? d.hours : 0), 0),
  );
  const finalHours =
    daySum > 0 ? daySum : typeof data.totalHours === "number" && data.totalHours > 0 ? data.totalHours : statedHours;
  const finalKm = kmGeleerd
    ? (typeof data.kilometers === "number" && data.kilometers > 0 ? data.kilometers : null)
    : gelezenKm;

  const noteParts: string[] = [];
  if (statedHours != null && daySum > 0 && Math.abs(statedHours - daySum) > 0.01) {
    noteParts.push(
      `Let op: opgeteld dagtotaal (${formatHours(daySum)} u) wijkt af van het op de staat vermelde totaal (${formatHours(statedHours)} u) — controleer de uren.`,
    );
  }
  if (data.notes?.trim()) noteParts.push(data.notes.trim());
  const aiNotes = noteParts.join(" ") || null;

  // Controle-vangnet: harde checks → vlaggen + 'moet nagekeken worden'.
  const confidence = ["high", "medium", "low"].includes((data.confidence ?? "").toLowerCase())
    ? (data.confidence as string).toLowerCase()
    : "medium";
  const flags: { level: "error" | "warn"; message: string }[] = [];
  const hoursMismatch = statedHours != null && daySum > 0 && Math.abs(statedHours - daySum) > 0.01;
  if (hoursMismatch) {
    flags.push({
      level: "warn",
      message: `Opgeteld dagtotaal (${formatHours(daySum)} u) wijkt af van het vermelde totaal (${formatHours(statedHours!)} u).`,
    });
  }
  const kmVal = typeof data.kilometers === "number" ? data.kilometers : 0;
  const kmMismatch = statedKm != null && kmVal > 0 && Math.abs(statedKm - kmVal) > 0.01;
  if (kmMismatch) {
    flags.push({
      level: "warn",
      message: `Kilometer-optelling (${formatHours(kmVal)} km) wijkt af van het vermelde totaal (${formatHours(statedKm!)} km).`,
    });
  }
  if (!finalHours || finalHours <= 0) {
    flags.push({ level: "error", message: "Geen gewerkte uren gevonden — controleer de staat." });
  } else if (finalHours > 80) {
    flags.push({
      level: "warn",
      message: `Ongebruikelijk veel uren (${formatHours(finalHours)} u) voor één week — controleer.`,
    });
  }
  if (!consultantId) {
    flags.push({ level: "warn", message: "Geen medewerker automatisch gematcht — controleer de naam/plaatsing." });
  }
  if (confidence === "low") {
    flags.push({ level: "warn", message: "De AI was onzeker over deze uitlezing — controleer alles goed." });
  }
  if (suggesties.length > 0) {
    flags.push({
      level: "warn",
      message: `Op basis van eerdere correcties bijgesteld: ${suggesties.map(suggestieLabel).join(", ")} — controleer het even.`,
    });
  }
  const needsReview =
    flags.some((f) => f.level === "error") ||
    hoursMismatch ||
    kmMismatch ||
    !consultantId ||
    confidence === "low" ||
    // Geleerd is niet hetzelfde als zeker: hier hoort een mens naar te kijken.
    suggesties.length > 0;

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
      confidence,
      needsReview,
      reviewFlags: flags.length ? JSON.stringify(flags) : null,
      learnedJson: suggesties.length ? JSON.stringify(suggesties) : null,
      consultantId,
      placementId,
    },
  });
}
