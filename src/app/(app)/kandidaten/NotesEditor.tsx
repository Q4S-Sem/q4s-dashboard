"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { setCandidateNotes } from "./actions";

/**
 * Snelle notitie-editor per kandidaat. Altijd zichtbaar op de detailpagina, zodat
 * je zonder het hele bewerk-formulier snel iets kunt vastleggen. De opslaan-knop
 * licht alleen op zodra er iets is gewijzigd. Na opslaan revalideert de server de
 * pagina en komt de nieuwe `notes` binnen; we resetten dan de basiswaarde tijdens
 * render (React's aanbevolen patroon), zodat de "niet opgeslagen"-melding verdwijnt.
 */
export function NotesEditor({ id, notes }: { id: string; notes: string | null }) {
  const server = notes ?? "";
  const [baseline, setBaseline] = useState(server);
  const [value, setValue] = useState(server);

  // De opgeslagen serverwaarde is veranderd → editor terugzetten op die waarde.
  if (server !== baseline) {
    setBaseline(server);
    setValue(server);
  }

  const dirty = value !== server;

  return (
    <form action={setCandidateNotes} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Textarea
        name="notes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        placeholder="Bijv. gesproken op 12-06, wil graag opdrachten in de regio Rotterdam, rijbewijs B, VCA geldig t/m 2027…"
      />
      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <span className="text-xs text-slate-400">Niet-opgeslagen wijzigingen</span>
        )}
        <SubmitButton disabled={!dirty} pendingLabel="Opslaan…">
          Notitie opslaan
        </SubmitButton>
      </div>
    </form>
  );
}
