import Link from "next/link";
import { BackLink } from "@/components/back-link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  ListTodo,
  CircleCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, cn } from "@/lib/utils";
import { TASK_PRIORITIES } from "@/lib/domain";
import {
  currentRecruiterId,
  getCrmSettings,
  getFollowUpItems,
  startOfToday,
  endOfToday,
  type FollowUpItem,
} from "@/lib/crm";
import { completeFollowUp, completeTask } from "./actions";

export const metadata = { title: "Opvolging" };
export const dynamic = "force-dynamic";

function FollowUpRow({ item, tone }: { item: FollowUpItem; tone: "red" | "amber" | "slate" }) {
  const toneMap = {
    red: "text-red-600",
    amber: "text-amber-600",
    slate: "text-ink-400",
  };
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <form action={completeFollowUp}>
        <input type="hidden" name="source" value={item.source} />
        <input type="hidden" name="rawId" value={item.rawId} />
        <button
          type="submit"
          title="Afronden"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-300 hover:bg-emerald-50 hover:text-emerald-600"
        >
          <CheckCircle2 className="h-5 w-5" />
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <Link href={item.href} className="block truncate font-medium text-ink-900 hover:text-brand-700">
          {item.title}
        </Link>
        {item.subtitle && <p className="truncate text-xs text-ink-500">{item.subtitle}</p>}
      </div>
      {item.ownerName && <span className="hidden text-xs text-ink-400 sm:block">{item.ownerName}</span>}
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", toneMap[tone])}>
        <CalendarClock className="h-3.5 w-3.5" />
        {formatDate(item.due)}
      </span>
    </li>
  );
}

export default async function OpvolgingPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const sp = await searchParams;
  const recruiterId = await currentRecruiterId();
  const settings = await getCrmSettings(recruiterId);
  const scope: "mine" | "all" =
    sp.scope === "all" || sp.scope === "mine" ? sp.scope : settings.defaultScope;

  const [items, tasks] = await Promise.all([
    getFollowUpItems({ recruiterId, scope }),
    db.task.findMany({
      where: { done: false },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const startToday = startOfToday().getTime();
  const endToday = endOfToday().getTime();
  const overdue = items.filter((i) => i.due.getTime() < startToday);
  const today = items.filter((i) => i.due.getTime() >= startToday && i.due.getTime() <= endToday);
  const upcoming = items.filter((i) => i.due.getTime() > endToday);

  const scopeTab = (value: "mine" | "all", label: string) => (
    <Link
      href={`/crm/opvolging?scope=${value}`}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        scope === value ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
      )}
    >
      {label}
    </Link>
  );

  const nothing = items.length === 0 && tasks.length === 0;

  return (
    <div className="space-y-6">
      <BackLink href="/crm">
        Terug naar CRM
      </BackLink>

      <PageHeader
        title="Opvolging"
        description="Alles wat een vervolgactie nodig heeft — geplande opvolgingen en openstaande taken. Niets valt tussen wal en schip."
      />

      <div className="inline-flex gap-1 rounded-lg border border-ink-200 bg-ink-50 p-1">
        {scopeTab("mine", "Mijn opvolging")}
        {scopeTab("all", "Team")}
      </div>

      {nothing ? (
        <EmptyState
          icon={<CircleCheck className="h-6 w-6" />}
          title="Alles opgevolgd"
          description="Geen openstaande opvolgingen of taken. Plan een opvolging op een deal of contact om hem hier te zien."
        />
      ) : (
        <>
          {overdue.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" /> Over tijd ({overdue.length})
                </CardTitle>
              </CardHeader>
              <ul className="divide-y divide-ink-100">
                {overdue.map((i) => (
                  <FollowUpRow key={i.id} item={i} tone="red" />
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-amber-500" /> Vandaag ({today.length})
              </CardTitle>
            </CardHeader>
            {today.length === 0 ? (
              <CardContent className="text-sm text-ink-500">Niets gepland voor vandaag.</CardContent>
            ) : (
              <ul className="divide-y divide-ink-100">
                {today.map((i) => (
                  <FollowUpRow key={i.id} item={i} tone="amber" />
                ))}
              </ul>
            )}
          </Card>

          {upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-ink-400" /> Binnenkort ({upcoming.length})
                </CardTitle>
              </CardHeader>
              <ul className="divide-y divide-ink-100">
                {upcoming.map((i) => (
                  <FollowUpRow key={i.id} item={i} tone="slate" />
                ))}
              </ul>
            </Card>
          )}

          {tasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-ink-400" /> Openstaande taken ({tasks.length})
                </CardTitle>
                <Link href="/agenda/taken" className="text-sm text-brand-700 hover:underline">
                  Alle taken
                </Link>
              </CardHeader>
              <ul className="divide-y divide-ink-100">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <form action={completeTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        title="Afvinken"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-300 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900">{t.title}</p>
                      {t.notes && <p className="truncate text-xs text-ink-500">{t.notes}</p>}
                    </div>
                    <StatusBadge options={TASK_PRIORITIES} value={t.priority} />
                    <span className="w-24 text-right text-xs text-ink-400 tabular-nums">
                      {t.dueDate ? formatDate(t.dueDate) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
