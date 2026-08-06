import { Zap, Plus, Trash2, RefreshCw, CheckCircle2, CircleDot } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDate } from "@/lib/utils";
import { CRM_NOTE_TYPES, labelFor } from "@/lib/domain";
import { AUTOMATION_PRESETS, triggerLabel } from "@/lib/automation";
import { RuleForm } from "./RuleForm";
import { toggleRule, deleteRule, addPreset, runNow } from "./actions";

export const metadata = { title: "Automatisering" };
export const dynamic = "force-dynamic";

export default async function AutomatiseringPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; ran?: string }>;
}) {
  const sp = await searchParams;
  const [rules, createdCount, openCount] = await Promise.all([
    db.automationRule.findMany({ orderBy: { createdAt: "asc" } }),
    db.activity.count({ where: { ruleId: { not: null } } }),
    db.activity.count({ where: { ruleId: { not: null }, done: false } }),
  ]);
  const activeCount = rules.filter((r) => r.active).length;
  const existingTriggers = new Set(rules.map((r) => r.trigger));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automatische acties"
        description="Regels in de stijl van Odoo: 'als een situatie zich voordoet → maak automatisch een taak/herinnering'. Voer ze handmatig uit of laat de dagelijkse sync ze draaien."
        actions={
          <form action={runNow}>
            <SubmitButton pendingLabel="Uitvoeren…">
              <RefreshCw className="h-4 w-4" /> Regels nu uitvoeren
            </SubmitButton>
          </form>
        }
      />

      {sp.saved && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Regel opgeslagen.</p>
      )}
      {sp.ran !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {sp.ran === "0"
            ? "Regels uitgevoerd — geen nieuwe taken (alles was al aangemaakt of niets voldeed)."
            : `✓ ${sp.ran} nieuwe taak/taken automatisch aangemaakt en klaargezet op de juiste records.`}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Actieve regels" value={`${activeCount}/${rules.length}`} icon={<Zap className="h-5 w-5" />} accent="brand" />
        <StatCard label="Taken aangemaakt" value={createdCount} icon={<CheckCircle2 className="h-5 w-5" />} accent="violet" />
        <StatCard label="Nog open" value={openCount} icon={<CircleDot className="h-5 w-5" />} accent={openCount ? "amber" : "slate"} />
      </div>

      {/* Presets — één klik */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Kant-en-klare regels
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {AUTOMATION_PRESETS.map((p, idx) => {
            const already = existingTriggers.has(p.trigger);
            return (
              <div key={p.name} className="flex flex-col rounded-xl border border-ink-200 bg-white p-4">
                <p className="text-sm font-semibold text-ink-900">{p.name}</p>
                <p className="mt-1 flex-1 text-xs text-ink-500">“{p.template}”</p>
                <div className="mt-3">
                  {already ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Al toegevoegd
                    </span>
                  ) : (
                    <form action={addPreset}>
                      <input type="hidden" name="idx" value={idx} />
                      <SubmitButton size="sm" variant="outline" pendingLabel="Toevoegen…">
                        <Plus className="h-4 w-4" /> Toevoegen
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Regels-lijst */}
      <Card>
        <CardHeader>
          <CardTitle>Regels</CardTitle>
          <span className="text-sm text-ink-400">{rules.length}</span>
        </CardHeader>
        {rules.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Nog geen regels. Voeg een kant-en-klare regel toe of maak er hieronder zelf één.
          </CardContent>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
                    {r.name}
                    <Badge color="blue">{triggerLabel(r.trigger)}</Badge>
                    {r.trigger !== "INVOICE_OVERDUE" && (
                      <span className="text-xs font-normal text-ink-400">binnen {r.thresholdDays} dgn</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    → {labelFor(CRM_NOTE_TYPES, r.taskType)}: “{r.template}”
                    {r.lastRunAt && ` · laatst uitgevoerd ${formatDate(r.lastRunAt)}`}
                  </p>
                </div>
                <form action={toggleRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className={
                      r.active
                        ? "rounded-sm bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
                        : "rounded-sm bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-500 hover:bg-ink-200"
                    }
                  >
                    {r.active ? "Actief" : "Uit"}
                  </button>
                </form>
                <form action={deleteRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" title="Verwijderen" aria-label="Regel verwijderen" className="text-ink-300 transition-colors hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Nieuwe regel */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Zelf een regel maken
        </h2>
        <RuleForm />
      </div>
    </div>
  );
}
