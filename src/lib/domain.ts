// Central definitions of the allowed values for string-typed fields
// (SQLite has no enums). Each has a machine value, a Dutch label, and a
// color token for badges. Validated in server actions with Zod.

export type Option = { value: string; label: string; color?: BadgeColor };
export type BadgeColor =
  | "slate"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "violet"
  | "cyan"
  | "orange";

/** The sectors Q4S specialises in. */
export const DISCIPLINES: Option[] = [
  { value: "QA", label: "QA — Quality Assurance", color: "blue" },
  { value: "QC", label: "QC — Quality Control", color: "cyan" },
  { value: "LASSEN", label: "Lassen / Welding", color: "amber" },
  { value: "FITTER", label: "Fitter", color: "violet" },
  { value: "NDO", label: "NDO / NDT", color: "green" },
  { value: "OVERIG", label: "Overig", color: "slate" },
];

export const EMPLOYMENT_TYPES: Option[] = [
  { value: "ZZP", label: "ZZP / Freelance", color: "violet" },
  { value: "LOONDIENST", label: "Loondienst", color: "blue" },
  { value: "UITZEND", label: "Uitzend", color: "cyan" },
];

export const PLACEMENT_STATUSES: Option[] = [
  { value: "ACTIVE", label: "Actief", color: "green" },
  { value: "ENDED", label: "Beëindigd", color: "slate" },
];

export const TIMESHEET_STATUSES: Option[] = [
  { value: "DRAFT", label: "Concept", color: "slate" },
  { value: "SUBMITTED", label: "Ingediend", color: "amber" },
  { value: "APPROVED", label: "Goedgekeurd", color: "blue" },
  { value: "INVOICED", label: "Gefactureerd", color: "green" },
];

export const INVOICE_STATUSES: Option[] = [
  { value: "DRAFT", label: "Concept", color: "slate" },
  { value: "SENT", label: "Verzonden", color: "blue" },
  { value: "PAID", label: "Betaald", color: "green" },
  { value: "OVERDUE", label: "Te laat", color: "red" },
  { value: "CANCELLED", label: "Geannuleerd", color: "slate" },
];

/** Hex-waarden per badge-kleur — voor charts (Recharts/pie) die echte kleuren
 *  nodig hebben i.p.v. Tailwind-klassen. Afgestemd op de badge-tinten. */
export const BADGE_HEX: Record<BadgeColor, string> = {
  slate: "#64748b",
  blue: "#2563eb",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  violet: "#7c3aed",
  cyan: "#0891b2",
  orange: "#ea580c",
};

/** Categorisch kleurenpalet voor charts zonder vaste domein-kleur (bijv. top-
 *  klanten): visueel onderscheidende tinten, cyclisch toegekend. */
export const CHART_PALETTE = [
  "#2563eb", "#7c3aed", "#16a34a", "#d97706", "#0891b2",
  "#e11d48", "#4f46e5", "#ea580c", "#0d9488", "#c026d3",
];

/** Hex voor een waarde binnen een option-set (valt terug op grijs). */
export function hexFor(options: Option[], value: string | null | undefined): string {
  return BADGE_HEX[colorFor(options, value)];
}

/** Vrije-tekst discipline → canonieke waarde. Matcht op de vaste discipline-
 *  waarde OF -label (hoofdletterongevoelig); een eigen (onbekende) discipline
 *  wordt als getypte tekst bewaard. Zo blijven de vaste disciplines gekoppeld aan
 *  hun kleur/label en kun je toch altijd zelf een nieuwe toevoegen. */
export function disciplineValueOf(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const low = t.toLowerCase();
  const hit = DISCIPLINES.find((d) => d.value.toLowerCase() === low || d.label.toLowerCase() === low);
  return hit ? hit.value : t;
}

/** Look up the Dutch label for a value within an option set. */
export function labelFor(options: Option[], value: string | null | undefined): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

/** Look up the badge color for a value within an option set. */
export function colorFor(options: Option[], value: string | null | undefined): BadgeColor {
  if (!value) return "slate";
  return options.find((o) => o.value === value)?.color ?? "slate";
}

