import Link from "next/link";
import {
  ListTodo,
  Circle,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { cn, formatDate } from "@/lib/utils";
import { startOfDay } from "@/lib/agenda";
import { TASK_PRIORITIES } from "@/lib/domain";
import { createTask, toggleTask, deleteTask } from "./actions";
import { AssigneeSelect, type Person } from "./AssigneeSelect";
import type { Task, Employee } from "@prisma/client";

export const metadata = { title: "Takenlijst" };
export const dynamic = "force-dynamic";

type TaskWithAssignee = Task & { assignee: Employee | null };

function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}

function TaskRow({
  task,
  done,
  people,
}: {
  task: TaskWithAssignee;
  done: boolean;
  people: Person[];
}) {
  const today = startOfDay(new Date());
  const overdue = !done && task.dueDate && new Date(task.dueDate) < today;

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <form action={toggleTask} className="flex">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          aria-label={done ? "Heropenen" : "Afronden"}
          className={cn(
            "flex transition-colors",
            done
              ? "text-emerald-600 hover:text-ink-400"
              : "text-ink-300 hover:text-emerald-600",
          )}
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            done ? "text-ink-400 line-through" : "text-ink-800",
          )}
        >
          {task.title}
        </p>
        {task.notes && <p className="truncate text-xs text-ink-500">{task.notes}</p>}
      </div>

      {done ? (
        task.assignee && (
          <span className="shrink-0 text-xs text-ink-400">{fullName(task.assignee)}</span>
        )
      ) : (
        <AssigneeSelect taskId={task.id} value={task.assigneeId} people={people} />
      )}

      {!done && <StatusBadge options={TASK_PRIORITIES} value={task.priority} />}

      {task.dueDate && (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            overdue ? "font-medium text-red-600" : "text-ink-400",
          )}
        >
          {formatDate(task.dueDate)}
        </span>
      )}

      <ConfirmSubmit
        action={deleteTask}
        id={task.id}
        message="Taak verwijderen?"
        variant="ghost"
        size="icon"
      >
        <Trash2 className="h-4 w-4" />
      </ConfirmSubmit>
    </li>
  );
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
      take: 30,
      include: { assignee: true },
    }),
  ]);

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active
        ? "border-brand-300 bg-brand-50 text-brand-700"
        : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Takenlijst"
        description="Wijs to-do's toe aan collega's — wie doet wat. Taken met een deadline verschijnen ook in de agenda."
      />

      {/* Quick add */}
      <Card>
        <form action={createTask} className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap">
          <Input
            name="title"
            placeholder="Nieuwe taak — bijv. Offerte Tata Steel opvolgen"
            required
            className="min-w-[12rem] flex-1"
          />
          <Select name="assigneeId" defaultValue="" className="sm:w-48" aria-label="Toewijzen aan">
            <option value="">Niemand toegewezen</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select name="priority" defaultValue="MEDIUM" className="sm:w-36" aria-label="Prioriteit">
            {TASK_PRIORITIES.map((o) => (
              <option key={o.value} value={o.value} data-color={o.color}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input name="dueDate" type="date" className="sm:w-40" aria-label="Deadline" />
          <SubmitButton>Toevoegen</SubmitButton>
        </form>
      </Card>

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

      {/* Open tasks */}
      <Card>
        <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3">
          <ListTodo className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-ink-900">Te doen</h2>
          <span className="ml-auto text-xs text-ink-400">{open.length}</span>
        </div>
        {open.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="h-6 w-6" />}
            title="Alles afgerond 🎉"
            description="Geen open taken voor deze selectie. Voeg er hierboven een toe."
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} done={false} people={people} />
            ))}
          </ul>
        )}
      </Card>

      {/* Completed */}
      {completed.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3">
            <RotateCcw className="h-4 w-4 text-ink-400" />
            <h2 className="text-sm font-semibold text-ink-900">Afgerond</h2>
            <span className="ml-auto text-xs text-ink-400">{completed.length}</span>
          </div>
          <ul className="divide-y divide-ink-100">
            {completed.map((t) => (
              <TaskRow key={t.id} task={t} done people={people} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
