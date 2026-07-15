"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { Client, Vacancy } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { TextAutocomplete } from "@/components/ui/text-autocomplete";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { DISCIPLINES } from "@/lib/domain";
import { disciplineLabelOf } from "@/lib/linkedin-template";

export function VacancyForm({
  action,
  vacancy,
  clients,
  submitLabel,
  cancelHref,
  aiReady,
  disciplineSuggestions = [],
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  vacancy?: Vacancy;
  clients: Pick<Client, "id" | "companyName">[];
  submitLabel: string;
  cancelHref: string;
  aiReady: boolean;
  /** Al eerder gebruikte disciplines (uit de database) — als extra suggesties. */
  disciplineSuggestions?: string[];
}) {
  // Vaste disciplines (labels) + eerder zelf toegevoegde, ontdubbeld.
  const disciplineOptions = Array.from(
    new Set([
      ...DISCIPLINES.map((d) => d.label),
      ...disciplineSuggestions.map((s) => disciplineLabelOf(s)).filter(Boolean),
    ]),
  );
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  // Fields the AI can fill in — controlled so the "Verbeter met AI" button can
  // populate them and the user can still tweak before saving.
  const [location, setLocation] = useState(vacancy?.location ?? "");
  const [employmentType, setEmploymentType] = useState(vacancy?.employmentType ?? "");
  const [salary, setSalary] = useState(vacancy?.salary ?? "");
  const [summary, setSummary] = useState(vacancy?.summary ?? "");
  const [responsibilities, setResponsibilities] = useState(vacancy?.responsibilities ?? "");
  const [requirements, setRequirements] = useState(vacancy?.requirements ?? "");
  const [niceToHave, setNiceToHave] = useState(vacancy?.niceToHave ?? "");
  const [improvedText, setImprovedText] = useState(vacancy?.improvedText ?? "");
  const [linkedinPost, setLinkedinPost] = useState(vacancy?.linkedinPost ?? "");

  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState(false);

  async function improveWithAI() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const rawText = String(fd.get("rawText") ?? "");
    if (!rawText.trim()) {
      setAiError("Plak eerst de binnengekomen vacaturetekst.");
      return;
    }
    setAiError(null);
    setAiDone(false);
    setAiBusy(true);
    try {
      const res = await fetch("/api/vacatures/improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rawText,
          title: String(fd.get("title") ?? ""),
          discipline: String(fd.get("discipline") ?? ""),
          companyName: String(fd.get("companyName") ?? ""),
          location,
          employmentType,
          salary,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "AI-verbetering mislukt.");
      setSummary(data.summary ?? "");
      setResponsibilities((data.responsibilities ?? []).join("\n"));
      setRequirements((data.requirements ?? []).join("\n"));
      setNiceToHave((data.niceToHave ?? []).join("\n"));
      setImprovedText(data.improvedText ?? "");
      setLinkedinPost(data.linkedinPost ?? "");
      if (!location && data.location) setLocation(data.location);
      if (!employmentType && data.employmentType) setEmploymentType(data.employmentType);
      if (!salary && data.salary) setSalary(data.salary);
      setAiDone(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI-verbetering mislukt.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <form action={formAction} ref={formRef}>
      {vacancy && <input type="hidden" name="id" value={vacancy.id} />}
      <input type="hidden" name="improvedText" value={improvedText} />
      <input type="hidden" name="linkedinPost" value={linkedinPost} />
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Field label="Titel" htmlFor="title" required error={e.title}>
            <Input
              id="title"
              name="title"
              defaultValue={vacancy?.title ?? ""}
              placeholder="Bijv. Senior Lasinspecteur (NDO)"
              required
            />
          </Field>

          <Field
            label="Discipline"
            error={e.discipline}
            hint="Kies een discipline of typ zelf een nieuwe — die wordt automatisch bewaard en verschijnt de volgende keer in de lijst."
          >
            <TextAutocomplete
              name="discipline"
              defaultValue={disciplineLabelOf(vacancy?.discipline ?? "")}
              suggestions={disciplineOptions}
              placeholder="Kies of typ een discipline…"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Plaats (locatie)" htmlFor="location" error={e.location}>
              <Input
                id="location"
                name="location"
                value={location}
                onChange={(ev) => setLocation(ev.target.value)}
                placeholder="Bijv. Rotterdam"
              />
            </Field>
            <Field label="Contractvorm" htmlFor="employmentType" error={e.employmentType}>
              <Input
                id="employmentType"
                name="employmentType"
                value={employmentType}
                onChange={(ev) => setEmploymentType(ev.target.value)}
                placeholder="Bijv. Fulltime / Freelance"
              />
            </Field>
            <Field label="Vergoeding / salaris" htmlFor="salary" error={e.salary}>
              <Input
                id="salary"
                name="salary"
                value={salary}
                onChange={(ev) => setSalary(ev.target.value)}
                placeholder="Bijv. Marktconform dagtarief"
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Klant" htmlFor="clientId" error={e.clientId}>
              <Select id="clientId" name="clientId" defaultValue={vacancy?.clientId ?? ""}>
                <option value="">— geen —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Bedrijfsnaam"
              htmlFor="companyName"
              hint="Gebruik dit als de klant niet in de lijst staat"
              error={e.companyName}
            >
              <Input
                id="companyName"
                name="companyName"
                defaultValue={vacancy?.companyName ?? ""}
              />
            </Field>
          </div>

          <Field
            label="Binnengekomen vacaturetekst"
            htmlFor="rawText"
            required
            error={e.rawText}
          >
            <Textarea
              id="rawText"
              name="rawText"
              className="min-h-48"
              defaultValue={vacancy?.rawText ?? ""}
              placeholder="Plak hier de ruwe, binnengekomen vacaturetekst…"
              required
            />
          </Field>

          {/* AI verbeteren */}
          <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={improveWithAI}
                disabled={aiBusy || !aiReady}
              >
                <Sparkles className="h-4 w-4" />
                {aiBusy ? "AI is bezig…" : "Verbeter met AI"}
              </Button>
              <p className="flex-1 text-sm text-slate-600">
                Laat AI de tekst uitschrijven naar Over de functie, Werkzaamheden,
                Functie-eisen en Pré. Je kunt alles daarna nog aanpassen.
              </p>
            </div>
            {!aiReady && (
              <p className="mt-2 text-xs text-amber-700">
                Stel ANTHROPIC_API_KEY in je .env in om AI te gebruiken.
              </p>
            )}
            {aiError && <p className="mt-2 text-sm text-red-700">{aiError}</p>}
            {aiDone && (
              <p className="mt-2 text-sm text-emerald-700">
                AI heeft de onderdelen ingevuld — controleer en pas eventueel aan.
              </p>
            )}
          </div>

          {/* Website-inhoud */}
          <div className="space-y-5 border-t border-slate-100 pt-5">
            <p className="text-sm font-semibold text-slate-900">
              Website-inhoud
            </p>

            <Field label="Over de functie" htmlFor="summary" error={e.summary}>
              <Textarea
                id="summary"
                name="summary"
                className="min-h-24"
                value={summary}
                onChange={(ev) => setSummary(ev.target.value)}
                placeholder="Korte, wervende intro over de functie…"
              />
            </Field>

            <Field
              label="Werkzaamheden"
              htmlFor="responsibilities"
              hint="Eén taak per regel."
              error={e.responsibilities}
            >
              <Textarea
                id="responsibilities"
                name="responsibilities"
                className="min-h-32"
                value={responsibilities}
                onChange={(ev) => setResponsibilities(ev.target.value)}
                placeholder={"Inventariseren van…\nVastleggen van…\nControleren van…"}
              />
            </Field>

            <Field
              label="Functie-eisen"
              htmlFor="requirements"
              hint="Eén eis per regel."
              error={e.requirements}
            >
              <Textarea
                id="requirements"
                name="requirements"
                className="min-h-32"
                value={requirements}
                onChange={(ev) => setRequirements(ev.target.value)}
                placeholder={"Ervaring als…\nBekend met…\nKennis van…"}
              />
            </Field>

            <Field
              label="Pré"
              htmlFor="niceToHave"
              hint="Eén pluspunt per regel (optioneel)."
              error={e.niceToHave}
            >
              <Textarea
                id="niceToHave"
                name="niceToHave"
                className="min-h-24"
                value={niceToHave}
                onChange={(ev) => setNiceToHave(ev.target.value)}
                placeholder={"Certificering…\nErvaring op terminals…"}
              />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Annuleren
          </Link>
          <SubmitButton>{submitLabel}</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