export const DISCIPLINE_VALUES = DISCIPLINES.map((d) => d.value) as [string, ...string[]];
export const EMPLOYMENT_VALUES = EMPLOYMENT_TYPES.map((d) => d.value) as [string, ...string[]];
export const PLACEMENT_STATUS_VALUES = PLACEMENT_STATUSES.map((d) => d.value) as [string, ...string[]];
export const TIMESHEET_STATUS_VALUES = TIMESHEET_STATUSES.map((d) => d.value) as [string, ...string[]];
export const INVOICE_STATUS_VALUES = INVOICE_STATUSES.map((d) => d.value) as [string, ...string[]];

// --- Klanten (contactpersonen bij een bedrijf) ---

/** De rollen die je bij een klant tegenkomt. Eén contactpersoon per rol, elk met
 *  een eigen e-mail — zo mail je HR voor papieren en de planner voor uren.
 *  Vrije tekst uit oudere records blijft werken (labelFor valt terug op de waarde). */
export const CLIENT_CONTACT_ROLES: Option[] = [
  { value: "HR", label: "HR / Personeelszaken", color: "violet" },
  { value: "MANAGER", label: "Manager", color: "blue" },
  { value: "PLANNER", label: "Planner / Werkvoorbereiding", color: "cyan" },
  { value: "INKOOP", label: "Inkoop", color: "amber" },
  { value: "FACTURATIE", label: "Facturatie / Administratie", color: "green" },
  { value: "QHSE", label: "QA / QC / QHSE", color: "cyan" },
  { value: "UITVOERING", label: "Uitvoering / Projectleider", color: "orange" },
  { value: "DIRECTIE", label: "Directie", color: "red" },
  { value: "RECRUITMENT", label: "Recruitment / Inhuur", color: "violet" },
  { value: "OVERIG", label: "Overig", color: "slate" },
];
export const CLIENT_CONTACT_ROLE_VALUES = CLIENT_CONTACT_ROLES.map((d) => d.value) as [string, ...string[]];

// --- Recruitment hub ---

export const VACANCY_STATUSES: Option[] = [
  { value: "CONCEPT", label: "Concept", color: "slate" },
  { value: "IMPROVED", label: "AI-verbeterd", color: "blue" },
  { value: "PUBLISHED", label: "Gepubliceerd", color: "green" },
  { value: "PAUSED", label: "Gepauzeerd", color: "amber" },
];

export const OUTREACH_CHANNELS: Option[] = [
  { value: "LINKEDIN", label: "LinkedIn", color: "blue" },
  { value: "EMAIL", label: "E-mail", color: "violet" },
];

export const OUTREACH_STATUSES: Option[] = [
  { value: "DRAFT", label: "Concept", color: "slate" },
  { value: "APPROVED", label: "Goedgekeurd", color: "amber" },
  { value: "SENT", label: "Verzonden", color: "green" },
];

// --- Socials hub ---

export const SOCIAL_PLATFORMS: Option[] = [
  { value: "LINKEDIN", label: "LinkedIn", color: "blue" },
  { value: "INSTAGRAM", label: "Instagram", color: "violet" },
  { value: "FACEBOOK", label: "Facebook", color: "cyan" },
  { value: "X", label: "X / Twitter", color: "slate" },
];

export const SOCIAL_POST_STATUSES: Option[] = [
  { value: "DRAFT", label: "Concept", color: "slate" },
  { value: "SCHEDULED", label: "Ingepland", color: "amber" },
  { value: "PUBLISHED", label: "Gepubliceerd", color: "green" },
];

export const SOCIAL_PLATFORM_VALUES = SOCIAL_PLATFORMS.map((d) => d.value) as [string, ...string[]];
export const SOCIAL_POST_STATUS_VALUES = SOCIAL_POST_STATUSES.map((d) => d.value) as [string, ...string[]];

/** Recruitment channels a tracked link can target (broader than post platforms:
 *  includes WhatsApp/TikTok). Used by PostLink.channel + the talentpool analytics. */
export const RECRUITMENT_CHANNELS: Option[] = [
  { value: "LINKEDIN", label: "LinkedIn", color: "blue" },
  { value: "FACEBOOK", label: "Facebook", color: "cyan" },
  { value: "INSTAGRAM", label: "Instagram", color: "violet" },
  { value: "WHATSAPP", label: "WhatsApp", color: "green" },
  { value: "TIKTOK", label: "TikTok", color: "slate" },
  { value: "X", label: "X / Twitter", color: "slate" },
  { value: "OVERIG", label: "Overig", color: "slate" },
];

