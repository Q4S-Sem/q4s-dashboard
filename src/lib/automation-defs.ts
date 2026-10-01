// Pure constants voor de automatische-acties-feature — GEEN db-import, zodat dit
// veilig in client-componenten (RuleForm) gebruikt kan worden. De engine met db
// staat in src/lib/automation.ts (server-only) en her-exporteert deze.

import { EVALUATION_TYPE_VALUES } from "./domain";
import { checkDossiers, type DossierPerson } from "./dossier-check";

export const AUTOMATION_TRIGGERS = [
  {
    value: "CERT_EXPIRING",
    label: "Certificaat verlopen of verloopt binnenkort",
    desc: "Verlopen certificaten en certificaten die binnen X dagen verlopen",
    thresholdWord: "verloopt binnen (dagen)",
    entity: "medewerker",
    vars: "{name} = certificaat · {date} = verloopdatum · {status} = compliance-status · {sourceKey} = unieke broncode",
  },
  {
    value: "PLACEMENT_ENDING",
    label: "Plaatsing loopt af",
    desc: "Actieve plaatsingen die binnen X dagen eindigen",
    thresholdWord: "eindigt binnen (dagen)",
    entity: "plaatsing",
    vars: "{name} = functie · {date} = einddatum",
  },
  {
    value: "INVOICE_OVERDUE",
    label: "Factuur te laat",
    desc: "Verzonden facturen over de vervaldatum",
    thresholdWord: "n.v.t. (drempel = 0)",
    entity: "klant",
    vars: "{number} = factuurnummer · {date} = vervaldatum",
  },
  {
    value: "CANDIDATE_STALLED",
    label: "Kandidaat zonder recruiter-opvolging",
    desc: "Kandidaten die langer dan X dagen niet zijn bijgewerkt",
    thresholdWord: "niet bijgewerkt langer dan (dagen)",
    entity: "kandidaat",
    vars: "{name} = kandidaat · {date} = laatste update · {idleDays} = dagen inactief · {thresholdDays} = drempel · {status} = type review · {sourceKey} = unieke broncode",
  },
  {
    value: "APPLICATION_STALLED",
    label: "Sollicitatie zonder recruiter-opvolging",
    desc: "Open sollicitaties die langer dan X dagen niet zijn bijgewerkt",
    thresholdWord: "niet bijgewerkt langer dan (dagen)",
    entity: "sollicitatie",
    vars: "{name} = kandidaat · vacature · {date} = laatste update · {idleDays} = dagen inactief · {thresholdDays} = drempel · {status} = fase review · {sourceKey} = unieke broncode",
  },
  {
    value: "INTERVIEW_REMINDER",
    label: "Interview met Q4S — voorbereiden of uitkomst vastleggen",
    desc: "Ingeplande interviews binnen X dagen, en gehouden interviews zonder notities of uitkomst",
    thresholdWord: "interview binnen (dagen)",
    entity: "kandidaat",
    vars: "{name} = kandidaat · {date} = interviewdatum · {days} = dagen tot/na het interview · {when} = 'over N dagen' / 'vandaag' / 'N dagen geleden' · {thresholdDays} = drempel · {status} = type herinnering · {sourceKey} = unieke broncode",
  },
  {
    value: "EVALUATION_DUE",
    label: "Kwartaalevaluatie ontbreekt (VCU / inlener)",
    desc: "Actieve plaatsingen zonder VG- of inlener-evaluatie in het lopende kwartaal",
    thresholdWord: "plaatsing loopt al minstens (dagen)",
    entity: "plaatsing",
    vars: "{name} = medewerker · {client} = inlener · {quarter} = kwartaal (bijv. Q4 2026) · {date} = startdatum plaatsing · {status} = type review · {sourceKey} = unieke broncode",
  },
  {
    value: "DOSSIER_INCOMPLETE",
    label: "Dossier onvolledig (NEN 4400 / Kiwa)",
    desc: "Actieve medewerkers met een ontbrekend of verlopen verplicht dossierstuk",
    thresholdWord: "n.v.t. (drempel = 0)",
    entity: "medewerker",
    vars: "{name} = persoon · {missing} = ontbrekende of verlopen stukken · {count} = aantal · {status} = ernst · {sourceKey} = unieke broncode",
  },
] as const;

