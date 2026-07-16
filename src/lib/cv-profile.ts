import { z } from "zod";

/**
 * Het uitgelezen CV-profiel: de gedeelde vorm tussen de AI-extractie, het
 * review-scherm, het CvProfile-record en de twee renderers (PDF + Word).
 *
 * De secties staan in de database als JSON-TEKST (kolommen `*Json`) i.p.v. een
 * Prisma `Json`-type, zodat het schema provider-agnostisch blijft (Postgres én
 * SQLite). Die tekst is ooit door een AI gevuld, dus lees hem NOOIT met een kale
 * JSON.parse: gebruik {@link parseSection}, die kapotte/verouderde JSON opvangt
 * als lege sectie i.p.v. de pagina te laten crashen.
 */

// Tolerante primitieven: de AI levert regelmatig null i.p.v. een lege string, of
// laat een veld helemaal weg. Beide mogen nooit een validatiefout worden.
const text = z
  .string()
  .nullish()
  .transform((v) => (v ?? "").trim());

const textList = z
  .array(z.string().nullish().transform((v) => (v ?? "").trim()))
  .nullish()
  .transform((v) => (v ?? []).filter(Boolean));

export const cvExperienceSchema = z.object({
  employer: text,
  role: text,
  /** Vrije tekst ("mrt 2019 – heden"): CV-periodes zijn te grillig voor een datum. */
  period: text,
  location: text,
  bullets: textList,
});

export const cvEducationSchema = z.object({
  school: text,
  degree: text,
  period: text,
});

export const cvCertificateSchema = z.object({
  name: text,
  issuer: text,
  /** Vrije tekst: "2024", "geldig t/m 2027", "juni 2023". */
  year: text,
});

export const cvLanguageSchema = z.object({
  name: text,
  /** Vrije tekst: "moedertaal", "vloeiend", "B2". */
  level: text,
});

export type CvExperience = z.infer<typeof cvExperienceSchema>;
export type CvEducation = z.infer<typeof cvEducationSchema>;
export type CvCertificate = z.infer<typeof cvCertificateSchema>;
export type CvLanguage = z.infer<typeof cvLanguageSchema>;

/** Alles wat de AI uit een CV haalt — en wat het review-scherm bewerkt. */
export const cvProfileDataSchema = z.object({
  fullName: text,
  headline: text,
  location: text,
  availability: text,
  summary: text,
  yearsExperience: z
    .number()
    .int()
    .nullish()
    .transform((v) => (v == null || v < 0 || v > 70 ? null : v)),
  skills: textList,
  languages: z.array(cvLanguageSchema).nullish().transform((v) => v ?? []),
  experience: z.array(cvExperienceSchema).nullish().transform((v) => v ?? []),
  education: z.array(cvEducationSchema).nullish().transform((v) => v ?? []),
  certificates: z.array(cvCertificateSchema).nullish().transform((v) => v ?? []),
});

export type CvProfileData = z.infer<typeof cvProfileDataSchema>;

/**
 * Lees één sectie-kolom (JSON-tekst) uit de database. Kapotte JSON of een vorm
 * die niet meer bij het schema past → lege lijst. Een CV-profiel mag nooit een
 * kandidaatpagina laten klappen.
 */
export function parseSection<T extends z.ZodTypeAny>(json: string, schema: T): z.infer<T>[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: z.infer<T>[] = [];
  for (const item of raw) {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function serializeSection(value: unknown): string {
  return JSON.stringify(value ?? []);
}

// ---------------------------------------------------------------------------
// JSON-schema voor de AI (aiJSON / aiJSONFromFile).
//
// Bewust GEEN min/max/length-constraints en overal additionalProperties:false —
// zie de eis boven aiJSON() in src/lib/ai.ts. Alles is nullable omdat een CV
// zelden compleet is; liever null dan een verzonnen waarde.
// ---------------------------------------------------------------------------

const nullableString = { type: ["string", "null"] };
const stringArray = { type: "array", items: { type: "string" } };

function objectArray(properties: Record<string, unknown>) {
  return {
    type: "array",
    items: {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    },
  };
}

export const CV_PROFILE_AI_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    fullName: nullableString,
    headline: nullableString,
    location: nullableString,
    availability: nullableString,
    summary: nullableString,
    yearsExperience: { type: ["integer", "null"] },
    skills: stringArray,
    languages: objectArray({ name: nullableString, level: nullableString }),
    experience: objectArray({
      employer: nullableString,
      role: nullableString,
      period: nullableString,
      location: nullableString,
      bullets: stringArray,
    }),
    education: objectArray({
      school: nullableString,
      degree: nullableString,
      period: nullableString,
    }),
    certificates: objectArray({
      name: nullableString,
      issuer: nullableString,
      year: nullableString,
    }),
  },
  required: [
    "fullName",
    "headline",
    "location",
    "availability",
    "summary",
    "yearsExperience",
    "skills",
    "languages",
    "experience",
    "education",
    "certificates",
  ],
  additionalProperties: false,
};

export const CV_EXTRACT_SYSTEM =
  "Je leest CV's van technische vakmensen (QA/QC-inspecteurs, lassers, fitters, NDO/NDT) " +
  "voor een Nederlands detacheringsbureau. Je geeft UITSLUITEND terug wat er echt op het " +
  "CV staat — je verzint niets, je vult niets aan en je maakt niets mooier. Onbekend = null " +
  "(of een lege lijst). Antwoord in dezelfde taal als het CV; is dat Engels, houd dan Engels aan.";

export const CV_EXTRACT_PROMPT =
  "Haal het volledige profiel uit dit CV:\n" +
  "- fullName: volledige naam zoals op het CV.\n" +
  "- headline: korte functietitel (bijv. 'QA/QC Inspector' of '6G TIG-lasser'). Staat die er niet, leid hem af uit de meest recente functie.\n" +
  "- location: woonplaats/regio.\n" +
  "- availability: alleen als het CV iets over beschikbaarheid zegt.\n" +
  "- summary: 2 tot 4 zinnen profielschets. Staat er geen profieltekst, vat dan de werkervaring feitelijk samen.\n" +
  "- yearsExperience: totaal aantal jaren relevante werkervaring als geheel getal; niet af te leiden = null.\n" +
  "- skills: vaktechnische vaardigheden, methodes, materialen, normen en software. Losse trefwoorden, geen zinnen.\n" +
  "- languages: taal + niveau zoals vermeld.\n" +
  "- experience: elke functie, nieuwste eerst, met werkgever, rol, periode (letterlijk overnemen), locatie en bullets met concrete taken/resultaten.\n" +
  "- education: opleidingen met school, diploma/richting en periode.\n" +
  "- certificates: certificaten en kwalificaties (bijv. VCA, ISO 9712 NDT niveau 2, lasmethode-certificaten) met uitgever en jaartal/geldigheid.";