export const RECRUITMENT_CHANNEL_VALUES = RECRUITMENT_CHANNELS.map((d) => d.value) as [string, ...string[]];

/** The channels a one-click "links voor alle kanalen" run creates. */
export const DEFAULT_CHANNEL_KEYS = ["LINKEDIN", "FACEBOOK", "INSTAGRAM", "WHATSAPP", "TIKTOK"];

/** Vakproef (skills-challenge) lifecycle. */
export const CHALLENGE_STATUSES: Option[] = [
  { value: "DRAFT", label: "Concept", color: "slate" },
  { value: "ACTIVE", label: "Actief", color: "green" },
  { value: "CLOSED", label: "Gesloten", color: "slate" },
];
export const CHALLENGE_STATUS_VALUES = CHALLENGE_STATUSES.map((d) => d.value) as [string, ...string[]];

// --- Analyses hub ---

export const OPPORTUNITY_STATUSES: Option[] = [
  { value: "NEW", label: "Nieuw", color: "blue" },
  { value: "EXPLORING", label: "Verkennen", color: "amber" },
  { value: "PURSUING", label: "Actief oppakken", color: "violet" },
  { value: "WON", label: "Gewonnen", color: "green" },
  { value: "LOST", label: "Niet doorgegaan", color: "slate" },
];

export const OPPORTUNITY_POTENTIAL: Option[] = [
  { value: "LAAG", label: "Laag", color: "slate" },
  { value: "MIDDEL", label: "Middel", color: "amber" },
  { value: "HOOG", label: "Hoog", color: "green" },
];

export const VACANCY_STATUS_VALUES = VACANCY_STATUSES.map((d) => d.value) as [string, ...string[]];
export const OUTREACH_CHANNEL_VALUES = OUTREACH_CHANNELS.map((d) => d.value) as [string, ...string[]];
export const OUTREACH_STATUS_VALUES = OUTREACH_STATUSES.map((d) => d.value) as [string, ...string[]];
export const OPPORTUNITY_STATUS_VALUES = OPPORTUNITY_STATUSES.map((d) => d.value) as [string, ...string[]];
export const OPPORTUNITY_POTENTIAL_VALUES = OPPORTUNITY_POTENTIAL.map((d) => d.value) as [string, ...string[]];

// --- Personnel file (werknemers-hub) ---

export const DOCUMENT_CATEGORIES: Option[] = [
  { value: "CONTRACT", label: "Contract", color: "blue" },
  { value: "ID", label: "Identiteitsbewijs", color: "violet" },
  { value: "CERTIFICAAT", label: "Certificaat", color: "green" },
  { value: "CV", label: "CV", color: "cyan" },
  { value: "EVALUATIE", label: "Evaluatie", color: "amber" },
  { value: "OVERIG", label: "Overig", color: "slate" },
];

export const DOCUMENT_CATEGORY_VALUES = DOCUMENT_CATEGORIES.map((d) => d.value) as [string, ...string[]];

/** Common Dutch contract types for a select. */
export const CONTRACT_TYPES = [
  "Onbepaalde tijd",
  "Bepaalde tijd",
  "Overeenkomst van opdracht (ZZP)",
  "Uitzendovereenkomst",
  "Detacheringsovereenkomst",
];

// --- Invoice intake (timesheets in via admin@q4s.nl) ---

export const INBOX_SOURCES: Option[] = [
  { value: "UPLOAD", label: "Upload", color: "slate" },
  { value: "EMAIL", label: "E-mail", color: "blue" },
];

export const INBOX_STATUSES: Option[] = [
  { value: "NEW", label: "Nieuw", color: "slate" },
  { value: "EXTRACTED", label: "Uitgelezen", color: "blue" },
  { value: "CONFIRMED", label: "Bevestigd", color: "green" },
  { value: "REJECTED", label: "Afgewezen", color: "red" },
];

export const INBOX_SOURCE_VALUES = INBOX_SOURCES.map((d) => d.value) as [string, ...string[]];
export const INBOX_STATUS_VALUES = INBOX_STATUSES.map((d) => d.value) as [string, ...string[]];

// --- Purchase (self-billing) invoices: what Q4S pays the consultant ---

export const PURCHASE_INVOICE_STATUSES: Option[] = [
  { value: "DRAFT", label: "Concept", color: "slate" },
  { value: "APPROVED", label: "Te betalen", color: "amber" },
  { value: "PAID", label: "Betaald", color: "green" },
  { value: "CANCELLED", label: "Geannuleerd", color: "slate" },
];

