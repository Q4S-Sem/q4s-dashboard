"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { Deal } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { DISCIPLINES, DEAL_SOURCES, labelFor, colorFor, type BadgeColor } from "@/lib/domain";
import { Building2, Euro, Users, Star, Link2, StickyNote } from "lucide-react";

type IdName = { id: string; label: string };
type StageOption = { id: string; label: string; color: BadgeColor };

function toDateValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function DealForm({
  action,
  deal,
  submitLabel,
  cancelHref,
  currentRecruiterId,
  stages,
  recruiters,
  targets,
  clients,
  companies,
  vacancies,
  contacts,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  deal?: Deal;
  submitLabel: string;
  cancelHref: string;
  currentRecruiterId: string | null;
  stages: StageOption[];
  recruiters: IdName[];
  targets: IdName[];
  clients: IdName[];
  companies: string[];
  vacancies: IdName[];
  contacts: IdName[];
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  // Live velden voor het gekleurde voorbeeld rechts.
  const [title, setTitle] = useState(deal?.title ?? "");
  const [company, setCompany] = useState(deal?.company ?? "");
  const [discipline, setDiscipline] = useState(deal?.discipline ?? "");
  const [stageId, setStageId] = useState(deal?.stageId ?? stages[0]?.id ?? "");
  const [value, setValue] = useState(String(deal?.value ?? 0));
  const [positions, setPositions] = useState(String(deal?.positions ?? 1));
  const [fitScore, setFitScore] = useState(String(deal?.fitScore ?? 0));
  const [source, setSource] = useState(deal?.source ?? "MANUAL");

  const stage = useMemo(() => stages.find((s) => s.id === stageId), [stages, stageId]);
  const fit = Number(fitScore) || 0;
  const disciplineLabel = discipline ? labelFor(DISCIPLINES, discipline) : "";
  const disciplineColor: BadgeColor = discipline ? colorFor(DISCIPLINES, discipline) : "slate";
  const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  const knownCompany = companies.some((c) => c.toLowerCase() === company.trim().toLowerCase());

  return (
    <form action={formAction}>
      {deal && <input type="hidden" name="id" value={deal.id} />}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---- Linkerkant: het formulier ---- */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="space-y-6">
              {state.error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              )}

              {/* Sectie: de kans */}
              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-brand-700">
                  <Building2 className="h-4 w-4" /> De kans
                </h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Titel" htmlFor="title" required error={e.title}>
                    <Input
                      id="title"
                      name="title"
                      value={title}
                      onChange={(ev) => setTitle(ev.target.value)}
                      placeholder="Bijv. 2× NDT Inspector — TenneT"
                      required
                    />
                  </Field>
                  <Field
                    label="Bedrijf / opdrachtgever"
                    htmlFor="company"
                    required
                    error={e.company}
                    hint={
                      company.trim() && !knownCompany
                        ? "Nog niet in je klanten-/opdrachtgeversbestand — koppel hieronder of maak later een klant aan."
                        : "Kies uit je klanten of typ een nieuwe naam"
                    }
                  >
                    <Input
                      id="company"
                      name="company"
                      value={company}
                      onChange={(ev) => setCompany(ev.target.value)}
                      placeholder="Bijv. TenneT"
                      list="deal-companies"
                      required
                    />
                    <datalist id="deal-companies">
                      {companies.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-3">
                  <Field
                    label="Discipline"
                    htmlFor="discipline"
                    error={e.discipline}
                    hint="Kies er één of typ zelf — het kan van alles zijn"
                  >
                    <Input
                      id="discipline"
                      name="discipline"
                      value={discipline}
                      onChange={(ev) => setDiscipline(ev.target.value)}
                      placeholder="Bijv. NDT, Piping, Elektro…"
                      list="deal-disciplines"
                    />
                    <datalist id="deal-disciplines">
                      {DISCIPLINES.map((d) => (
                        <option key={d.value} value={d.label} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Fase" htmlFor="stageId" required error={e.stageId}>
                    <Select
                      id="stageId"
                      name="stageId"
                      defaultValue={stageId}
                      onValueChange={setStageId}
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id} data-color={s.color}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Eigenaar (recruiter)" htmlFor="ownerId" error={e.ownerId}>
                    <Select id="ownerId" name="ownerId" defaultValue={deal?.ownerId ?? currentRecruiterId ?? ""}>
                      <option value="">— geen —</option>
                      {recruiters.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </section>

              {/* Sectie: waarde & kwalificatie */}
              <section className="space-y-4 border-t border-ink-100 pt-5">
                <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-emerald-700">
                  <Euro className="h-4 w-4" /> Waarde &amp; kwalificatie
                </h2>
                <div className="grid gap-5 sm:grid-cols-4">
                  <Field label="Waarde (€)" htmlFor="value" hint="Verwachte marge/fee" error={e.value}>
                    <Input id="value" name="value" type="number" min={0} step="100" value={value} onChange={(ev) => setValue(ev.target.value)} />
                  </Field>
                  <Field label="Posities" htmlFor="positions" error={e.positions}>
                    <Input id="positions" name="positions" type="number" min={1} value={positions} onChange={(ev) => setPositions(ev.target.value)} />
                  </Field>
                  <Field label="Fit / warmte" htmlFor="fitScore" hint="Ideale klant?" error={e.fitScore}>
                    <Select id="fitScore" name="fitScore" defaultValue={fitScore} onValueChange={setFitScore}>
                      <option value="0">Onbeoordeeld</option>
                      <option value="1">★ (1)</option>
                      <option value="2">★★ (2)</option>
                      <option value="3">★★★ (3)</option>
                      <option value="4">★★★★ (4)</option>
                      <option value="5">★★★★★ (5)</option>
                    </Select>
                  </Field>
                  <Field label="Bron" htmlFor="source" error={e.source}>
                    <Select id="source" name="source" defaultValue={source} onValueChange={setSource}>
                      {DEAL_SOURCES.map((s) => (
                        <option key={s.value} value={s.value} data-color={s.color}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Verwachte sluitdatum" htmlFor="expectedCloseDate" error={e.expectedCloseDate}>
                    <Input id="expectedCloseDate" name="expectedCloseDate" type="date" defaultValue={toDateValue(deal?.expectedCloseDate)} />
                  </Field>
                  <Field label="Volgende opvolging" htmlFor="nextFollowUpAt" hint="Plan je eerstvolgende actie" error={e.nextFollowUpAt}>
                    <Input id="nextFollowUpAt" name="nextFollowUpAt" type="date" defaultValue={toDateValue(deal?.nextFollowUpAt)} />
                  </Field>
                </div>
              </section>

              {/* Sectie: notitie (alleen bij nieuwe deal) */}
              {!deal && (
                <section className="space-y-4 border-t border-ink-100 pt-5">
                  <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-amber-700">
                    <StickyNote className="h-4 w-4" /> Notitie voor jezelf
                  </h2>
                  <Field label="Notitie" htmlFor="notes" hint="Wordt vastgelegd in het notitieblok van de deal" error={e.notes}>
                    <Textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      placeholder="Bijv. Contact via beurs — wil vóór Q3 opschalen. Bellen na de vakantie."
                    />
                  </Field>
                </section>
              )}

              {/* Sectie: koppelingen */}
              <section className="space-y-4 border-t border-ink-100 pt-5">
                <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-violet-700">
                  <Link2 className="h-4 w-4" /> Koppelingen <span className="font-normal normal-case text-ink-400">(optioneel)</span>
                </h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Opdrachtgever" htmlFor="targetClientId" error={e.targetClientId}>
                    <Select id="targetClientId" name="targetClientId" defaultValue={deal?.targetClientId ?? ""}>
                      <option value="">— geen —</option>
                      {targets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Klant (gefactureerd)" htmlFor="clientId" error={e.clientId}>
                    <Select id="clientId" name="clientId" defaultValue={deal?.clientId ?? ""}>
                      <option value="">— geen —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Vacature" htmlFor="vacancyId" error={e.vacancyId}>
                    <Select id="vacancyId" name="vacancyId" defaultValue={deal?.vacancyId ?? ""}>
                      <option value="">— geen —</option>
                      {vacancies.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Contactpersoon" htmlFor="primaryContactId" error={e.primaryContactId}>
                    <Select id="primaryContactId" name="primaryContactId" defaultValue={deal?.primaryContactId ?? ""}>
                      <option value="">— geen —</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </section>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
                Annuleren
              </Link>
              <SubmitButton>{submitLabel}</SubmitButton>
            </CardFooter>
          </Card>
        </div>

        {/* ---- Rechterkant: het gekleurde live-voorbeeld ---- */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card>
              <CardContent className="space-y-4">
                <p className="text-[13px] font-bold uppercase tracking-wide text-ink-400">Voorbeeld</p>

                <div>
                  <p className="text-base font-bold text-ink-900">
                    {title || <span className="text-ink-300">Titel van de deal</span>}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-500">
                    <Building2 className="h-3.5 w-3.5 text-ink-400" />
                    {company || <span className="text-ink-300">Bedrijf / opdrachtgever</span>}
                    {company.trim() && (
                      <Badge color={knownCompany ? "green" : "amber"} className="ml-1">
                        {knownCompany ? "bekende klant" : "nieuw"}
                      </Badge>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
                  {stage && <Badge color={stage.color}>{stage.label}</Badge>}
                  {disciplineLabel && <Badge color={disciplineColor}>{disciplineLabel}</Badge>}
                  <Badge color={colorFor(DEAL_SOURCES, source)}>{labelFor(DEAL_SOURCES, source)}</Badge>
                </div>

                <dl className="space-y-2.5 border-t border-ink-100 pt-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-ink-500">
                      <Euro className="h-3.5 w-3.5 text-emerald-500" /> Waarde
                    </dt>
                    <dd className="font-semibold tabular-nums text-ink-900">{euro.format(Number(value) || 0)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-ink-500">
                      <Users className="h-3.5 w-3.5 text-blue-500" /> Posities
                    </dt>
                    <dd className="font-semibold tabular-nums text-ink-900">{Number(positions) || 1}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-ink-500">
                      <Star className="h-3.5 w-3.5 text-amber-500" /> Fit / warmte
                    </dt>
                    <dd className="font-semibold text-amber-500">
                      {fit > 0 ? "★".repeat(fit) + "☆".repeat(5 - fit) : <span className="text-ink-300">onbeoordeeld</span>}
                    </dd>
                  </div>
                </dl>

                <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                  Dit voorbeeld werkt live mee terwijl je invult — zo zie je meteen hoe de lead in de pipeline verschijnt.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </form>
  );
}