export const AUTOMATION_TRIGGER_VALUES = AUTOMATION_TRIGGERS.map((t) => t.value) as [string, ...string[]];

export function triggerLabel(value: string): string {
  return AUTOMATION_TRIGGERS.find((t) => t.value === value)?.label ?? value;
}

/** A review-only task emitted by the certificate compliance workflow. */
export type CertificateComplianceTask = {
  entityType: "consultant";
  entityId: string;
  sourceKey: string;
  body: string;
};

type CertificateForCompliance = {
  id: string;
  consultantId: string;
  name: string;
  expiryDate: Date | null;
};

function formatComplianceDate(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function certificateSourceKey(id: string, expiryDate: Date, status: "expired" | "expiring"): string {
  return `certificate:${id}:${expiryDate.toISOString().slice(0, 10)}:${status}`;
}

/**
 * Build review-only certificate compliance tasks. This function deliberately has
 * no side effects: it cannot mail, renew a certificate, or change a consultant's
 * state. The stable sourceKey captures the certificate, its expiry date, and the
 * compliance status so a changed renewal date receives a new review task while
 * repeated daily runs remain idempotent.
 */
export function buildCertificateComplianceTasks({
  now,
  thresholdDays,
  template,
  certificates,
}: {
  now: Date;
  thresholdDays: number;
  template: string;
  certificates: CertificateForCompliance[];
}): CertificateComplianceTask[] {
  // Expiry dates represent a calendar day: a certificate expiring today remains
  // eligible as "expiring" until the following day, regardless of run time.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + thresholdDays);

  return certificates.flatMap((certificate) => {
    if (!certificate.expiryDate || certificate.expiryDate > horizon) return [];

    const status = certificate.expiryDate < today ? "expired" : "expiring";
    const statusLabel = status === "expired" ? "VERLOPEN" : `VERLOOPT BINNEN ${thresholdDays} DAGEN`;
    const sourceKey = certificateSourceKey(certificate.id, certificate.expiryDate, status);
    const body = template.replace(/\{(name|date|number|status|sourceKey)\}/g, (_, key: string) => {
      const values: Record<string, string> = {
        name: certificate.name,
        date: formatComplianceDate(certificate.expiryDate!),
        number: "",
        status: statusLabel,
        sourceKey,
      };
      return values[key] ?? "";
    });

    return [{ entityType: "consultant", entityId: certificate.consultantId, sourceKey, body }];
  });
}

/** A review-only task emitted for a candidate or application without recent recruiter work. */
export type StalledRecruitmentTask = {
  entityType: "candidate" | "application";
  entityId: string;
  sourceKey: string;
  body: string;
};

type CandidateForStalledReview = {
  id: string;
  firstName: string;
  lastName: string;
  updatedAt: Date;
};

type ApplicationForStalledReview = {
  id: string;
  status: string;
  updatedAt: Date;
  candidate: { firstName: string; lastName: string };
  vacancy: { title: string } | null;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function updatedSourceKey(entityType: "candidate" | "application", id: string, updatedAt: Date): string {
  return `${entityType}:${id}:updated:${updatedAt.toISOString().slice(0, 10)}`;
}

function fillStalledRecruitmentTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(name|date|number|status|sourceKey|idleDays|thresholdDays)\}/g, (_, key: string) => values[key] ?? "");
}

/**
 * Build internal recruiter review tasks for recruitment records that are strictly
 * older than a rule's threshold. The stable source key changes only after a human
 * updates the source record, so repeated automation runs stay idempotent while a
 * renewed record can receive a fresh review task. This function has no side
 * effects: it cannot send messages, alter statuses, create deals, or schedule interviews.
 */
