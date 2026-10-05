// Dossiercheck (NEN 4400 / Kiwa / VCU): welke verplichte dossierstukken ontbreken
// of zijn verlopen? PURE logica — geen db, geen IO, geen mail en geen status- of
// dossierwijziging; deze module leest alleen wat haar wordt aangereikt. De
// lees-alleen pagina (audits/nen-4400) en de DOSSIER_INCOMPLETE-
// automatisering voeren hem met al opgehaalde gegevens (zie ./dossier-data).

/** consultant = gedetacheerde (werknemers-hub) · employee = eigen Q4S-personeel. */
export type DossierPersonKind = "consultant" | "employee";
export type DossierItemStatus = "ok" | "missing" | "expired";
/** hard = hierop valt de audit om (rood) · soft = vraagt aandacht (oranje). */
export type DossierSeverity = "hard" | "soft";
export type DossierStatus = "green" | "amber" | "red";

export type DossierCertificate = { name: string; expiryDate: Date | null };

export type DossierPerson = {
  id: string;
  kind: DossierPersonKind;
  name: string;
  /** ZZP | LOONDIENST | UITZEND | STAGE — ZZP = freelancer (zie FREELANCE_EMPLOYMENT_TYPES). */
  employmentType: string;
  /** Categorieën van de aanwezige dossierdocumenten (Document/EmployeeDocument.category). */
  documentCategories: string[];
  /** Hangt er een Contract-record (overeenkomst van opdracht) aan deze persoon? */
  hasContractRecord?: boolean;
  certificates: DossierCertificate[];
  /** Datum van de meest recente evaluatie, of null als er nog geen ligt. */
  lastEvaluationAt: Date | null;
};

export type DossierItem = {
  key: string;
  label: string;
  severity: DossierSeverity;
  status: DossierItemStatus;
  /** Korte toelichting waarom het stuk niet in orde is, of null. */
  detail: string | null;
};

export type DossierCheck = {
  id: string;
  kind: DossierPersonKind;
  name: string;
  employmentType: string;
  status: DossierStatus;
  /** Alle van toepassing zijnde eisen, in de vaste volgorde van DOSSIER_REQUIREMENTS. */
  items: DossierItem[];
  /** Alleen de stukken die ontbreken of verlopen zijn. */
  issues: DossierItem[];
  /** Gesorteerde sleutels van `issues` — stabiele basis voor een automation-sourceKey. */
  missingKeys: string[];
};

/** Een evaluatie mag maximaal zo oud zijn (kwartaalritme met een kwartaal marge). */
export const EVALUATION_MAX_AGE_MONTHS = 6;

/** Dienstverbanden die als freelance gelden: dan is een KvK-uittreksel verplicht. */
export const FREELANCE_EMPLOYMENT_TYPES = ["ZZP"];

export function isFreelancer(person: DossierPerson): boolean {
  return FREELANCE_EMPLOYMENT_TYPES.includes(person.employmentType);
}

/** Datums in de toelichting altijd in UTC, zodat de servertijdzone niets verschuift. */
function formatDossierDate(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Dezelfde dag `months` maanden eerder, met de dag geklemd op het maandeinde
 *  (31 augustus − 6 maanden = 28/29 februari, niet 2 of 3 maart). */
function monthsBeforeUtc(date: Date, months: number): Date {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)),
  );
}

function hasDocument(person: DossierPerson, category: string): boolean {
  return person.documentCategories.includes(category);
}

type DossierVerdict = { status: DossierItemStatus; detail?: string };

export type DossierRequirement = {
  key: string;
  label: string;
  severity: DossierSeverity;
  /** Geldt deze eis voor deze persoon? Niets = voor iedereen. */
  appliesTo?: (person: DossierPerson) => boolean;
  evaluate: (person: DossierPerson, now: Date) => DossierVerdict;
};

/**
 * DE verplichte set — één lijst, zodat de eisen van de auditor hier in één
 * oogopslag aan te passen zijn. De volgorde is ook de weergave-volgorde.
 */
