import { db } from "./db";
import { aiJSON } from "./ai";
import { RECRUITMENT_FIELDS } from "./domain";

// Shared AI cores for the recruitment vacancy pipeline. These throw on failure
// (no redirect) so they can be reused by single-vacancy server actions AND the
// Vacaturehub bulk actions.

const RELEVANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevant: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["relevant", "reason"],
} as const;

const IMPROVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    responsibilities: { type: "array", items: { type: "string" } },
    requirements: { type: "array", items: { type: "string" } },
    niceToHave: { type: "array", items: { type: "string" } },
    improvedText: { type: "string" },
    linkedinPost: { type: "string" },
    location: { type: "string" },
    employmentType: { type: "string" },
    salary: { type: "string" },
  },
  required: [
    "summary",
    "responsibilities",
    "requirements",
    "niceToHave",
    "improvedText",
    "linkedinPost",
    "location",
    "employmentType",
    "salary",
  ],
} as const;

const RELEVANCE_SYSTEM = `Je bepaalt of een vacature past binnen de niche van Q4S, een Nederlands detacheringsbureau voor technisch personeel.

Q4S richt zich uitsluitend op de volgende vakgebieden:
${RECRUITMENT_FIELDS.map((f) => `- ${f}`).join("\n")}

Een vacature is relevant als de functie duidelijk binnen één of meer van deze vakgebieden valt. Twijfel je sterk of valt de vacature buiten deze niche (bijv. administratie, sales, IT, horeca), dan is hij niet relevant. Geef een korte, zakelijke onderbouwing in het Nederlands.`;

const IMPROVE_SYSTEM = `Je bent een ervaren recruitment-copywriter bij Q4S, een Nederlands detacheringsbureau gespecialiseerd in technisch personeel in de sectoren QA, QC, lassen/welding, coating, HSE, inspectie, E&I, civiel, offshore, commissioning, project management en NDO/NDT.

Je schrijft wervende, professionele en geloofwaardige vacatureteksten in helder, vlot Nederlands. Je kent het technische vakjargon en gebruikt dit waar het past, maar blijft toegankelijk. Je verzint nooit feiten die niet in de aangeleverde tekst staan; ontbrekende informatie laat je weg.

Je levert altijd PLATTE TEKST aan met natuurlijke regelafbrekingen en lege regels tussen onderdelen. Gebruik NOOIT markdown-symbolen zoals #, *, of opsommingstekens met sterretjes.`;

/** AI relevance verdict for the Q4S niche; updates relevance + reason. Cheap (fast model). */
export async function aiFilterVacancy(
  vacancyId: string,
): Promise<"RELEVANT" | "IRRELEVANT"> {
  const vacancy = await db.vacancy.findUnique({ where: { id: vacancyId } });
  if (!vacancy) throw new Error("Vacature niet gevonden.");

  const context = [
    `Titel: ${vacancy.title}`,
    vacancy.discipline ? `Discipline: ${vacancy.discipline}` : null,
    "",
    "VACATURETEKST:",
    vacancy.rawText,
  ]
    .filter((v) => v !== null)
    .join("\n");

  const result = await aiJSON<{ relevant: boolean; reason: string }>({
    system: RELEVANCE_SYSTEM,
    prompt: `Beoordeel of de onderstaande vacature binnen de niche van Q4S past.\n\n${context}`,
    schema: RELEVANCE_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "vacancy_relevance",
    fast: true,
    maxTokens: 600,
  });

  const relevance = result.relevant ? "RELEVANT" : "IRRELEVANT";
  await db.vacancy.update({
    where: { id: vacancyId },
    data: { relevance, relevanceReason: result.reason },
  });
  return relevance;
}

export type VacancyImproveInput = {
  title: string;
  discipline?: string | null;
  location?: string | null;
  employmentType?: string | null;
  salary?: string | null;
  company?: string | null;
  rawText: string;
};