export const PURCHASE_INVOICE_STATUS_VALUES = PURCHASE_INVOICE_STATUSES.map((d) => d.value) as [string, ...string[]];

/** Inkomende facturen die geplaatste ZZP'ers zelf naar Q4S sturen. */
export const RECEIVED_INVOICE_STATUSES: Option[] = [
  { value: "NEW", label: "Ontvangen", color: "blue" },
  { value: "APPROVED", label: "Gecontroleerd", color: "amber" },
  { value: "PAID", label: "Betaald", color: "green" },
  { value: "DISPUTED", label: "Afwijking", color: "red" },
];

export const RECEIVED_INVOICE_STATUS_VALUES = RECEIVED_INVOICE_STATUSES.map((d) => d.value) as [string, ...string[]];

// --- AI Recruitment hub ---

export const VMS_STATUSES: Option[] = [
  { value: "NOT_CONNECTED", label: "Niet gekoppeld", color: "slate" },
  { value: "MANUAL", label: "Handmatig / import", color: "amber" },
  { value: "CONNECTED", label: "Gekoppeld (API)", color: "green" },
];

export const TARGET_STATUSES: Option[] = [
  { value: "PROSPECT", label: "Prospect", color: "slate" },
  { value: "CONTACT", label: "In contact", color: "blue" },
  { value: "ACTIVE", label: "Actief", color: "green" },
  { value: "WON", label: "Gewonnen", color: "violet" },
  { value: "LOST", label: "Niet doorgegaan", color: "red" },
];

export const VACANCY_SOURCES: Option[] = [
  { value: "MANUAL", label: "Handmatig", color: "slate" },
  { value: "VMS", label: "VMS", color: "blue" },
  { value: "CSV", label: "CSV-import", color: "cyan" },
  { value: "EMAIL", label: "E-mail", color: "violet" },
];

export const VACANCY_RELEVANCE: Option[] = [
  { value: "RELEVANT", label: "Relevant", color: "green" },
  { value: "IRRELEVANT", label: "Niet relevant", color: "red" },
  { value: "UNKNOWN", label: "Onbeoordeeld", color: "slate" },
];

export const CANDIDATE_SOURCES: Option[] = [
  { value: "WEBSITE", label: "Website", color: "green" },
  { value: "EMAIL", label: "E-mail (cv@q4s.nl)", color: "amber" },
  { value: "TALENTPOOL", label: "Talentpool", color: "violet" },
  { value: "IMPORT", label: "Import", color: "cyan" },
  { value: "MANUAL", label: "Handmatig", color: "slate" },
];

export const APPLICATION_STATUSES: Option[] = [
  { value: "NEW", label: "Nieuw", color: "blue" },
  { value: "SCREENING", label: "Screening", color: "amber" },
  { value: "PROPOSED", label: "Voorgesteld", color: "violet" },
  { value: "PLACED", label: "Geplaatst", color: "green" },
  { value: "REJECTED", label: "Afgewezen", color: "slate" },
];

export const VMS_STATUS_VALUES = VMS_STATUSES.map((d) => d.value) as [string, ...string[]];
export const TARGET_STATUS_VALUES = TARGET_STATUSES.map((d) => d.value) as [string, ...string[]];
export const APPLICATION_STATUS_VALUES = APPLICATION_STATUSES.map((d) => d.value) as [string, ...string[]];

// --- Agenda hub ---

export const EVENT_TYPES: Option[] = [
  { value: "MEETING", label: "Afspraak", color: "blue" },
  { value: "CALL", label: "Telefoongesprek", color: "cyan" },
  { value: "VISIT", label: "Bedrijfsbezoek", color: "violet" },
  { value: "INTERVIEW", label: "Sollicitatiegesprek", color: "amber" },
  { value: "DEADLINE", label: "Deadline", color: "red" },
  { value: "REMINDER", label: "Herinnering", color: "slate" },
  { value: "OTHER", label: "Overig", color: "slate" },
];

export const EVENT_STATUSES: Option[] = [
  { value: "PLANNED", label: "Gepland", color: "blue" },
  { value: "DONE", label: "Afgerond", color: "green" },
  { value: "CANCELLED", label: "Geannuleerd", color: "slate" },
];

