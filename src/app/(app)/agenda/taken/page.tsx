import {
  ListTodo,
  Circle,
  CheckCircle2,
  RotateCcw,
  Trash2,
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
import type { Task } from "@prisma/client";

export const metadata = { title: "Takenlijst" };

function TaskRow({ task, done }: { task: Task; done: boolean }) {
  const today = startOfDay(new Date());
  const overdue = !done && task.dueDate && new Date(task.dueDate) < today;

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <form action={toggleTask} className="flex">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          aria-label={done ? "Heropenen" : "Afronden"}
          className={cn(
            "flex transition-colors",
            done
              ? "text-emerald-600 hover:text-slate-400"
              : "text-slate-300 hover:text-emerald-600",
          )}
        >
          {done ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            done ? "text-slate-400 line-through" : "text-slate-800",
          )}
        >
          {task.title}
        </p>
        {task.notes && (
          <p className="truncate text-xs text-slate-500">{task.notes}</p>
        )}
      </div>

      {!done && <StatusBadge options={TASK_PRIORITIES} value={task.priority} />}

      {task.dueDate && (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            overdue ? "font-medium text-red-600" : "text-slate-400",
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

export default async function TakenPage() {
  const [open, completed] = await Promise.all([
    db.task.findMany({
      where: { done: false },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    db.task.findMany({
      where: { done: true },
      orderBy: { doneAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Takenlijst"
        description="Snelle to-do's voor jou en het team. Afgevinkte taken verdwijnen onderaan."
      />

      {/* Quick add */}
      <Card>
        <form action={createTask} className="flex flex-col gap-3 p-4 sm:flex-row">
          <Input
            name="title"
            placeholder="Nieuwe taak — bijv. Offerte Tata Steel opvolgen"
            required
            className="flex-1"
          />
          <Select name="priority" defaultValue="MEDIUM" className="sm:w-44" aria-label="Prioriteit">
            {TASK_PRIORITIES.map((o) => (
              <option key={o.value} value={o.value} data-color={o.color}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            name="dueDate"
            type="date"
            className="sm:w-44"
            aria-label="Deadline"
          />
          <SubmitButton>Toevoegen</SubmitButton>
        </form>
      </Card>

      {/* Open tasks */}
      <Card>
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <ListTodo className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">Te doen</h2>
          <span className="ml-auto text-xs text-slate-400">{open.length}</span>
        </div>
        {open.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="h-6 w-6" />}
            title="Alles afgerond 🎉"
            description="Geen open taken. Voeg er hierboven een toe."
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} done={false} />
            ))}
          </ul>
        )}
      </Card>

      {/* Completed */}
      {completed.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <RotateCcw className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Afgerond</h2>
            <span className="ml-auto text-xs text-slate-400">{completed.length}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {completed.map((t) => (
              <TaskRow key={t.id} task={t} done />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