export type VacancyImproveResult = {
  summary: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  improvedText: string;
  linkedinPost: string;
  location: string;
  employmentType: string;
  salary: string;
};

/**
 * Core AI rewrite: turn a raw vacancy into the structured website sections
 * (Over de functie / Werkzaamheden / Functie-eisen / Pré) + a full text and
 * LinkedIn post. Pure (no DB) so it powers both the saved-vacancy action and
 * the live "Verbeter met AI" button in the form.
 */
export async function aiImproveVacancyFields(
  input: VacancyImproveInput,
): Promise<VacancyImproveResult> {
  const context = [
    `Titel: ${input.title}`,
    input.discipline ? `Discipline: ${input.discipline}` : null,
    input.location ? `Plaats: ${input.location}` : null,
    input.employmentType ? `Dienstverband: ${input.employmentType}` : null,
    input.salary ? `Salaris/vergoeding: ${input.salary}` : null,
    `Opdrachtgever/bedrijf: ${input.company ?? "onbekend"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Hieronder de context en de binnengekomen, ruwe vacaturetekst. Werk deze uit tot een professionele, wervende vacature voor Q4S, opgedeeld in vaste onderdelen voor de website.

CONTEXT:
${context}

BINNENGEKOMEN VACATURETEKST:
${input.rawText}

Lever exact deze velden aan:
- summary — "Over de functie": een vlotte intro-alinea van 2 à 4 zinnen die de kern en aantrekkelijkheid van de functie samenvat.
- responsibilities — "Werkzaamheden": een lijst korte, concrete taken (elk item één korte zin, zonder opsommingsteken).
- requirements — "Functie-eisen": een lijst harde eisen (opleiding, ervaring, certificaten, vaardigheden).
- niceToHave — "Pré": een lijst pluspunten/nice-to-haves; leeg ([]) als er geen zijn.
- improvedText — de volledige herschreven vacaturetekst als platte tekst (voor preview/intern), GEEN markdown.
- linkedinPost — een korte, wervende LinkedIn-post met enkele relevante hashtags.
- location — de standplaats als die uit de tekst blijkt, anders "".
- employmentType — contractvorm (bijv. Fulltime, Freelance/ZZP, Parttime) als die blijkt, anders "".
- salary — vergoeding/salaris als die blijkt, anders "".

Verzin geen feiten die niet in de tekst staan; laat onbekende lijst-items weg en onbekende losse velden leeg ("").`;

  return aiJSON<VacancyImproveResult>({
    system: IMPROVE_SYSTEM,
    prompt,
    schema: IMPROVE_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "vacancy_improvement",
  });
}

/** AI-rewrite a saved vacancy into the structured sections; sets status IMPROVED. */
export async function aiImproveVacancy(vacancyId: string): Promise<void> {
  const vacancy = await db.vacancy.findUnique({
    where: { id: vacancyId },
    include: { client: true },
  });
  if (!vacancy) throw new Error("Vacature niet gevonden.");

  const company = vacancy.client?.companyName ?? vacancy.companyName ?? null;
  const r = await aiImproveVacancyFields({
    title: vacancy.title,
    discipline: vacancy.discipline,
    location: vacancy.location,
    employmentType: vacancy.employmentType,
    salary: vacancy.salary,
    company,
    rawText: vacancy.rawText,
  });

  await db.vacancy.update({
    where: { id: vacancyId },
    data: {
      summary: r.summary,
      responsibilities: r.responsibilities.join("\n"),
      requirements: r.requirements.join("\n"),
      niceToHave: r.niceToHave.join("\n"),
      improvedText: r.improvedText,
      linkedinPost: r.linkedinPost,
      location: vacancy.location ?? (r.location || null),
      employmentType: vacancy.employmentType ?? (r.employmentType || null),
      salary: vacancy.salary ?? (r.salary || null),
      status: "IMPROVED",
    },
  });
}