export function buildStalledRecruitmentTasks({
  now,
  thresholdDays,
  template,
  candidates,
  applications,
}: {
  now: Date;
  thresholdDays: number;
  template: string;
  candidates: CandidateForStalledReview[];
  applications: ApplicationForStalledReview[];
}): StalledRecruitmentTask[] {
  const today = startOfUtcDay(now);
  const openApplicationStatuses = new Set(["NEW", "SCREENING", "PROPOSED"]);
  const toIdleDays = (updatedAt: Date) => Math.floor((today.getTime() - startOfUtcDay(updatedAt).getTime()) / 86_400_000);
  const toTask = (
    entityType: "candidate" | "application",
    entityId: string,
    name: string,
    status: string,
    updatedAt: Date,
  ): StalledRecruitmentTask | null => {
    const idleDays = toIdleDays(updatedAt);
    if (idleDays <= thresholdDays) return null;
    const sourceKey = updatedSourceKey(entityType, entityId, updatedAt);
    return {
      entityType,
      entityId,
      sourceKey,
      body: fillStalledRecruitmentTemplate(template, {
        name,
        date: formatComplianceDate(updatedAt),
        number: "",
        status,
        sourceKey,
        idleDays: String(idleDays),
        thresholdDays: String(thresholdDays),
      }),
    };
  };

  const candidateTasks = candidates.flatMap((candidate) => {
    const task = toTask(
      "candidate",
      candidate.id,
      `${candidate.firstName} ${candidate.lastName}`.trim(),
      "KANDIDAAT",
      candidate.updatedAt,
    );
    return task ? [task] : [];
  });
  const applicationTasks = applications.flatMap((application) => {
    if (!openApplicationStatuses.has(application.status)) return [];
    const candidateName = `${application.candidate.firstName} ${application.candidate.lastName}`.trim();
    const vacancyName = application.vacancy?.title ?? "geen vacature gekoppeld";
    const task = toTask(
      "application",
      application.id,
      `${candidateName} · ${vacancyName}`,
      `SOLLICITATIE ${application.status}`,
      application.updatedAt,
    );
    return task ? [task] : [];
  });

  return [...candidateTasks, ...applicationTasks];
}

/** A review-only reminder emitted for a candidate's interview with Q4S. */
export type InterviewReminderTask = {
  entityType: "candidate";
  entityId: string;
  sourceKey: string;
  body: string;
};

type CandidateForInterviewReminder = {
  id: string;
  firstName: string;
  lastName: string;
  interviewStatus: string;
  interviewDate: Date | null;
  interviewNotes: string | null;
};

/** upcoming = voorbereiden · outcome = uitkomst ontbreekt · notes = notities ontbreken. */
type InterviewReminderKind = "upcoming" | "outcome" | "notes";

const INTERVIEW_REMINDER_LABELS: Record<InterviewReminderKind, string> = {
  upcoming: "INTERVIEW GEPLAND",
  outcome: "INTERVIEW-UITKOMST ONTBREEKT",
  notes: "INTERVIEW-NOTITIES ONTBREKEN",
};

function interviewSourceKey(
  candidateId: string,
  interviewDate: Date,
  interviewStatus: string,
  kind: InterviewReminderKind,
): string {
  return `interview:${candidateId}:${interviewDate.toISOString().slice(0, 10)}:${interviewStatus}:${kind}`;
}

/** Explainable Dutch phrasing for the day distance, so one template covers both directions. */
function interviewWhen(dayDelta: number): string {
  if (dayDelta === 0) return "vandaag";
  return dayDelta > 0 ? `over ${dayDelta} dagen` : `${-dayDelta} dagen geleden`;
}

function fillInterviewReminderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(name|date|number|status|sourceKey|days|when|thresholdDays)\}/g, (_, key: string) => values[key] ?? "");
}

/**
 * Build internal recruiter reminders around the interview with Q4S: interviews
 * coming up within the rule's threshold, and interviews whose date has passed
 * while the notes or the outcome are still unrecorded. Interview dates count as a
 * calendar day, so an interview later today is still a preparation reminder. The
 * source key carries the candidate, the interview date and the interview status,
 * so repeated runs stay idempotent while a rescheduled or re-opened interview
 * gets a fresh reminder. This function has no side effects: it cannot send
 * messages, create a calendar invite, or change interview, application or
 * candidate status.
 */
