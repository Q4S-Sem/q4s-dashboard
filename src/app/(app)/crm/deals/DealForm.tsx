"use client";

import { useActionState, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import type { Deal } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import { TextCombobox } from "@/components/ui/text-combobox";
import { emptyFormState, type FormState } from "@/lib/form";
import { DISCIPLINES, DEAL_SOURCES, EMPLOYMENT_TYPES, labelFor, colorFor, type BadgeColor } from "@/lib/domain";
import { Building2, Euro, Users, Star, Link2, StickyNote, Sparkles, Loader2, CheckCircle2, AlertTriangle, Clock, ListChecks } from "lucide-react";
import { readVacatureFields } from "./actions";

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
  vacatureDeals,
  contacts,
  defaultCompany,
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
  vacatureDeals: IdName[];
  contacts: IdName[];
  defaultCompany?: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  // Live velden voor het gekleurde voorbeeld rechts.
  const [title, setTitle] = useState(deal?.title ?? "");
  const [company, setCompany] = useState(deal?.company ?? defaultCompany ?? "");
  const [discipline, setDiscipline] = useState(deal?.discipline ?? "");
  const [location, setLocation] = useState(deal?.location ?? "");
  const [employmentType, setEmploymentType] = useState(deal?.employmentType ?? "");
  const [stageId, setStageId] = useState(deal?.stageId ?? stages[0]?.id ?? "");
  const [value, setValue] = useState(String(deal?.value ?? 0));
  const [positions, setPositions] = useState(String(deal?.positions ?? 1));
  const [fitScore, setFitScore] = useState(String(deal?.fitScore ?? 0));
  const [source, setSource] = useState(deal?.source ?? "MANUAL");
  const [notes, setNotes] = useState("");
  // Uitgebreide vacaturevelden.
  const [hoursPerWeek, setHoursPerWeek] = useState(deal?.hoursPerWeek ? String(deal.hoursPerWeek) : "");
  const [durationText, setDurationText] = useState(deal?.durationText ?? "");
  const [rateText, setRateText] = useState(deal?.rateText ?? "");
  const [experienceText, setExperienceText] = useState(deal?.experienceText ?? "");
  const [educationLevel, setEducationLevel] = useState(deal?.educationLevel ?? "");
  const [responsibilities, setResponsibilities] = useState(deal?.responsibilities ?? "");
  const [requirements, setRequirements] = useState(deal?.requirements ?? "");
  const [niceToHave, setNiceToHave] = useState(deal?.niceToHave ?? "");
  const [certificates, setCertificates] = useState(deal?.certificates ?? "");

  // Scanner-status (alleen bij een nieuwe vacature).
  const isNew = !deal;
  // Een deal MÉT kandidaat is een pipeline-plaatsing; ZONDER kandidaat een
  // vacature. Zo toont het bewerkformulier het juiste type (geen vacature-velden
  // op een plaatsing).
  const isVacature = isNew || !deal?.candidateId;
  const [reading, setReading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanDone, setScanDone] = useState(false);

  async function leesVacature(f: File | null) {
    if (!f) return;
    setReading(true);
    setScanError(null);
    setScanDone(false);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await readVacatureFields(fd);
      if (!res.ok) {
        setScanError(res.error);
        return;
      }
      const v = res.fields;
      // Alleen invullen wat de AI vond; bestaande waarden niet met leeg overschrijven.
      const fill = (val: string, setter: Dispatch<SetStateAction<string>>) => {
        if (val) setter((prev) => (prev.trim() ? prev : val));
      };
      if (v.title) setTitle(v.title);
      if (v.company) setCompany(v.company);
      if (v.discipline) setDiscipline(v.discipline);
      if (v.location) setLocation(v.location);
      if (v.employmentType) setEmploymentType(v.employmentType);
      if (v.positions && v.positions > 0) setPositions(String(v.positions));
      if (v.hoursPerWeek && v.hoursPerWeek > 0) setHoursPerWeek(String(v.hoursPerWeek));
      fill(v.durationText, setDurationText);
      fill(v.rateText, setRateText);
      fill(v.experienceText, setExperienceText);
      fill(v.educationLevel, setEducationLevel);
      fill(v.responsibilities, setResponsibilities);
      fill(v.requirements, setRequirements);
      fill(v.niceToHave, setNiceToHave);
      fill(v.certificates, setCertificates);
      if (v.notes) setNotes((prev) => (prev.trim() ? prev : v.notes));
      setScanDone(true);
    } catch {
      setScanError("De vacature kon niet uitgelezen worden. Probeer het opnieuw of vul handmatig in.");
    } finally {
      setReading(false);
    }
  }

  const stage = useMemo(() => stages.find((s) => s.id === stageId), [stages, stageId]);
  const fit = Number(fitScore) || 0;
  const disciplineLabel = discipline ? labelFor(DISCIPLINES, discipline) : "";
  const disciplineColor: BadgeColor = discipline ? colorFor(DISCIPLINES, discipline) : "slate";
  const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  const knownCompany = companies.some((c) => c.toLowerCase() === company.trim().toLowerCase());

  return (
    <form action={formAction}>
      {deal && <input type="hidden" name="id" value={deal.id} />}

      <div className="space-y-6">
        {isNew && (
          <Card className="border-brand-100 bg-gradient-to-br from-brand-50/60 to-transparent">
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-bold text-ink-900">Vacature automatisch inlezen</h2>
                    <p className="text-sm text-ink-500">
                      Sleep een vacature (PDF, Word of foto/scan) hierheen. De AI leest titel, bedrijf,
                      discipline, locatie en eisen uit en vult het formulier hieronder — controleer het
                      nog even vóór je opslaat.
                    </p>
                  </div>
                </div>

                <Dropzone
                  name="vacatureScanFile"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf"
                  label="Sleep een vacature hierheen of klik om te selecteren"
                  hint="PDF, Word (.docx) of een duidelijke foto/scan"
                  onFilesChange={(files) => {
                    const f = files[0] ?? null;
                    setScanDone(false);
                    setScanError(null);
                    if (f) void leesVacature(f);
                  }}
                />

                {reading && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> Bezig met automatisch inlezen…
                  </span>
                )}
                {!reading && scanDone && !scanError && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Ingelezen — controleer de velden hieronder
                  </span>
                )}
                {scanError && (
                  <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {scanError}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-6">
              {state.error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
              )}

              {/* Sectie: de vacature */}
              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Building2 className="h-4 w-4" />
                  </span>
                  {isVacature ? "De vacature" : "De plaatsing"}
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
                    <TextCombobox
                      id="company"
                      name="company"
                      options={companies}
                      defaultValue={company}
                      required
                      placeholder="Bijv. TenneT"
                      onChange={setCompany}
                    />
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-3">
                  <Field
                    label="Discipline"
                    htmlFor="discipline"
                    error={e.discipline}
                    hint="Kies de discipline"
                  >
                    <Select
                      id="discipline"
                      name="discipline"
                      key={discipline}
                      defaultValue={discipline}
                      onValueChange={setDiscipline}
                    >
                      <option value="">— kies discipline —</option>
                      {DISCIPLINES.map((d) => (
                        <option key={d.value} value={d.value} data-color={d.color}>
                          {d.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {isVacature ? (
                    <>
                      <Field label="Locatie" htmlFor="location" error={e.location} hint="Standplaats / regio">
                        <Input
                          id="location"
                          name="location"
                          value={location}
                          onChange={(ev) => setLocation(ev.target.value)}
                          placeholder="Bijv. Rotterdam"
                        />
                      </Field>
                      <Field label="Dienstverband" htmlFor="employmentType" error={e.employmentType}>
                        <Select id="employmentType" name="employmentType" defaultValue={employmentType} onValueChange={setEmploymentType}>
                          <option value="">— maakt niet uit —</option>
                          {EMPLOYMENT_TYPES.map((t) => (
                            <option key={t.value} value={t.value} data-color={t.color}>
                              {t.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </>
                  ) : (
                    <Field label="Fase" htmlFor="stageId" error={e.stageId}>
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
                  )}
                </div>

                {/* Fase apart tonen bij het bewerken van een vacature (zonder kandidaat) */}
                {isVacature && !isNew && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Fase" htmlFor="stageId" error={e.stageId}>
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
                  </div>
                )}
              </section>

              {/* Sectie: waarde & kwalificatie */}
              <section className="space-y-4 border-t border-ink-100 pt-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Euro className="h-4 w-4" />
                  </span>
                  Waarde &amp; planning
                </h2>
                <div className={`grid gap-5 ${isVacature ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
                  <Field label="Waarde (€)" htmlFor="value" hint="Verwacht tarief / marge" error={e.value}>
                    <Input id="value" name="value" type="number" min={0} step="100" value={value} onChange={(ev) => setValue(ev.target.value)} />
                  </Field>
                  <Field label="Posities" htmlFor="positions" hint="Aantal plekken" error={e.positions}>
                    <Input id="positions" name="positions" type="number" min={1} value={positions} onChange={(ev) => setPositions(ev.target.value)} />
                  </Field>
                  {!isVacature && (
                    <>
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
                    </>
                  )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={isVacature ? "Verwachte startdatum" : "Verwachte sluitdatum"} htmlFor="expectedCloseDate" hint={isVacature ? "Wanneer moet de plek gevuld zijn" : undefined} error={e.expectedCloseDate}>
                    <Input id="expectedCloseDate" name="expectedCloseDate" type="date" defaultValue={toDateValue(deal?.expectedCloseDate)} />
                  </Field>
                  <Field label="Volgende opvolging" htmlFor="nextFollowUpAt" hint="Plan je eerstvolgende actie" error={e.nextFollowUpAt}>
                    <Input id="nextFollowUpAt" name="nextFollowUpAt" type="date" defaultValue={toDateValue(deal?.nextFollowUpAt)} />
                  </Field>
                </div>
              </section>

              {/* Sectie: opdrachtdetails (alleen vacature) */}
              {isVacature && (
                <section className="space-y-4 border-t border-ink-100 pt-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Clock className="h-4 w-4" />
                    </span>
                    Opdrachtdetails
                  </h2>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <Field label="Uren per week" htmlFor="hoursPerWeek" hint="Bijv. 40" error={e.hoursPerWeek}>
                      <Input id="hoursPerWeek" name="hoursPerWeek" type="number" min={0} max={168} value={hoursPerWeek} onChange={(ev) => setHoursPerWeek(ev.target.value)} placeholder="40" />
                    </Field>
                    <Field label="Duur" htmlFor="durationText" hint="Bijv. 6 maanden + optie" error={e.durationText}>
                      <Input id="durationText" name="durationText" value={durationText} onChange={(ev) => setDurationText(ev.target.value)} placeholder="Bijv. 6 mnd + optie tot verlenging" />
                    </Field>
                    <Field label="Tarief / salaris" htmlFor="rateText" hint="Wat de klant biedt" error={e.rateText}>
                      <Input id="rateText" name="rateText" value={rateText} onChange={(ev) => setRateText(ev.target.value)} placeholder="Bijv. € 65–75 p/u of € 4.500 p/m" />
                    </Field>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Gevraagde ervaring" htmlFor="experienceText" error={e.experienceText}>
                      <Input id="experienceText" name="experienceText" value={experienceText} onChange={(ev) => setExperienceText(ev.target.value)} placeholder="Bijv. min. 3 jaar in NDT" />
                    </Field>
                    <Field label="Opleidingsniveau" htmlFor="educationLevel" error={e.educationLevel}>
                      <Input id="educationLevel" name="educationLevel" value={educationLevel} onChange={(ev) => setEducationLevel(ev.target.value)} placeholder="Bijv. MBO4 / HBO" />
                    </Field>
                  </div>
                </section>
              )}

              {/* Sectie: de functie (alleen vacature) */}
              {isVacature && (
                <section className="space-y-4 border-t border-ink-100 pt-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <ListChecks className="h-4 w-4" />
                    </span>
                    De functie
                  </h2>
                  <Field label="Werkzaamheden" htmlFor="responsibilities" hint="Één taak per regel" error={e.responsibilities}>
                    <Textarea id="responsibilities" name="responsibilities" rows={4} value={responsibilities} onChange={(ev) => setResponsibilities(ev.target.value)} placeholder={"Bijv.\nUitvoeren van NDT-inspecties (UT/RT/MT/PT)\nRapporteren van bevindingen\nBegeleiden van junior inspecteurs"} />
                  </Field>
                  <Field label="Functie-eisen" htmlFor="requirements" hint="Harde eisen — één per regel" error={e.requirements}>
                    <Textarea id="requirements" name="requirements" rows={4} value={requirements} onChange={(ev) => setRequirements(ev.target.value)} placeholder={"Bijv.\nMinimaal 3 jaar ervaring in NDT\nWoonachtig in regio Rotterdam\nBeheersing Nederlands en Engels"} />
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Pré (nice-to-have)" htmlFor="niceToHave" hint="Één per regel" error={e.niceToHave}>
                      <Textarea id="niceToHave" name="niceToHave" rows={3} value={niceToHave} onChange={(ev) => setNiceToHave(ev.target.value)} placeholder={"Bijv.\nErvaring in offshore\nRijbewijs B"} />
                    </Field>
                    <Field label="Vereiste certificaten" htmlFor="certificates" hint="VCA, lascert., NDT-level — één per regel" error={e.certificates}>
                      <Textarea id="certificates" name="certificates" rows={3} value={certificates} onChange={(ev) => setCertificates(ev.target.value)} placeholder={"Bijv.\nVCA VOL\nNDT Level II (UT)"} />
                    </Field>
                  </div>
                </section>
              )}
              {!deal && (
                <section className="space-y-4 border-t border-ink-100 pt-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <StickyNote className="h-4 w-4" />
                    </span>
                    Notitie voor jezelf
                  </h2>
                  <Field label="Notitie" htmlFor="notes" hint="Wordt vastgelegd in het notitieblok van de vacature — functie-eisen uit de scan komen hier ook terecht" error={e.notes}>
                    <Textarea
                      id="notes"
                      name="notes"
                      rows={notes ? 6 : 3}
                      value={notes}
                      onChange={(ev) => setNotes(ev.target.value)}
                      placeholder="Bijv. Contact via beurs — wil vóór Q3 opschalen. Bellen na de vakantie."
                    />
                  </Field>
                </section>
              )}

              {/* Sectie: koppelingen — bij een plaatsing (kandidaat-deal) */}
              {!isVacature && (
              <section className="space-y-4 border-t border-ink-100 pt-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <Link2 className="h-4 w-4" />
                  </span>
                  Koppelingen <span className="font-normal text-ink-400">(optioneel)</span>
                </h2>
                <div className="grid gap-5 sm:grid-cols-2">
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
                  <Field label="Vacature" htmlFor="vacatureDealId" hint="Koppel deze plaatsing aan een openstaande vacature" error={e.vacatureDealId}>
                    <Select id="vacatureDealId" name="vacatureDealId" defaultValue={deal?.vacatureDealId ?? ""}>
                      <option value="">— geen —</option>
                      {vacatureDeals.length > 0 && (
                        <optgroup label="Openstaande vacatures">
                          {vacatureDeals.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {vacancies.length > 0 && (
                        <optgroup label="Gepubliceerde vacatures">
                          {vacancies.map((v) => (
                            <option key={v.id} value={`pub:${v.id}`}>
                              {v.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
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
              )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
                Annuleren
              </Link>
              <SubmitButton>{submitLabel}</SubmitButton>
            </CardFooter>
          </Card>
      </div>
    </form>
  );
}
