import { db } from "./db";
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

export type RunResult = { rule: string; created: number }[];

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
        const certs = await db.certificate.findMany({
          where: { expiryDate: { gte: now, lte: horizon } },
          select: { id: true, name: true, expiryDate: true, consultantId: true },
        });
        tasks = certs.map((c) => ({
          entityType: "consultant",
          entityId: c.consultantId,
          sourceKey: c.id,
          body: fill(rule.template, { name: c.name, date: formatDate(c.expiryDate) }),
        }));
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
      }

      let created = 0;
      for (const t of tasks) {
        if (existing.has(t.sourceKey)) continue;
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
      }
      await db.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: now } });
      perRule.push({ rule: rule.name, created });
      total += created;
    } catch {
      perRule.push({ rule: rule.name, created: 0 });
    }
  }

  return { total, perRule };
}
