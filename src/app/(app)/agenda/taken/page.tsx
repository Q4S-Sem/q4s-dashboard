import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
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

export default async function TakenPage() {
  const employees = await db.employee.findMany({
    where: { active: true },
    orderBy: [{ firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
  const people: Person[] = employees.map((e) => ({ id: e.id, name: fullName(e) }));

  const [open, completed] = await Promise.all([
    db.task.findMany({
      where: { done: false },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: { assignee: true },
    }),
    db.task.findMany({
      where: { done: true },
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Takenlijst"
        description="Wijs to-do's toe aan collega's — wie doet wat. Taken met een deadline verschijnen ook in de agenda."
        actions={<CreateTaskModal people={people} />}
      />

      <TaskListView rows={rows} people={people} />
    </div>
  );
}