export const EVENT_SOURCES: Option[] = [
  { value: "MANUAL", label: "Handmatig", color: "slate" },
  { value: "EMAIL", label: "E-mail (.ics)", color: "blue" },
  { value: "ICS", label: "Agenda-import", color: "cyan" },
];

export const TASK_PRIORITIES: Option[] = [
  { value: "LOW", label: "Laag", color: "green" },
  { value: "MEDIUM", label: "Normaal", color: "amber" },
  { value: "HIGH", label: "Hoog", color: "red" },
];

export const EVENT_TYPE_VALUES = EVENT_TYPES.map((d) => d.value) as [string, ...string[]];
export const EVENT_STATUS_VALUES = EVENT_STATUSES.map((d) => d.value) as [string, ...string[]];
export const EVENT_SOURCE_VALUES = EVENT_SOURCES.map((d) => d.value) as [string, ...string[]];
export const TASK_PRIORITY_VALUES = TASK_PRIORITIES.map((d) => d.value) as [string, ...string[]];

// --- Evaluaties hub ---

/** Evaluation form types — VCU is the VG-evaluatieformulier; the rest are
 *  placeholders so other templates can be added later. */
export const EVALUATION_TYPES: Option[] = [
  { value: "VCU", label: "VG-evaluatie (inlener → uitzendkracht)", color: "green" },
  { value: "UITZENDKRACHT", label: "Evaluatie inlener (uitzendkracht → inlener)", color: "blue" },
];

export const EVALUATION_STATUSES: Option[] = [
  { value: "CONCEPT", label: "Concept", color: "amber" },
  { value: "DEFINITIEF", label: "Definitief", color: "green" },
];

/** The VCU rating scale (Slecht/Matig/Normaal/Goed) as 1..4. */
export const EVAL_SCORES: Option[] = [
  { value: "1", label: "Slecht", color: "red" },
  { value: "2", label: "Matig", color: "amber" },
  { value: "3", label: "Normaal", color: "blue" },
  { value: "4", label: "Goed", color: "green" },
];

/** Kwartalen, for Q1-Q4 filtering/sorting of evaluations. */
export const QUARTERS: Option[] = [
  { value: "1", label: "Q1 (jan–mrt)", color: "slate" },
  { value: "2", label: "Q2 (apr–jun)", color: "slate" },
  { value: "3", label: "Q3 (jul–sep)", color: "slate" },
  { value: "4", label: "Q4 (okt–dec)", color: "slate" },
];

/** The five VCU rating criteria, mapped to their Evaluation score fields. */
export const VCU_CRITERIA = [
  { key: "scoreCraft", label: "Vakmanschap / kennis van zaken" },
  { key: "scoreEffort", label: "Inzet" },
  { key: "scoreSafety", label: "Veiligheid / gebruik PBM's" },
  { key: "scoreCollaboration", label: "Omgang met collega's en leidinggevende" },
  { key: "scoreReporting", label: "Kennis van computers / rapportage" },
] as const;

export const EVALUATION_TYPE_VALUES = EVALUATION_TYPES.map((d) => d.value) as [string, ...string[]];
export const EVALUATION_STATUS_VALUES = EVALUATION_STATUSES.map((d) => d.value) as [string, ...string[]];

// --- Kandidaat-rangschikking (talentpool) — rood → groen ---
export const CANDIDATE_RATINGS: Option[] = [
  { value: "GOED", label: "Goed", color: "green" },
  { value: "REDELIJK", label: "Redelijk", color: "amber" },
  { value: "NIET_MEER", label: "Niet meer inzetbaar", color: "red" },
  { value: "ONBEKEND", label: "Niet beoordeeld", color: "slate" },
];
export const CANDIDATE_RATING_VALUES = CANDIDATE_RATINGS.map((d) => d.value) as [string, ...string[]];
/** Sort priority for the talentpool: best first, "niet meer" last. */
export const CANDIDATE_RATING_ORDER: Record<string, number> = {
  GOED: 0,
  REDELIJK: 1,
  ONBEKEND: 2,
  NIET_MEER: 3,
};