export function buildInterviewReminderTasks({
  now,
  thresholdDays,
  template,
  candidates,
}: {
  now: Date;
  thresholdDays: number;
  template: string;
  candidates: CandidateForInterviewReminder[];
}): InterviewReminderTask[] {
  const today = startOfUtcDay(now);

  return candidates.flatMap((candidate) => {
    if (!candidate.interviewDate) return [];
    const interviewDay = startOfUtcDay(candidate.interviewDate);
    const dayDelta = Math.round((interviewDay.getTime() - today.getTime()) / 86_400_000);

    let kind: InterviewReminderKind | null = null;
    if (dayDelta >= 0) {
      // Alleen een ingepland interview vraagt om voorbereiding.
      if (candidate.interviewStatus === "PLANNED" && dayDelta <= thresholdDays) kind = "upcoming";
    } else if (candidate.interviewStatus === "PLANNED") {
      kind = "outcome";
    } else if (candidate.interviewStatus === "DONE" && !candidate.interviewNotes?.trim()) {
      kind = "notes";
    }
    if (!kind) return [];

    const sourceKey = interviewSourceKey(candidate.id, interviewDay, candidate.interviewStatus, kind);
    return [
      {
        entityType: "candidate" as const,
        entityId: candidate.id,
        sourceKey,
        body: fillInterviewReminderTemplate(template, {
          name: `${candidate.firstName} ${candidate.lastName}`.trim(),
          date: formatComplianceDate(candidate.interviewDate),
          number: "",
          status: INTERVIEW_REMINDER_LABELS[kind],
          sourceKey,
          days: String(Math.abs(dayDelta)),
          when: interviewWhen(dayDelta),
          thresholdDays: String(thresholdDays),
        }),
      },
    ];
  });
}

/** A review-only task emitted for an active placement without a quarterly evaluation. */
export type EvaluationDueTask = {
  entityType: "placement";
  entityId: string;
  sourceKey: string;
  body: string;
};

type PlacementForEvaluationDue = {
  id: string;
  consultantId: string;
  clientId: string | null;
  startDate: Date;
  consultant: { firstName: string; lastName: string };
  client: { companyName: string } | null;
};

type EvaluationForPeriod = {
  consultantId: string;
  clientId: string | null;
  type: string;
  year: number;
  quarter: number;
};

/**
 * Jaar + kwartaal (1..4) van een moment, in UTC. Bewust niet de lokale tijdzone:
 * een run op een kwartaalgrens moet op elke server hetzelfde kwartaal opleveren,
 * anders verschuift de bronsleutel van de taak mee met de servertijd.
 */
export function currentEvaluationPeriod(now: Date): { year: number; quarter: number } {
  return { year: now.getUTCFullYear(), quarter: Math.floor(now.getUTCMonth() / 3) + 1 };
}

function evaluationDueSourceKey(placementId: string, year: number, quarter: number): string {
  return `evaluation:${placementId}:${year}Q${quarter}`;
}

function fillEvaluationDueTemplate(template: string, values: Record<string, string>): string {
  return template.replace(
    /\{(name|client|quarter|date|number|status|sourceKey|thresholdDays)\}/g,
    (_, key: string) => values[key] ?? "",
  );
}

/**
 * Build internal review tasks for every ACTIVE placement that still misses a
 * quarterly evaluation (VG-evaluatie of evaluatie inlener) in the current quarter.
 * Toerekening: een evaluatie dekt een plaatsing als die van dezelfde medewerker is
 * én bij dezelfde inlener hoort; staat de inlener als vrije tekst in de evaluatie
 * (geen clientId) of hangt de plaatsing nog zonder bedrijf, dan is dat niet hard te
 * koppelen en geven we de medewerker het voordeel van de twijfel — liever een taak
 * missen dan onterecht blijven porren. `thresholdDays` is een respijt: een plaatsing
 * die nog maar net loopt hoeft dit kwartaal nog geen evaluatie te hebben. De
 * sourceKey is per plaatsing + kwartaal, dus herhaalde runs blijven idempotent en
 * elk nieuw kwartaal komt er één nieuwe taak. Deze functie heeft geen bijwerkingen:
 * ze kan geen evaluatie aanmaken of versturen en geen status wijzigen.
 */
