"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { CopyButton } from "../../../vacatures/CopyButton";
import { maakMspSleutel } from "../../intake-actions";

/** Maak (of vervang) de eigen API-sleutel van een MSP; toont hem één keer. */
export function SleutelMaken({ id, heeftSleutel }: { id: string; heeftSleutel: boolean }) {
  const [state, action] = useActionState(maakMspSleutel, null);
  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <SubmitButton size="sm" variant="outline" pendingLabel="Maken…">
          <KeyRound className="h-4 w-4" /> {heeftSleutel ? "Nieuwe sleutel (oude vervalt)" : "API-sleutel maken"}
        </SubmitButton>
        <span className="text-xs text-ink-500">
          {heeftSleutel ? "Er is een sleutel actief." : "Nog geen sleutel — het platform kan nog niet aanleveren."}
        </span>
      </form>
      {state?.sleutel && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="mb-2 font-medium">Kopieer de sleutel nu en geef hem aan het platform — je ziet hem maar één keer.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5">{state.sleutel}</code>
            <CopyButton text={state.sleutel} label="Kopieer" />
          </div>
        </div>
      )}
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
    </div>
  );
}