// --- Kandidaat-beschikbaarheid (talentpool) ---
export const CANDIDATE_AVAILABILITY: Option[] = [
  { value: "BESCHIKBAAR", label: "Beschikbaar", color: "green" },
  { value: "BINNENKORT", label: "Binnenkort beschikbaar", color: "amber" },
  { value: "NIET_BESCHIKBAAR", label: "Niet beschikbaar", color: "red" },
  { value: "ONBEKEND", label: "Onbekend", color: "slate" },
];
export const CANDIDATE_AVAILABILITY_VALUES = CANDIDATE_AVAILABILITY.map((d) => d.value) as [string, ...string[]];
/** The statuses that count as "inzetbaar" for the beschikbaar-map (nu of binnenkort). */
export const CANDIDATE_AVAILABLE_VALUES = ["BESCHIKBAAR", "BINNENKORT"] as const;

// --- Kandidaat-interview (met Q4S) ---
export const CANDIDATE_INTERVIEW_STATUSES: Option[] = [
  { value: "NONE", label: "Nog niet", color: "slate" },
  { value: "PLANNED", label: "Ingepland", color: "amber" },
  { value: "DONE", label: "Op interview geweest", color: "green" },
];
export const CANDIDATE_INTERVIEW_STATUS_VALUES = CANDIDATE_INTERVIEW_STATUSES.map((d) => d.value) as [string, ...string[]];
/** Sort priority for the beschikbaar-map: nu beschikbaar eerst, dan binnenkort. */
export const CANDIDATE_AVAILABILITY_ORDER: Record<string, number> = {
  BESCHIKBAAR: 0,
  BINNENKORT: 1,
  ONBEKEND: 2,
  NIET_BESCHIKBAAR: 3,
};

// --- App-gebruikers (toegang / inloggegevens) ---
export const APP_USER_ROLES: Option[] = [
  { value: "ADMIN", label: "Beheerder", color: "violet" },
  { value: "GEBRUIKER", label: "Gebruiker", color: "slate" },
];
export const APP_USER_ROLE_VALUES = APP_USER_ROLES.map((d) => d.value) as [string, ...string[]];

// --- Declaraties (bonnetjes / expenses) ---
export const EXPENSE_CATEGORIES: Option[] = [
  { value: "REIS", label: "Reiskosten", color: "blue" },
  { value: "MATERIAAL", label: "Materiaal / gereedschap", color: "violet" },
  { value: "VERBLIJF", label: "Verblijf / overnachting", color: "cyan" },
  { value: "ETEN", label: "Eten & drinken", color: "amber" },
  { value: "PARKEREN", label: "Parkeren", color: "slate" },
  { value: "TOL", label: "Tol / tunnel", color: "orange" },
  { value: "OVERIG", label: "Overig", color: "slate" },
];
export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map((d) => d.value) as [string, ...string[]];

export const EXPENSE_STATUSES: Option[] = [
  { value: "NEW", label: "Te beoordelen", color: "amber" },
  { value: "APPROVED", label: "Goedgekeurd", color: "green" },
  { value: "REJECTED", label: "Afgekeurd", color: "red" },
  { value: "PAID", label: "Uitbetaald", color: "blue" },
];
export const EXPENSE_STATUS_VALUES = EXPENSE_STATUSES.map((d) => d.value) as [string, ...string[]];

// --- Medewerkers (Q4S-personeel / HR) ---
export const EMPLOYEE_DEPARTMENTS: Option[] = [
  { value: "MANAGEMENT", label: "Management", color: "violet" },
  { value: "RECRUITMENT", label: "Recruitment", color: "blue" },
  { value: "SALES", label: "Sales / Accountmanagement", color: "cyan" },
  { value: "BACKOFFICE", label: "Backoffice / Administratie", color: "amber" },
  { value: "HR", label: "HR", color: "green" },
  { value: "OVERIG", label: "Overig", color: "slate" },
];
export const EMPLOYEE_DEPARTMENT_VALUES = EMPLOYEE_DEPARTMENTS.map((d) => d.value) as [string, ...string[]];

/** Dienstverband van een Q4S-medewerker (eigen personeel). */
export const EMPLOYEE_EMPLOYMENT_TYPES: Option[] = [
  { value: "LOONDIENST", label: "Loondienst", color: "blue" },
  { value: "UITZEND", label: "Uitzend", color: "cyan" },
  { value: "ZZP", label: "ZZP / Freelance", color: "violet" },
  { value: "STAGE", label: "Stage / Werkervaring", color: "amber" },
];
export const EMPLOYEE_EMPLOYMENT_VALUES = EMPLOYEE_EMPLOYMENT_TYPES.map((d) => d.value) as [string, ...string[]];

