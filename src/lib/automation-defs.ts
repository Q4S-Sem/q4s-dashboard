// Pure constants voor de automatische-acties-feature — GEEN db-import, zodat dit
// veilig in client-componenten (RuleForm) gebruikt kan worden. De engine met db
// staat in src/lib/automation.ts (server-only) en her-exporteert deze.

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
] as const;
