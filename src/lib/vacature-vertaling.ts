import { unstable_cache } from "next/cache";
import { aiJSON, readyTextProvider } from "@/lib/ai";
import { DISCIPLINES } from "@/lib/domain";
import { zonderKlantnaam } from "@/lib/klantnaam-publiek";
import {
  checkVertaling,
  splitLines,
  VACATURE_LIJST_VELDEN as LIST_FIELDS,
  VACATURE_TEKST_VELDEN as STR_FIELDS,
  type VacatureTekst,
} from "@/lib/public-api";

/**
 * Engelse vertaling van de PUBLIEKE vacaturetekst voor q4s.nl/en.
 *
 * Geen DB-kolommen: de vertaling staat in de Next data-cache, gesleuteld op
 * slug + updatedAt. Elke bewerking van de vacature geeft dus vanzelf een nieuwe
 * vertaling; ongewijzigde vacatures kosten maar één AI-call ooit.
 * Input is al ontdaan van de klantnaam (zonderKlantnaam) en bevat geen
 * persoonsgegevens — het is tekst die toch al publiek op de site staat.
 * Faalt de AI (niet geconfigureerd, timeout, rare output), dan valt de feed
 * terug op de Nederlandse tekst; een fout wordt nooit gecachet.
 */

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...STR_FIELDS, ...LIST_FIELDS],
  properties: {
    ...Object.fromEntries(STR_FIELDS.map((k) => [k, { type: "string" }])),
    ...Object.fromEntries(LIST_FIELDS.map((k) => [k, { type: "array", items: { type: "string" } }])),
  },
};

const SYSTEM = `You translate Dutch job vacancies of a technical recruitment agency (steel construction, QA/QC, NDT, inspection, offshore) into natural British English.
Rules:
- Translate every field. Keep the meaning, tone and level of detail; do not add or drop information.
- Use the job titles English-speaking candidates search for (e.g. "Voorman" -> "Foreman", "Lasser" -> "Welder", "Uitvoerder" -> "Site Supervisor"). Keep titles that are already English unchanged.
- "NDO" (niet-destructief onderzoek) -> "NDT". Keep certifications, standards and acronyms as-is (VCA, ISO 9606, EN 1090, CSWIP, PCN, ASME, IWI-C, VT/MT/UT/PT/RT).
- Country/place names in English ("Duitsland" -> "Germany", "Nederland" -> "the Netherlands"); Dutch city names stay as they are.
- Employment types: "Vast" -> "Permanent", "Tijdelijk" -> "Temporary", "ZZP/Freelance" -> "Freelance", "Detachering" -> "Secondment", "Uitzenden" -> "Temporary (agency)".
- Lists: return exactly the same number of items in the same order.
- Empty input string -> empty output string.`;

function toAi(nl: VacatureTekst) {
  return Object.fromEntries([
    ...STR_FIELDS.map((k) => [k, nl[k] ?? ""]),
    ...LIST_FIELDS.map((k) => [k, nl[k]]),
  ]);
}

async function translate(nl: VacatureTekst): Promise<VacatureTekst> {
  const provider = readyTextProvider();
  if (!provider) throw new Error("geen AI-provider");
  const en = await aiJSON<Record<string, unknown>>({
    system: SYSTEM,
    prompt: JSON.stringify(toAi(nl)),
    schema: SCHEMA,
    schemaName: "vacancy_en",
    provider,
    maxTokens: 4000,
    effort: "low",
  });
  return checkVertaling(nl, en);
}

/** Engelse versie van een publieke vacature; bij elke fout de Nederlandse tekst. */
export async function vacatureInHetEngels(cacheKey: string, nl: VacatureTekst): Promise<VacatureTekst> {
  try {
    return await unstable_cache(() => translate(nl), ["vacature-en-v1", cacheKey], { revalidate: false })();
  } catch (e) {
    console.error("[vacature-vertaling]", cacheKey, e instanceof Error ? e.message : e);
    return nl;
  }
}

/** `?lang=en` op een publiek endpoint? */
export function wiltEngels(req: Request): boolean {
  return new URL(req.url).searchParams.get("lang") === "en";
}

type PubliekeVacature = {
  title: string;
  discipline: string | null;
  location: string | null;
  employmentType: string | null;
  salary: string | null;
  summary: string | null;
  responsibilities: string | null;
  requirements: string | null;
  niceToHave: string | null;
  improvedText: string | null;
  companyName: string | null;
  client?: { companyName: string } | null;
};

/** De publieke (klantnaam-vrije) tekstvelden van een vacature — gedeeld door lijst en detail. */
export function publiekeTekst(v: PubliekeVacature): VacatureTekst {
  const klant = [v.client?.companyName, v.companyName];
  const schoon = (t: string | null) => zonderKlantnaam(t, klant);
  const responsibilities = splitLines(v.responsibilities).map((t) => zonderKlantnaam(t, klant));
  const requirements = splitLines(v.requirements).map((t) => zonderKlantnaam(t, klant));
  const niceToHave = splitLines(v.niceToHave).map((t) => zonderKlantnaam(t, klant));
  const summary = schoon(v.summary);
  const hasStructured = Boolean(summary) || responsibilities.length > 0 || requirements.length > 0;
  return {
    title: schoon(v.title) ?? v.title,
    location: schoon(v.location),
    employmentType: v.employmentType,
    salary: v.salary,
    disciplineLabel: v.discipline ? (DISCIPLINES.find((d) => d.value === v.discipline)?.label ?? v.discipline) : null,
    summary,
    responsibilities,
    requirements,
    niceToHave,
    // Volledige verbeterde tekst alleen als er geen gestructureerde secties zijn.
    fullText: !hasStructured ? schoon(v.improvedText) : null,
  };
}

/** Publieke tekst, desgewenst in het Engels (cache-sleutel = slug + laatste wijziging). */
export async function publiekeTekstIn(
  v: PubliekeVacature & { slug: string; updatedAt: Date },
  engels: boolean,
): Promise<VacatureTekst> {
  const nl = publiekeTekst(v);
  return engels ? vacatureInHetEngels(`${v.slug}:${v.updatedAt.getTime()}`, nl) : nl;
}
