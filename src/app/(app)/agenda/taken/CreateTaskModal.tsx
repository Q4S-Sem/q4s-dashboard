"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { createTask } from "./actions";
import type { Person } from "./AssigneeSelect";

// Kwartier-tijden 00:00–23:45, zoals de referentie.
const TIMES = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

/** "Aanmaken +"-knop die de modal opent — layout uit de referentie. */
export function CreateTaskModal({ people }: { people: Person[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Aanmaken
      </Button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Nieuwe taak"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Nieuwe taak</h2>
                  <p className="mt-0.5 text-sm text-ink-500">Voeg een taak toe aan je werkruimte.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Sluiten"
                  className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form action={createTask} className="mt-5 space-y-4">
                <Field label="Taakomschrijving" htmlFor="task-title">
                  {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                  <Input id="task-title" name="title" placeholder="Bijv. Wekelijks rapport nakijken" autoFocus required />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Vervaldatum" htmlFor="task-date">
                    <Input id="task-date" name="dueDate" type="date" />
                  </Field>
                  <Field label="Vervaltijd" htmlFor="task-time">
                    <Select name="dueTime" defaultValue="12:00" aria-label="Vervaltijd">
                      {TIMES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field label="Toegewezen aan" htmlFor="task-assignee">
                  <Select name="assigneeId" defaultValue="" aria-label="Toegewezen aan">
                    <option value="">Niet toegewezen</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="flex items-center justify-end gap-2 border-t border-ink-100 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Annuleren
                  </Button>
                  <SubmitButton pendingLabel="Aanmaken…">Aanmaken</SubmitButton>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
