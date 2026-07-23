"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { reassignTask } from "./actions";

export type Person = { id: string; name: string };

/** Inline "toewijzen aan"-dropdown per taak — schrijft direct weg bij wijzigen. */
export function AssigneeSelect({
  taskId,
  value,
  people,
}: {
  taskId: string;
  value: string | null;
  people: Person[];
}) {
  const [pending, start] = useTransition();

  return (
    <span className="inline-flex items-center gap-1">
      {pending && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
      <select
        defaultValue={value ?? ""}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value || null;
          start(() => reassignTask(taskId, v));
        }}
        aria-label="Toewijzen aan"
        className="max-w-[8.5rem] rounded-md border border-slate-200 bg-white py-1 pl-2 pr-1 text-xs text-slate-600 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-50"
      >
        <option value="">Niemand</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </span>
  );
}
