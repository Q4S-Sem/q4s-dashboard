import { db } from "./db";
import {
  buildCertificateComplianceTasks,
  buildInterviewReminderTasks,
  buildStalledRecruitmentTasks,
} from "./automation-defs";
import { formatDate } from "./utils";

// Automatische acties (Odoo `base_automation`-stijl): tijd-gebaseerde regels die
// taken/herinneringen (Activity, kind TODO) aanmaken. Idempotent via
// Activity.ruleId + sourceKey. Uitvoeren via "Regels nu uitvoeren" of een cron.
// De pure constants staan in ./automation-defs (db-vrij → veilig voor client).

export {
  AUTOMATION_TRIGGERS,
  AUTOMATION_TRIGGER_VALUES,
  AUTOMATION_PRESETS,
  triggerLabel,
} from "./automation-defs";

/** Vul {name}/{date}/{number} in het sjabloon in. */
function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(name|date|number)\}/g, (_, k: string) => vars[k] ?? "");
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export type RunResult = { rule: string; created: number; eligible: number; skippedExisting: number }[];

/**
 * Voer alle actieve regels uit. Maakt taken (Activity, TODO) aan op het juiste
 * record. Idempotent: een taak wordt per (regel, bronrecord) maar één keer
 * aangemaakt (dedupe op ruleId + sourceKey). Best-effort per regel.
 */
export async function runAutomations(): Promise<{ total: number; perRule: RunResult }> {
  const now = new Date();
  const rules = await db.automationRule.findMany({ where: { active: true } });
  const perRule: RunResult = [];
  let total = 0;

  for (const rule of rules) {
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + rule.thresholdDays);
    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + rule.dueOffsetDays);

    const existing = new Set(
      (await db.activity.findMany({ where: { ruleId: rule.id }, select: { sourceKey: true } }))
        .map((a) => a.sourceKey)
        .filter((x): x is string => Boolean(x)),
    );

    type Task = { entityType: string; entityId: string; sourceKey: string; body: string };
    let tasks: Task[] = [];

    try {
      if (rule.trigger === "CERT_EXPIRING") {
        // Compliance only covers active consultants. This creates internal review
        // tasks; it deliberately does not send mail, renew certificates, or alter
        // a consultant/candidate state.
        const certs = await db.certificate.findMany({
          where: {
            expiryDate: { not: null, lte: horizon },
            consultant: { active: true },
          },
          select: { id: true, name: true, expiryDate: true, consultantId: true },
        });
        tasks = buildCertificateComplianceTasks({
          now,
          thresholdDays: rule.thresholdDays,
          template: rule.template,
          certificates: certs,
        });
      } else if (rule.trigger === "PLACEMENT_ENDING") {
        const pls = await db.placement.findMany({
          where: { status: "ACTIVE", endDate: { gte: now, lte: horizon } },
          select: { id: true, title: true, endDate: true },
        });
        tasks = pls.map((p) => ({
          entityType: "placement",
          entityId: p.id,
          sourceKey: p.id,
          body: fill(rule.template, { name: p.title, date: formatDate(p.endDate) }),
        }));
      } else if (rule.trigger === "INVOICE_OVERDUE") {
        const invs = await db.invoice.findMany({
          where: { status: "SENT", dueDate: { lt: now } },
          select: { id: true, number: true, dueDate: true, clientId: true },
        });
        tasks = invs.map((i) => ({
          entityType: "client",
          entityId: i.clientId,
          sourceKey: i.id,
          body: fill(rule.template, { number: i.number, date: formatDate(i.dueDate) }),
        }));
      } else if (rule.trigger === "CANDIDATE_STALLED" || rule.trigger === "APPLICATION_STALLED") {
        // Stalled recruitment rules create review-only Activity TODOs. They use
        // `updatedAt` as the visible, explainable last-touch timestamp and never
        // send messages, alter pipeline/candidate status, create deals, or schedule interviews.
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - rule.thresholdDays);
        const [candidates, applications] = await Promise.all([
          rule.trigger === "CANDIDATE_STALLED"
            ? db.candidate.findMany({
                where: { updatedAt: { lt: cutoff } },
                select: { id: true, firstName: true, lastName: true, updatedAt: true },
              })
            : [],
          rule.trigger === "APPLICATION_STALLED"
            ? db.application.findMany({
                where: {
                  status: { in: ["NEW", "SCREENING", "PROPOSED"] },
                  updatedAt: { lt: cutoff },
                },
                select: {
                  id: true,
                  status: true,
                  updatedAt: true,
                  candidate: { select: { firstName: true, lastName: true } },
                  vacancy: { select: { title: true } },
                },
              })
            : [],
        ]);
        tasks = buildStalledRecruitmentTasks({
          now,
          thresholdDays: rule.thresholdDays,
          template: rule.template,
          candidates,
          applications,
        });
      } else if (rule.trigger === "INTERVIEW_REMINDER") {
        // Interview reminders create review-only Activity TODOs for the recruiter:
        // prepare an upcoming interview, or log the notes/outcome of one that has
        // passed. They never send a message, create a calendar invite, or change
        // interview, application or candidate status.
        //
        // The builder treats an interview date as a calendar day, so the query
        // horizon runs to the END of the last eligible day; otherwise an interview
        // later on that day would be dropped before the builder ever sees it.
        const interviewHorizon = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + rule.thresholdDays + 1),
        );
        const candidates = await db.candidate.findMany({
          where: {
            interviewDate: { not: null, lt: interviewHorizon },
            interviewStatus: { in: ["PLANNED", "DONE"] },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            interviewStatus: true,
            interviewDate: true,
            interviewNotes: true,
          },
        });
        tasks = buildInterviewReminderTasks({
          now,
          thresholdDays: rule.thresholdDays,
          template: rule.template,
          candidates,
        });
      }

      let created = 0;
      let skippedExisting = 0;
      for (const t of tasks) {
        if (existing.has(t.sourceKey)) {
          skippedExisting++;
          continue;
        }
        try {
          await db.activity.create({
            data: {
              entityType: t.entityType,
              entityId: t.entityId,
              kind: "TODO",
              type: rule.taskType,
              body: t.body,
              dueAt,
              ruleId: rule.id,
              sourceKey: t.sourceKey,
            },
          });
          created++;
        } catch (error) {
          // The unique ruleId/sourceKey constraint also protects concurrent cron
          // and manual runs after the optimistic existing-key check above.
          if (isUniqueConstraintError(error)) {
            skippedExisting++;
            continue;
          }
          throw error;
        }
      }
      await db.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: now } });
      perRule.push({ rule: rule.name, created, eligible: tasks.length, skippedExisting });
      total += created;
    } catch {
      perRule.push({ rule: rule.name, created: 0, eligible: 0, skippedExisting: 0 });
    }
  }

  return { total, perRule };
}
