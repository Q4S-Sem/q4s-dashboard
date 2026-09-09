import Link from "next/link";
import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { cn, formatDate } from "@/lib/utils";
import { startOfDay } from "@/lib/agenda";
import type { Person } from "./AssigneeSelect";
import { TaskListView, type TaskRowData } from "./TaskListView";
import { CreateTaskModal } from "./CreateTaskModal";
import type { Task, Employee } from "@prisma/client";

export const metadata = { title: "Takenlijst" };
export const dynamic = "force-dynamic";

type TaskWithAssignee = Task & { assignee: Employee | null };

function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}

/** Relatief datumlabel + kleurtoon, zoals de referentie (Vandaag/Morgen/Voltooid). */
function dueMeta(task: TaskWithAssignee): { label: string; tone: TaskRowData["dueTone"] } {
  if (task.done) {
    return {
      label: task.doneAt ? `Voltooid (${formatDate(task.doneAt)})` : "Voltooid",
      tone: "done",
    };
  }
  if (!task.dueDate) return { label: "Geen datum", tone: "none" };

  const today = startOfDay(new Date());
  const due = startOfDay(new Date(task.dueDate));
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return { label: formatDate(task.dueDate), tone: "overdue" };
  if (diffDays === 0) return { label: "Vandaag", tone: "today" };
  if (diffDays === 1) return { label: "Morgen", tone: "tomorrow" };
  return { label: formatDate(task.dueDate), tone: "normal" };
}

export default async function TakenPage({
  searchParams,
}: {
  searchParams: Promise<{ wie?: string }>;
}) {
  const { wie } = await searchParams;

  const employees = await db.employee.findMany({
    where: { active: true },
    orderBy: [{ firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
  const people: Person[] = employees.map((e) => ({ id: e.id, name: fullName(e) }));

  // Filter op toegewezen persoon: leeg = iedereen, "none" = niet toegewezen.
  const assigneeWhere =
    wie === "none" ? { assigneeId: null } : wie ? { assigneeId: wie } : {};

  const [open, completed] = await Promise.all([
    db.task.findMany({
      where: { done: false, ...assigneeWhere },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: { assignee: true },
    }),
    db.task.findMany({
      where: { done: true, ...assigneeWhere },
      orderBy: { doneAt: "desc" },
      take: 50,
      include: { assignee: true },
    }),
  ]);

  // Openstaande taken eerst, daarna afgerond — één tabel zoals de referentie.
  const rows: TaskRowData[] = [...open, ...completed].map((t) => {
    const { label, tone } = dueMeta(t);
    return {
      id: t.id,
      title: t.title,
      done: t.done,
      dueLabel: label,
      dueTone: tone,
      assigneeId: t.assigneeId,
      assigneeName: t.assignee ? fullName(t.assignee) : null,
    };
  });

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active
        ? "border-ink-900 bg-ink-900 text-white"
        : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Takenlijst"
        description="Wijs to-do's toe aan collega's — wie doet wat. Taken met een deadline verschijnen ook in de agenda."
        actions={<CreateTaskModal people={people} />}
      />

      {/* Filter op collega */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-400">
          <Users className="h-3.5 w-3.5" /> Filter:
        </span>
        <Link href="/agenda/taken" className={chip(!wie)}>
          Iedereen
        </Link>
        {people.map((p) => (
          <Link key={p.id} href={`/agenda/taken?wie=${p.id}`} className={chip(wie === p.id)}>
            {p.name}
          </Link>
        ))}
        <Link href="/agenda/taken?wie=none" className={chip(wie === "none")}>
          Niet toegewezen
        </Link>
      </div>

      <TaskListView rows={rows} people={people} />
    </div>
  );
}
