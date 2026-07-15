"use client";

import { Circle, Trash2, CalendarClock, MessageSquarePlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, Textarea, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { CRM_NOTE_MANUAL_TYPES, CRM_NOTE_TYPES, labelFor, colorFor } from "@/lib/domain";
import type { ActivityItem } from "@/lib/activities";
import { addActivity, completeActivity, reopenActivity, deleteActivity } from "./actions";

/**
 * Odoo-achtige "chatter" op elk record: leg notities vast of plan een taak (met
 * datum), vink taken af en zie de hele tijdlijn. Generiek via entityType/entityId.
 */
export function ActivityFeed({
  entityType,
  entityId,
  path,
  activities,
}: {
  entityType: string;
  entityId: string;
  path: string;
  activities: ActivityItem[];
}) {
  const open = activities
    .filter((a) => a.kind === "TODO" && !a.done)
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const timeline = activities.filter((a) => !(a.kind === "TODO" && !a.done)); // logs + afgeronde taken (nieuwste eerst)
  const today = new Date().toISOString().slice(0, 10);

  const hidden = (
    <>
      <input type="hidden" name="path" value={path} />
    </>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5 text-brand-600" /> Activiteiten &amp; notities
        </CardTitle>
        <span className="text-xs text-slate-400">{activities.length}</span>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Composer — key op aantal zodat 't veld leegt na opslaan */}
        <form key={activities.length} action={addActivity} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          {hidden}
          <Textarea name="body" rows={2} placeholder="Wat is er gebeurd of besproken? Of plan een taak…" required className="bg-white" />
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <Select name="type" defaultValue="NOTE">
                {CRM_NOTE_MANUAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-44">
              <Input name="dueAt" type="date" aria-label="Plan datum (maakt een taak)" />
            </div>
            <span className="mb-2 text-xs text-slate-400">Datum = geplande taak</span>
            <div className="ml-auto mb-0">
              <SubmitButton size="sm" pendingLabel="Opslaan…">
                Vastleggen
              </SubmitButton>
            </div>
          </div>
        </form>

        {/* Open taken */}
        {open.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gepland</p>
            {open.map((a) => {
              const overdue = a.dueAt ? a.dueAt.slice(0, 10) < today : false;
              return (
                <div key={a.id} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
                  <form action={completeActivity}>
                    <input type="hidden" name="id" value={a.id} />
                    {hidden}
                    <button type="submit" title="Afronden" aria-label="Taak afronden" className="mt-0.5 text-slate-400 transition-colors hover:text-emerald-600">
                      <Circle className="h-4 w-4" />
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={colorFor(CRM_NOTE_TYPES, a.type)}>{labelFor(CRM_NOTE_TYPES, a.type)}</Badge>
                      <span className={cn("inline-flex items-center gap-1 text-xs", overdue ? "font-semibold text-rose-600" : "text-slate-500")}>
                        <CalendarClock className="h-3.5 w-3.5" /> {formatDate(a.dueAt)}
                        {overdue ? " · te laat" : ""}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
                  </div>
                  <form action={deleteActivity}>
                    <input type="hidden" name="id" value={a.id} />
                    {hidden}
                    <button type="submit" title="Verwijderen" aria-label="Verwijderen" className="text-slate-300 transition-colors hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}

        {/* Tijdlijn */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tijdlijn</p>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400">Nog niets vastgelegd.</p>
          ) : (
            <ul className="space-y-3">
              {timeline.map((a) => (
                <li key={a.id} className="flex items-start gap-2.5">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.done ? "bg-emerald-400" : "bg-slate-300")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge color={colorFor(CRM_NOTE_TYPES, a.type)}>{labelFor(CRM_NOTE_TYPES, a.type)}</Badge>
                      {a.authorName && <span className="font-medium text-slate-600">{a.authorName}</span>}
                      <span>{formatDate(a.createdAt)}</span>
                      {a.done && <span className="text-emerald-600">✓ afgerond</span>}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {a.kind === "TODO" && a.done && (
                      <form action={reopenActivity}>
                        <input type="hidden" name="id" value={a.id} />
                        {hidden}
                        <button type="submit" title="Heropenen" aria-label="Heropenen" className="text-slate-300 transition-colors hover:text-amber-600">
                          <Circle className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                    <form action={deleteActivity}>
                      <input type="hidden" name="id" value={a.id} />
                      {hidden}
                      <button type="submit" title="Verwijderen" aria-label="Verwijderen" className="text-slate-300 transition-colors hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
