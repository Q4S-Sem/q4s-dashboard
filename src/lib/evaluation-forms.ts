// Template-driven evaluations. Each form type is described here once; the form,
// the detail view, the list and the PDF all render from these definitions, and
// scores/answers are stored as JSON keyed by these `key`s.

export type HeaderKey =
  | "clientName"
  | "clientAddress"
  | "department"
  | "reference"
  | "functionTitle"
  | "workLocation"
  | "periodText";

export type EvalHeaderField = { key: HeaderKey; label: string };
export type EvalCriterion = { key: string; label: string };
export type EvalScoreSection = { title: string; criteria: EvalCriterion[]; noteKey: string };
export type EvalBoolQuestion = { key: string; label: string };
export type EvalTextField = { key: string; label: string };

export type EvalFormDef = {
  type: string;
  /** Short label for selectors/badges. */
  shortLabel: string;
  /** Document title + subtitle on the form/PDF. */
  title: string;
  subtitle: string;
  /** Who signs/fills it in. */
  evaluatorLabel: string;
  /** De lijstpagina van dit type — waar je na opslaan weer uitkomt. */
  listPath: string;
  headerFields: EvalHeaderField[];
  scoreSections: EvalScoreSection[];
  /** Closing block (e.g. "Werkzaamheden") with free-text + yes/no questions. */
  closingTitle?: string;
  textFields: EvalTextField[];
  boolQuestions: EvalBoolQuestion[];
  closingNoteKey: string;
};

const VCU: EvalFormDef = {
  type: "VCU",
  shortLabel: "VG-evaluatie (inlener → uitzendkracht)",
  title: "VG-evaluatieformulier (VCU)",
  subtitle: "Evaluatie door inleenbedrijf over uitzendkracht",
  evaluatorLabel: "Naam inlener",
  listPath: "/evaluaties/vcu",
  headerFields: [
    { key: "clientName", label: "Naam inlenend bedrijf" },
    { key: "clientAddress", label: "Adres" },
    { key: "department", label: "Afdeling waar naar uitgezonden" },
    { key: "reference", label: "Aanvraagnummer of referentie" },
    { key: "functionTitle", label: "Functie" },
    { key: "workLocation", label: "Werklocatie" },
    { key: "periodText", label: "Duur van uitzendperiode" },
  ],
  scoreSections: [
    {
      title: "Beoordeling",
      noteKey: "note_beoordeling",
      criteria: [
        { key: "vakmanschap", label: "Vakmanschap / kennis van zaken" },
        { key: "inzet", label: "Inzet" },
        { key: "veiligheid", label: "Veiligheid / gebruik PBM's" },
        { key: "omgang", label: "Omgang met collega's en leidinggevende" },
        { key: "rapportage", label: "Kennis van computers / rapportage" },
      ],
    },
  ],
  textFields: [],
  boolQuestions: [{ key: "weer_inlenen", label: "Zou u deze uitzendkracht weer inlenen?" }],
  closingNoteKey: "note_afronding",
};

const UITZENDKRACHT: EvalFormDef = {
  type: "UITZENDKRACHT",
  shortLabel: "Evaluatie inlener (uitzendkracht → inlener)",
  title: "Evaluatie inlener door uitzendkracht",
  subtitle: "Evaluatie door uitzendkracht over uitzending",
  evaluatorLabel: "Naam uitzendkracht",
  listPath: "/evaluaties/inlener",
  headerFields: [
    { key: "clientName", label: "Naam inlenend bedrijf" },
    { key: "department", label: "Afdeling waar naar uitgezonden" },
    { key: "reference", label: "Aanvraagnummer of referentie" },
    { key: "functionTitle", label: "Functie" },
    { key: "workLocation", label: "Werklocatie" },
    { key: "periodText", label: "Duur van de uitzendperiode" },
  ],
  scoreSections: [
    {
      title: "Informatie en instructie",
      noteKey: "note_info",
      criteria: [
        { key: "info_uitzendbureau", label: "Informatie door uitzendbureau over uitzending" },
        { key: "info_introductie", label: "Introductie bij aanvang uitzendperiode" },
        { key: "info_detailinstructie", label: "Detailinstructies m.b.t. veilig werken" },
        { key: "info_communicatie", label: "Communicatie met contactpersoon" },
        { key: "info_bijeenkomsten", label: "Deelname aan veiligheidsbijeenkomsten" },
        { key: "info_risicos", label: "Op de hoogte zijn van functie- en bedrijfsrisico's" },
      ],
    },
    {
      title: "Persoonlijke beschermingsmiddelen",
      noteKey: "note_pbm",
      criteria: [
        { key: "pbm_noodzaak", label: "Op de hoogte zijn van de noodzakelijke PBM" },
        { key: "pbm_verstrekking", label: "Verstrekking van PBM" },
        { key: "pbm_instructie", label: "Instructie over wanneer en hoe toe te passen" },
        { key: "pbm_toezicht", label: "Toezicht op juist gebruik" },
        { key: "pbm_ruilen", label: "Mogelijkheid om te ruilen" },
        { key: "pbm_onderhoud", label: "PBM kunnen onderhouden en veilig bewaren" },
        { key: "pbm_kwaliteit", label: "Kwaliteit van de PBM" },
      ],
    },
    {
      title: "Werkomstandigheden",
      noteKey: "note_werkomstandigheden",
      criteria: [
        { key: "wo_veiligheid", label: "Aandacht voor veiligheid op de werkvloer" },
        { key: "wo_orde", label: "Orde & netheid" },
        { key: "wo_voorzieningen", label: "Voorzieningen zoals sanitair, kantine, kleedruimte" },
        { key: "wo_werktijden", label: "Werktijden & rustpauzes" },
        { key: "wo_werktempo", label: "Werktempo" },
        { key: "wo_toezicht", label: "Toezicht op naleving van veiligheidsregels" },
        { key: "wo_omgang", label: "Omgang met collega's en leidinggevenden" },
      ],
    },
  ],
  closingTitle: "Werkzaamheden",
  textFields: [
    { key: "werkzaamheden", label: "Welke werkzaamheden zijn of worden verricht" },
  ],
  boolQuestions: [
    { key: "werk_overeenkomst", label: "Komen de werkzaamheden overeen met de aanvraag?" },
    { key: "graag_werken", label: "Werk je graag bij dit bedrijf?" },
    { key: "opnieuw_uitzenden", label: "Wil je opnieuw worden uitgezonden naar dit bedrijf?" },
  ],
  closingNoteKey: "note_werkzaamheden",
};

export const EVAL_FORMS: Record<string, EvalFormDef> = { VCU, UITZENDKRACHT };

/** The available form types (for selectors), in display order. */
export const EVAL_FORM_LIST: EvalFormDef[] = [VCU, UITZENDKRACHT];

export function getFormDef(type: string): EvalFormDef {
  return EVAL_FORMS[type] ?? VCU;
}

/** All score-criterion keys of a form (across its sections). */
export function criterionKeys(def: EvalFormDef): string[] {
  return def.scoreSections.flatMap((s) => s.criteria.map((c) => c.key));
}

/** Safe parse of a stored JSON map (scores/answers), tolerant of nulls. */
export function parseJsonMap(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Average of the filled-in scores (1..4) in a scores map, or null. */
export function averageOfScores(scores: Record<string, unknown>): number | null {
  const vals = Object.values(scores)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 4);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
