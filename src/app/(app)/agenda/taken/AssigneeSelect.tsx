"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/field";
import { reassignTask } from "./actions";

export type Person = { id: string; name: string };

/** Inline "toewijzen aan"-dropdown per taak — schrijft direct weg bij wijzigen.
 *  Gebruikt de gedeelde Select (zoekbaar bij veel collega's). */
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
      {pending && <Loader2 className="h-3 w-3 animate-spin text-ink-400" />}
      <Select
        aria-label="Toewijzen aan"
        defaultValue={value ?? ""}
        disabled={pending}
        onValueChange={(v) => start(() => reassignTask(taskId, v || null))}
        className="w-44"
      >
        <option value="">Niemand</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </span>
  );
}