export const LEAVE_TYPES: Option[] = [
  { value: "VAKANTIE", label: "Vakantie", color: "green" },
  { value: "ZIEK", label: "Ziek", color: "red" },
  { value: "BIJZONDER", label: "Bijzonder verlof", color: "violet" },
  { value: "ONBETAALD", label: "Onbetaald verlof", color: "slate" },
];
export const LEAVE_TYPE_VALUES = LEAVE_TYPES.map((d) => d.value) as [string, ...string[]];

export const BONUS_TYPES: Option[] = [
  { value: "PRESTATIE", label: "Prestatiebonus", color: "green" },
  { value: "EINDEJAAR", label: "Eindejaarsbonus", color: "violet" },
  { value: "PROVISIE", label: "Provisie", color: "blue" },
  { value: "OVERIG", label: "Overig", color: "slate" },
];
export const BONUS_TYPE_VALUES = BONUS_TYPES.map((d) => d.value) as [string, ...string[]];

export const EMPLOYEE_DOC_CATEGORIES: Option[] = [
  { value: "CONTRACT", label: "Contract", color: "blue" },
  { value: "LOONSTROOK", label: "Loonstrook", color: "green" },
  { value: "ID", label: "Identiteitsbewijs", color: "violet" },
  { value: "DIPLOMA", label: "Diploma / certificaat", color: "cyan" },
  { value: "OVERIG", label: "Overig", color: "slate" },
];
export const EMPLOYEE_DOC_CATEGORY_VALUES = EMPLOYEE_DOC_CATEGORIES.map((d) => d.value) as [string, ...string[]];

/** Maandnamen (1-indexed gebruikt: MAANDEN[month-1]). */
export const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

// --- Timesheet-status (wie heeft zijn urenstaat ingeleverd) ---

/** Presentie van de weekstaat per medewerker op de timesheet-statuspagina. */
export const TIMESHEET_PRESENCE: Option[] = [
  { value: "RECEIVED", label: "Ontvangen", color: "green" },
  { value: "IN_INBOX", label: "In inbox (te bevestigen)", color: "blue" },
  { value: "REMINDED", label: "Herinnerd", color: "amber" },
  { value: "MISSING", label: "Ontbreekt", color: "red" },
];
export const TIMESHEET_PRESENCE_VALUES = TIMESHEET_PRESENCE.map((d) => d.value) as [string, ...string[]];

// --- MSP-intake (vacature-pijplijn + meldingen) ---

/** Soorten meldingen uit de MSP/vacature-intake-pijplijn. */
export const ALERT_TYPES: Option[] = [
  { value: "VACANCY_RELEVANT", label: "Relevante vacature", color: "green" },
  { value: "MATCHES_FOUND", label: "Kandidaat-matches", color: "violet" },
  { value: "PUBLISHED", label: "Live op website", color: "blue" },
  { value: "POST_READY", label: "LinkedIn-post klaar", color: "cyan" },
  { value: "VACANCY_IRRELEVANT", label: "Niet relevant", color: "slate" },
  { value: "SYNC", label: "Levering", color: "amber" },
  { value: "ERROR", label: "Fout", color: "red" },
];
export const ALERT_TYPE_VALUES = ALERT_TYPES.map((d) => d.value) as [string, ...string[]];

// --- CRM (recruitment sales + relaties) ---

/** A deal's overall lifecycle. Mirrors the stage's won/lost semantics but is
 *  stored on the Deal for fast filtering. */
export const DEAL_STATUSES: Option[] = [
  { value: "OPEN", label: "Open", color: "blue" },
  { value: "WON", label: "Gewonnen", color: "green" },
  { value: "LOST", label: "Verloren", color: "red" },
];
export const DEAL_STATUS_VALUES = DEAL_STATUSES.map((d) => d.value) as [string, ...string[]];

/** Where a deal came from. */
export const DEAL_SOURCES: Option[] = [
  { value: "MANUAL", label: "Handmatig", color: "slate" },
  { value: "VMS", label: "VMS / inhuurdesk", color: "blue" },
  { value: "WEBSITE", label: "Website", color: "green" },
  { value: "REFERRAL", label: "Referral / netwerk", color: "violet" },
  { value: "OUTREACH", label: "Outreach", color: "amber" },
  { value: "EVENT", label: "Beurs / event", color: "cyan" },
];
export const DEAL_SOURCE_VALUES = DEAL_SOURCES.map((d) => d.value) as [string, ...string[]];

