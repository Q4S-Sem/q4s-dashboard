import Link from "next/link";
import { Circle, Trash2, CalendarClock, Zap, ListTodo, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { CRM_NOTE_TYPES, labelFor, colorFor } from "@/lib/domain";
import { getOpenTasks, type OpenTask } from "@/lib/activities";
import { completeActivity, deleteActivity } from "@/components/activity/actions";

export const metadata = { title: "Te doen" };
export const dynamic = "force-dynamic";

const PATH = "/dashboard/te-doen";

const BUCKETS = [
  { label: "Te laat", accent: "border-rose-200 bg-rose-50/50", dot: "bg-rose-500" },
  { label: "Vandaag", accent: "border-amber-200 bg-amber-50/50", dot: "bg-amber-500" },
  { label: "Deze week", accent: "border-blue-200 bg-blue-50/40", dot: "bg-blue-500" },
  { label: "Later", accent: "border-ink-200 bg-white", dot: "bg-ink-300" },
  { label: "Zonder datum", accent: "border-ink-200 bg-white", dot: "bg-ink-300" },
];

export default async function TeDoenPage() {
  const tasks = await getOpenTasks();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in7 = new Date(startOfToday);
  in7.setDate(in7.getDate() + 7);

  const bucketOf = (dueAt: string | null): number => {
    if (!dueAt) return 4;
    const d = new Date(dueAt);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day < startOfToday) return 0;
    if (day.getTime() === startOfToday.getTime()) return 1;
    if (day <= in7) return 2;
    return 3;
  };

  const groups: OpenTask[][] = [[], [], [], [], []];
  for (const t of tasks) groups[bucketOf(t.dueAt)].push(t);

  const overdue = groups[0].length;
  const todayCount = groups[1].length;

  const TaskRow = ({ t }: { t: OpenTask }) => (
    <div className="flex items-start gap-2.5 px-4 py-3">
      <form action={completeActivity}>
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="path" value={PATH} />
        <button type="submit" title="Afronden" aria-label="Taak afronden" className="mt-0.5 text-ink-300 transition-colors hover:text-emerald-600">
          <Circle className="h-5 w-5" />
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-800">{t.body}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <Badge color={colorFor(CRM_NOTE_TYPES, t.type)}>{labelFor(CRM_NOTE_TYPES, t.type)}</Badge>
          {t.ruleGenerated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
              <Zap className="h-3 w-3" /> automatisch
            </span>
          )}
          {t.dueAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" /> {formatDate(t.dueAt)}
            </span>
          )}
          <Link href={t.href} className="inline-flex items-center gap-1 font-medium text-ink-600 hover:text-brand-700">
            {t.entityLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <form action={deleteActivity}>
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="path" value={PATH} />
        <button type="submit" title="Verwijderen" aria-label="Verwijderen" className="text-ink-300 transition-colors hover:text-rose-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Te doen"
        description="Alle openstaande taken en herinneringen uit de hele app — vastgelegd in de chatter of automatisch aangemaakt door je regels. Vink af zodra het klaar is."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open taken" value={tasks.length} icon={<ListTodo className="h-5 w-5" />} accent="brand" />
        <StatCard label="Te laat" value={overdue} icon={<CalendarClock className="h-5 w-5" />} accent={overdue ? "red" : "slate"} />
        <StatCard label="Vandaag" value={todayCount} icon={<Circle className="h-5 w-5" />} accent={todayCount ? "amber" : "slate"} />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-6 w-6" />}
          title="Niets te doen"
          description="Er staan geen open taken. Leg iets vast in de chatter van een record, of laat je automatische regels lopen."
        />
      ) : (
        <div className="space-y-5">
          {BUCKETS.map((b, i) =>
            groups[i].length === 0 ? null : (
              <div key={b.label}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${b.dot}`} />
                  <h2 className="text-sm font-semibold text-ink-700">{b.label}</h2>
                  <span className="text-xs text-ink-400">{groups[i].length}</span>
                </div>
                <Card className={b.accent}>
                  <CardContent className="p-0">
                    <div className="divide-y divide-ink-100">
                      {groups[i].map((t) => (
                        <TaskRow key={t.id} t={t} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