export const DOSSIER_REQUIREMENTS: DossierRequirement[] = [
  {
    key: "ID",
    label: "Identiteitsbewijs (vastlegging conform AVG)",
    severity: "hard",
    evaluate: (person) =>
      hasDocument(person, "ID")
        ? { status: "ok" }
        : { status: "missing", detail: "geen ID-vastlegging in het dossier" },
  },
  {
    key: "CONTRACT",
    label: "Contract / overeenkomst van opdracht",
    severity: "hard",
    evaluate: (person) =>
      hasDocument(person, "CONTRACT") || person.hasContractRecord
        ? { status: "ok" }
        : { status: "missing", detail: "geen contractdocument en geen contract-record" },
  },
  {
    key: "KVK",
    label: "KvK-uittreksel",
    severity: "hard",
    appliesTo: isFreelancer,
    evaluate: (person) =>
      hasDocument(person, "KVK")
        ? { status: "ok" }
        : { status: "missing", detail: "verplicht bij ZZP/freelance (ketenaansprakelijkheid)" },
  },
  {
    key: "CERTIFICATES",
    label: "Geldige certificaten (niets verlopen)",
    severity: "hard",
    evaluate: (person, now) => {
      // Een verloopdatum is een kalenderdag: wie vandaag verloopt is vandaag nog geldig.
      const today = startOfUtcDay(now);
      const expired = person.certificates.filter(
        (c): c is DossierCertificate & { expiryDate: Date } =>
          c.expiryDate !== null && c.expiryDate < today,
      );
      if (expired.length === 0) return { status: "ok" };
      return {
        status: "expired",
        detail: `verlopen: ${expired
          .map((c) => `${c.name} (${formatDossierDate(c.expiryDate)})`)
          .join(", ")}`,
      };
    },
  },
  {
    key: "EVALUATION",
    label: `Evaluatie in de laatste ${EVALUATION_MAX_AGE_MONTHS} maanden`,
    severity: "soft",
    // Eigen personeel kent de jaarlijkse beoordeling (EmployeeReview), niet de
    // VCU-kwartaalevaluatie van een inlener — die eis geldt dus alleen gedetacheerden.
    appliesTo: (person) => person.kind === "consultant",
    evaluate: (person, now) => {
      if (!person.lastEvaluationAt) {
        return { status: "missing", detail: "nog geen evaluatie vastgelegd" };
      }
      const cutoff = monthsBeforeUtc(startOfUtcDay(now), EVALUATION_MAX_AGE_MONTHS);
      if (startOfUtcDay(person.lastEvaluationAt) < cutoff) {
        return {
          status: "expired",
          detail: `laatste evaluatie ${formatDossierDate(person.lastEvaluationAt)}`,
        };
      }
      return { status: "ok" };
    },
  },
];

/** Beoordeel één dossier tegen DOSSIER_REQUIREMENTS. */
export function checkDossier(person: DossierPerson, now: Date): DossierCheck {
  const items: DossierItem[] = DOSSIER_REQUIREMENTS.filter(
    (requirement) => requirement.appliesTo?.(person) ?? true,
  ).map((requirement) => {
    const verdict = requirement.evaluate(person, now);
    return {
      key: requirement.key,
      label: requirement.label,
      severity: requirement.severity,
      status: verdict.status,
      detail: verdict.detail ?? null,
    };
  });
  const issues = items.filter((item) => item.status !== "ok");
  const status: DossierStatus = issues.some((item) => item.severity === "hard")
    ? "red"
    : issues.length > 0
      ? "amber"
      : "green";

  return {
    id: person.id,
    kind: person.kind,
    name: person.name,
    employmentType: person.employmentType,
    status,
    items,
    issues,
    missingKeys: issues.map((item) => item.key).sort(),
  };
}

const STATUS_ORDER: Record<DossierStatus, number> = { red: 0, amber: 1, green: 2 };

/** Beoordeel een hele lijst dossiers — slechtste eerst, daarna op naam. */
export function checkDossiers(people: DossierPerson[], now: Date): DossierCheck[] {
  return people
    .map((person) => checkDossier(person, now))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, "nl"),
    );
}

/** Link naar het dossier van deze persoon, in de hub waar hij beheerd wordt. */
export function dossierHref(person: { kind: DossierPersonKind; id: string }): string {
  return person.kind === "consultant" ? `/werknemers/${person.id}` : `/medewerkers/${person.id}`;
}