/** The kinds of entries in the CRM notitieblok (activity log / chat). */
export const CRM_NOTE_TYPES: Option[] = [
  { value: "NOTE", label: "Notitie", color: "slate" },
  { value: "CALL", label: "Telefoon", color: "blue" },
  { value: "EMAIL", label: "E-mail", color: "violet" },
  { value: "MEETING", label: "Afspraak", color: "amber" },
  { value: "LINKEDIN", label: "LinkedIn", color: "cyan" },
  { value: "WHATSAPP", label: "WhatsApp", color: "green" },
  { value: "TASK", label: "Taak", color: "amber" },
  { value: "STAGE_CHANGE", label: "Fasewissel", color: "blue" },
  { value: "SYSTEM", label: "Systeem", color: "slate" },
];
export const CRM_NOTE_TYPE_VALUES = CRM_NOTE_TYPES.map((d) => d.value) as [string, ...string[]];
/** The subset a recruiter can pick when logging manually (system/stage are auto). */
export const CRM_NOTE_MANUAL_TYPES = CRM_NOTE_TYPES.filter(
  (t) => !["STAGE_CHANGE", "SYSTEM"].includes(t.value),
);

/** Relatiegevoel op een notitie — voedt de "zwakke punten"-analyse. */
export const CRM_SENTIMENTS: Option[] = [
  { value: "POSITIVE", label: "Positief", color: "green" },
  { value: "NEUTRAL", label: "Neutraal", color: "slate" },
  { value: "NEGATIVE", label: "Negatief", color: "red" },
];
export const CRM_SENTIMENT_VALUES = CRM_SENTIMENTS.map((d) => d.value) as [string, ...string[]];

/** Board scope a recruiter can default to. */
export const CRM_SCOPES: Option[] = [
  { value: "mine", label: "Alleen mijn deals", color: "blue" },
  { value: "all", label: "Alle deals (team)", color: "slate" },
];
export const CRM_SCOPE_VALUES = CRM_SCOPES.map((d) => d.value) as [string, ...string[]];

/** BadgeColor choices for the pipeline-stage editor. */
export const BADGE_COLORS: Option[] = [
  { value: "slate", label: "Grijs", color: "slate" },
  { value: "blue", label: "Blauw", color: "blue" },
  { value: "green", label: "Groen", color: "green" },
  { value: "amber", label: "Amber", color: "amber" },
  { value: "red", label: "Rood", color: "red" },
  { value: "violet", label: "Violet", color: "violet" },
  { value: "cyan", label: "Cyaan", color: "cyan" },
];
export const BADGE_COLOR_VALUES = BADGE_COLORS.map((d) => d.value) as [string, ...string[]];

/** The default pipeline that seeds CrmStage — the Q4S recruitment sales flow:
 *  lead → gekwalificeerd → kandidaat voorgesteld → gesprek → geplaatst / verloren. */
export const DEFAULT_CRM_STAGES: {
  key: string;
  name: string;
  color: BadgeColor;
  order: number;
  probability: number;
  isWon?: boolean;
  isLost?: boolean;
}[] = [
  { key: "lead", name: "Lead", color: "slate", order: 0, probability: 10 },
  { key: "qualified", name: "Gekwalificeerd", color: "blue", order: 1, probability: 25 },
  { key: "proposed", name: "Kandidaat voorgesteld", color: "violet", order: 2, probability: 50 },
  { key: "interview", name: "Gesprek / interview", color: "amber", order: 3, probability: 70 },
  { key: "won", name: "Geplaatst", color: "green", order: 4, probability: 100, isWon: true },
  { key: "lost", name: "Verloren", color: "red", order: 5, probability: 0, isLost: true },
];

/** The vakgebieden the Q4S niche covers — used by the AI relevance filter. */
export const RECRUITMENT_FIELDS = [
  "QA (Quality Assurance)",
  "QC (Quality Control)",
  "HSE / Veiligheid",
  "Inspectie",
  "Welding / Lassen",
  "Coating",
  "E&I (Elektro & Instrumentatie)",
  "Civiel / Constructie",
  "Offshore",
  "Commissioning",
  "Project Management",
  "NDO / NDT",
  "Fitter / Pijpfitter",
];
