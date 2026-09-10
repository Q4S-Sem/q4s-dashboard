"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { GitBranchPlus, X, Loader2 } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { TextCombobox } from "@/components/ui/text-combobox";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";

export type PipelineClient = { id: string; name: string };
export type PipelineVacancy = { id: string; title: string; company: string | null };

/**
 * "In pipeline zetten" — zet een kandidaat uit de talentpool in de deal-pipeline.
 * Kies een eigen bedrijf (typebaar) en optioneel een openstaande vacature; de
 * server maakt de deal aan in de eerste fase en koppelt de kandidaat. De vacature-
 * lijst filtert mee op het gekozen bedrijf zodat je alleen relevante vacatures ziet.
 */
export function PipelineButton({
  action,
  candidateId,
  candidateName,
  clients,
  vacancies,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  candidateId: string;
  candidateName: string;
  clients: PipelineClient[];
  vacancies: PipelineVacancy[];
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [company, setCompany] = useState("");
  const [vacancyId, setVacancyId] = useState("");
  const [state, formAction, pending] = useActionState(action, emptyFormState);

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

  // Koppel de gekozen client-id op naam (voor een nette relatie in de deal).
  const clientId = useMemo(
    () => clients.find((c) => c.name.toLowerCase() === company.trim().toLowerCase())?.id ?? "",
    [clients, company],
  );

  // Toon alleen vacatures van het gekozen bedrijf (of alle als er nog niks staat).
  const relevantVacancies = useMemo(() => {
    const q = company.trim().toLowerCase();
    if (!q) return vacancies;
    return vacancies.filter((v) => (v.company ?? "").toLowerCase() === q);
  }, [vacancies, company]);

  const clientNames = useMemo(() => clients.map((c) => c.name), [clients]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${candidateName} in de pipeline zetten`}
        aria-label={`${candidateName} in de pipeline zetten`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
      >
        <GitBranchPlus className="h-4 w-4" />
      </button>

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
                  <h2 className="text-base font-semibold text-ink-900">In de pipeline zetten</h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Koppel <span className="font-medium text-ink-700">{candidateName}</span> aan een
                    eigen klant en (optioneel) een openstaande vacature.
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

              <form action={formAction} className="space-y-4 px-6 py-5">
                <input type="hidden" name="candidateId" value={candidateId} />
                <input type="hidden" name="clientId" value={clientId} />

                {state.error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
                )}

                <Field
                  label="Bedrijf"
                  htmlFor="company"
                  required
                  hint="Kies een eigen klant of typ een nieuwe bedrijfsnaam."
                  error={state.fieldErrors?.company}
                >
                  <TextCombobox
                    id="company"
                    name="company"
                    options={clientNames}
                    required
                    placeholder="Bijv. Damen Shipyards"
                    onChange={(v) => {
                      setCompany(v);
                      setVacancyId("");
                    }}
                  />
                </Field>

                <Field
                  label="Openstaande vacature (optioneel)"
                  htmlFor="vacancyId"
                  hint={
                    relevantVacancies.length === 0
                      ? "Geen openstaande vacatures voor dit bedrijf — je kunt dit later koppelen."
                      : "Kies de vacature waarop je deze kandidaat wilt plaatsen."
                  }
                >
                  <select
                    id="vacancyId"
                    name="vacancyId"
                    value={vacancyId}
                    onChange={(e) => setVacancyId(e.target.value)}
                    className="block w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  >
                    <option value="">— geen / later —</option>
                    {relevantVacancies.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                        {v.company ? ` — ${v.company}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Verwachte dealwaarde (€, optioneel)"
                  htmlFor="value"
                  hint="Bijv. je verwachte marge over de plaatsing."
                >
                  <Input id="value" name="value" type="number" min={0} step={100} placeholder="0" />
                </Field>

                <div className="flex justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={buttonVariants({ variant: "outline", size: "md" })}
                  >
                    Annuleren
                  </button>
                  <SubmitButton pendingLabel="Aanmaken…">
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <GitBranchPlus className="h-4 w-4" />
                    )}
                    In pipeline zetten
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
