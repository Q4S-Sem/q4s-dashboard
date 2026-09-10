"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { DISCIPLINES, EMPLOYMENT_TYPES } from "@/lib/domain";
import { quickCreateVacancy } from "./workspace-actions";

/**
 * "Nieuwe vacature" vanuit de bedrijfswerkruimte. Het bedrijf is al bekend
 * (clientId), dus alleen titel/discipline/locatie/type/eisen. De server maakt de
 * vacature aan als openstaand + zoekbaar zodat je er meteen op kunt matchen.
 */
export function NewVacancyButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
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
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nieuwe vacature
      </Button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="animate-overlay-in fixed inset-0 bg-ink-900/50 backdrop-blur-sm"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="animate-dialog-in relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-[0_24px_60px_-15px_rgb(0_0_0/0.35)]"
            >
              <div className="flex items-start justify-between gap-3 px-6 pt-6">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">Nieuwe vacature</h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Plaats snel een vacature bij dit bedrijf. Daarna kun je meteen matchen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Sluiten"
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form action={quickCreateVacancy} className="space-y-4 px-6 py-5">
                <input type="hidden" name="clientId" value={clientId} />

                <Field label="Functietitel" htmlFor="title" required>
                  <Input id="title" name="title" required placeholder="Bijv. NDT Inspecteur (Level II)" autoFocus />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Discipline" htmlFor="discipline">
                    <select
                      id="discipline"
                      name="discipline"
                      defaultValue=""
                      className="block w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                    >
                      <option value="">— kies —</option>
                      {DISCIPLINES.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Dienstverband" htmlFor="employmentType">
                    <select
                      id="employmentType"
                      name="employmentType"
                      defaultValue=""
                      className="block w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                    >
                      <option value="">— kies —</option>
                      {EMPLOYMENT_TYPES.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Locatie" htmlFor="location">
                  <Input id="location" name="location" placeholder="Bijv. Barendrecht" />
                </Field>

                <Field
                  label="Functie-eisen (optioneel)"
                  htmlFor="requirements"
                  hint="Eén eis per regel — dit maakt de match scherper."
                >
                  <textarea
                    id="requirements"
                    name="requirements"
                    rows={4}
                    placeholder={"Bijv.\nMinimaal 3 jaar ervaring in NDT\nLevel II certificaat (UT/RT/MT/PT)\nWoonachtig in regio Rotterdam"}
                    className="block w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  />
                </Field>

                <div className="flex justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={buttonVariants({ variant: "outline", size: "md" })}
                  >
                    Annuleren
                  </button>
                  <SubmitButton pendingLabel="Plaatsen…">
                    <Plus className="h-4 w-4" /> Vacature plaatsen
                  </SubmitButton>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