export function buildEvaluationDueTasks({
  now,
  thresholdDays,
  template,
  placements,
  evaluations,
}: {
  now: Date;
  thresholdDays: number;
  template: string;
  placements: PlacementForEvaluationDue[];
  evaluations: EvaluationForPeriod[];
}): EvaluationDueTask[] {
  const today = startOfUtcDay(now);
  const { year, quarter } = currentEvaluationPeriod(now);
  const quarterLabel = `Q${quarter} ${year}`;

  // Per medewerker de inleners die dit kwartaal al geëvalueerd zijn ("*" = een
  // evaluatie zonder gekoppelde klant, die dekt al zijn plaatsingen).
  const evaluatedClients = new Map<string, Set<string>>();
  for (const evaluation of evaluations) {
    if (!(EVALUATION_TYPE_VALUES as readonly string[]).includes(evaluation.type)) continue;
    if (evaluation.year !== year || evaluation.quarter !== quarter) continue;
    const clients = evaluatedClients.get(evaluation.consultantId) ?? new Set<string>();
    clients.add(evaluation.clientId ?? "*");
    evaluatedClients.set(evaluation.consultantId, clients);
  }

  return placements.flatMap((placement) => {
    const runningDays = Math.floor(
      (today.getTime() - startOfUtcDay(placement.startDate).getTime()) / 86_400_000,
    );
    if (runningDays < thresholdDays) return [];

    const clients = evaluatedClients.get(placement.consultantId);
    if (clients && (clients.has("*") || !placement.clientId || clients.has(placement.clientId))) {
      return [];
    }

    const sourceKey = evaluationDueSourceKey(placement.id, year, quarter);
    return [
      {
        entityType: "placement" as const,
        entityId: placement.id,
        sourceKey,
        body: fillEvaluationDueTemplate(template, {
          name: `${placement.consultant.firstName} ${placement.consultant.lastName}`.trim(),
          client: placement.client?.companyName ?? "geen bedrijf gekoppeld",
          quarter: quarterLabel,
          date: formatComplianceDate(placement.startDate),
          number: "",
          status: "KWARTAALEVALUATIE ONTBREEKT",
          sourceKey,
          thresholdDays: String(thresholdDays),
        }),
      },
    ];
  });
}

/** A review-only task emitted for a person whose personnel file misses a required item. */
export type DossierIncompleteTask = {
  entityType: "consultant" | "employee";
  entityId: string;
  sourceKey: string;
  body: string;
};

function dossierSourceKey(personId: string, missingKeys: string[]): string {
  return `dossier:${personId}:${missingKeys.join("+")}`;
}

function fillDossierTemplate(template: string, values: Record<string, string>): string {
  return template.replace(
    /\{(name|missing|count|date|number|status|sourceKey)\}/g,
    (_, key: string) => values[key] ?? "",
  );
}

/**
 * Build internal review tasks for personnel files that are not audit-proof: per
 * persoon één taak met de stukken die ontbreken of verlopen zijn (zie
 * DOSSIER_REQUIREMENTS in ./dossier-check). De sourceKey bevat de gesorteerde set
 * ontbrekende stukken, dus herhaalde runs blijven idempotent terwijl een dossier
 * dat deels is bijgewerkt een nieuwe, kleinere taak krijgt. Deze functie heeft geen
 * bijwerkingen: ze kan geen document opvragen, niets mailen en geen status wijzigen.
 */
export function buildDossierIncompleteTasks({
  now,
  template,
  people,
}: {
  now: Date;
  template: string;
  people: DossierPerson[];
}): DossierIncompleteTask[] {
  return checkDossiers(people, now).flatMap((check) => {
    if (check.issues.length === 0) return [];
    const sourceKey = dossierSourceKey(check.id, check.missingKeys);
    return [
      {
        entityType: check.kind,
        entityId: check.id,
        sourceKey,
        body: fillDossierTemplate(template, {
          name: check.name,
          missing: check.issues.map((item) => item.label).join(", "),
          count: String(check.issues.length),
          date: "",
          number: "",
          status: check.status === "red" ? "DOSSIER NIET AUDITPROOF" : "DOSSIER VRAAGT AANDACHT",
          sourceKey,
        }),
      },
    ];
  });
}

/** Kant-en-klare voorbeeldregels (één-klik toevoegen). */
export const AUTOMATION_PRESETS = [
  {
    name: "Certificaat-compliance: verlopen of binnen 30 dagen",
    trigger: "CERT_EXPIRING",
    thresholdDays: 30,
    taskType: "TASK",
    template:
      "{status}: certificaat {name} verloopt op {date}. Handmatige compliance-review nodig (bron: {sourceKey}); geen e-mail, vernieuwing of statuswijziging is automatisch uitgevoerd.",
    dueOffsetDays: 0,
  },
  {
    name: "Plaatsing loopt binnen 30 dagen af",
    trigger: "PLACEMENT_ENDING",
    thresholdDays: 30,
    taskType: "TASK",
    template: "Plaatsing {name} eindigt op {date} — verlenging of eindgesprek plannen.",
    dueOffsetDays: 0,
  },
  {
    name: "Factuur te laat — nabellen",
    trigger: "INVOICE_OVERDUE",
    thresholdDays: 0,
    taskType: "CALL",
    template: "Factuur {number} is te laat (verviel {date}) — nabellen.",
    dueOffsetDays: 0,
  },
  {
    name: "Kandidaat: review na 14 dagen zonder update",
    trigger: "CANDIDATE_STALLED",
    thresholdDays: 14,
    taskType: "TASK",
    template:
      "{status}: {name} is {idleDays} dagen niet bijgewerkt sinds {date} (drempel {thresholdDays} dagen; bron: {sourceKey}). Handmatige recruiter-review nodig; geen bericht, statuswijziging, deal of interview is automatisch uitgevoerd.",
    dueOffsetDays: 0,
  },
  {
    name: "Sollicitatie: review na 7 dagen zonder update",
    trigger: "APPLICATION_STALLED",
    thresholdDays: 7,
    taskType: "TASK",
    template:
      "{status}: {name} is {idleDays} dagen niet bijgewerkt sinds {date} (drempel {thresholdDays} dagen; bron: {sourceKey}). Handmatige recruiter-review nodig; geen bericht, statuswijziging, deal of interview is automatisch uitgevoerd.",
    dueOffsetDays: 0,
  },
  {
    name: "Interview met Q4S: voorbereiden binnen 7 dagen en uitkomst vastleggen",
    trigger: "INTERVIEW_REMINDER",
    thresholdDays: 7,
    taskType: "TASK",
    template:
      "{status}: interview met {name} op {date} ({when}; drempel {thresholdDays} dagen; bron: {sourceKey}). Handmatige recruiter-opvolging nodig; geen bericht, agenda-uitnodiging of statuswijziging is automatisch uitgevoerd.",
    dueOffsetDays: 0,
  },
  {
    name: "Kwartaalevaluatie ontbreekt (VCU / inlener)",
    trigger: "EVALUATION_DUE",
    thresholdDays: 14,
    taskType: "TASK",
    template:
      "{status}: Kwartaalevaluatie {quarter} ontbreekt voor {name} bij {client} (plaatsing sinds {date}; bron: {sourceKey}). Handmatig een evaluatie opstellen en bespreken; er is niets automatisch aangemaakt of verstuurd.",
    dueOffsetDays: 0,
  },
  {
    name: "Dossier onvolledig (NEN 4400 / Kiwa)",
    trigger: "DOSSIER_INCOMPLETE",
    thresholdDays: 0,
    taskType: "TASK",
    template:
      "{status}: dossier van {name} mist {count} verplicht(e) stuk(ken) — {missing} (bron: {sourceKey}). Handmatige dossier-review nodig; er is niets opgevraagd, gemaild of gewijzigd.",
    dueOffsetDays: 0,
  },
] as const;
