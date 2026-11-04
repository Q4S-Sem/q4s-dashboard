"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Candidate } from "@prisma/client";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Trash2, User, Star, ListChecks } from "lucide-react";
import { FolderTabBar, FolderTab } from "@/components/dossier-tabs";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Dropzone } from "@/components/ui/dropzone";
import { CvPreviewButton } from "@/components/cv-preview-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import {
  DISCIPLINES,
  CANDIDATE_RATINGS,
  CANDIDATE_AVAILABILITY,
  CANDIDATE_INTERVIEW_STATUSES,
} from "@/lib/domain";
import { emptyFormState, type FormState } from "@/lib/form";
import { readCvFields } from "./actions";

/** Format a Date to yyyy-mm-dd for a date-input default value. */
function di(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function CandidateForm({
  action,
  candidate,
  submitLabel,
  cancelHref,
  /** Toon de "CV inlezen"-blok bovenaan (alleen bij een nieuwe kandidaat). */
  showCvIntake = false,
  spoor,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  candidate?: Candidate;
  submitLabel: string;
  cancelHref: string;
  showCvIntake?: boolean;
  /** Wervingsspoor voor een nieuwe kandidaat (PROJECT | VAST). */
  spoor?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  // Gecontroleerde velden zodat de AI-uitlezing ze kan invullen. Startwaarden uit
  // de kandidaat (bij bewerken) of leeg (bij nieuw).
  const [firstName, setFirstName] = useState(candidate?.firstName ?? "");
  const [lastName, setLastName] = useState(candidate?.lastName ?? "");
  const [email, setEmail] = useState(candidate?.email ?? "");
  const [phone, setPhone] = useState(candidate?.phone ?? "");
  const [discipline, setDiscipline] = useState(candidate?.discipline ?? "");
  const [location, setLocation] = useState(candidate?.location ?? "");
  const [headline, setHeadline] = useState(candidate?.headline ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(candidate?.linkedinUrl ?? "");
  const [rating, setRating] = useState(candidate?.rating ?? "ONBEKEND");
  const [availability, setAvailability] = useState(candidate?.availability ?? "ONBEKEND");
  const [availableFrom, setAvailableFrom] = useState(di(candidate?.availableFrom));
  const [interviewStatus, setInterviewStatus] = useState(candidate?.interviewStatus ?? "NONE");
  const [interviewDate, setInterviewDate] = useState(di(candidate?.interviewDate));
  const [experienceSummary, setExperienceSummary] = useState(candidate?.experienceSummary ?? "");
  const [notes, setNotes] = useState(candidate?.notes ?? "");

  // --- Concept blijft bewaard (alleen bij een NIEUWE kandidaat) ------------------
  // Wat je invult wordt lokaal (op dit apparaat) opgeslagen, zodat je niets
  // kwijtraakt als je even naar een andere pagina gaat en terugkomt. Bij een
  // geslaagde opslag verdwijnt het concept vanzelf; met "Wis formulier" gooi je
  // het handmatig weg. Bij het bewerken van een bestaande kandidaat doen we dit
  // niet — dan zijn de opgeslagen gegevens al de bron.
  const isNew = !candidate;
  const DRAFT_KEY = "q4s-candidate-draft:new";
  const [restoredHint, setRestoredHint] = useState(false);
  const hydratedRef = useRef(false);

  // Terugzetten bij binnenkomst (één keer), vóór de opslag-effect gaat draaien.
  useEffect(() => {
    if (isNew) {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw) as Record<string, string>;
          if (d.firstName) setFirstName(d.firstName);
          if (d.lastName) setLastName(d.lastName);
          if (d.email) setEmail(d.email);
          if (d.phone) setPhone(d.phone);
          if (d.discipline) setDiscipline(d.discipline);
          if (d.location) setLocation(d.location);
          if (d.headline) setHeadline(d.headline);
          if (d.linkedinUrl) setLinkedinUrl(d.linkedinUrl);
          if (d.rating) setRating(d.rating);
          if (d.availability) setAvailability(d.availability);
          if (d.availableFrom) setAvailableFrom(d.availableFrom);
          if (d.interviewStatus) setInterviewStatus(d.interviewStatus);
          if (d.interviewDate) setInterviewDate(d.interviewDate);
          if (d.experienceSummary) setExperienceSummary(d.experienceSummary);
          if (d.notes) setNotes(d.notes);
          setRestoredHint(true);
        }
      } catch {
        // ongeldige/ontoegankelijke opslag → gewoon leeg beginnen
      }
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bij elke wijziging bewaren; tijdens het verzenden het concept wissen (zodat
  // een geslaagde opslag geen stale concept achterlaat). Mislukt het verzenden,
  // dan draait deze effect opnieuw met isPending=false en wordt het concept weer
  // bewaard, zodat je het alsnog niet kwijt bent.
  useEffect(() => {
    if (!isNew || !hydratedRef.current) return;
    try {
      if (isPending) {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const draft = {
        firstName, lastName, email, phone, discipline, location, headline,
        linkedinUrl, rating, availability, availableFrom, interviewStatus,
        interviewDate, experienceSummary, notes,
      };
      const hasData = Object.values(draft).some(
        (v) => v && v !== "ONBEKEND" && v !== "NONE",
      );
      if (hasData) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // opslag vol/geblokkeerd → nooit het invullen blokkeren
    }
  }, [
    isNew, isPending, firstName, lastName, email, phone, discipline, location,
    headline, linkedinUrl, rating, availability, availableFrom, interviewStatus,
    interviewDate, experienceSummary, notes,
  ]);

  /** Gooi het hele (nieuwe-kandidaat) formulier leeg + verwijder het concept. */
  function wisFormulier() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setDiscipline("");
    setLocation("");
    setHeadline("");
    setLinkedinUrl("");
    setRating("ONBEKEND");
    setAvailability("ONBEKEND");
    setAvailableFrom("");
    setInterviewStatus("NONE");
    setInterviewDate("");
    setExperienceSummary("");
    setNotes("");
    setRestoredHint(false);
    setCvFile(null);
    setCvDone(false);
    setCvError(null);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // negeren
    }
  }

  // CV-inlezen-status
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvDone, setCvDone] = useState(false);

  // Nieuwe kandidaat = dezelfde stappen als een nieuwe vacature, alles onder elkaar.
  const stappen = showCvIntake;
  const [tab, setTab] = useState(stappen ? "inlezen" : "persoon");
  const tabs = [
    ["inlezen", "1. Inlezen", <Sparkles key="i" className="h-4 w-4" />],
    ["persoon", "2. Persoon", <User key="i" className="h-4 w-4" />],
    ["profiel", "3. Profiel & beoordeling", <Star key="i" className="h-4 w-4" />],
    ["ervaring", "4. Ervaring & notities", <ListChecks key="i" className="h-4 w-4" />],
  ] as const;
  const tabIdx = tabs.findIndex(([k]) => k === tab);
  const vorige = tabs[tabIdx - 1]?.[0];
  const volgende = tabs[tabIdx + 1]?.[0];
  const zicht = (k: string) => (stappen && tab !== k ? "hidden" : "");
  const rij = (kolommen: string) => (stappen ? "grid gap-5" : `grid gap-5 ${kolommen}`);

  async function leesCv(f?: File | null) {
    const target = f ?? cvFile;
    if (!target) return;
    setReading(true);
    setCvError(null);
    setCvDone(false);
    try {
      const fd = new FormData();
      fd.set("file", target);
      const res = await readCvFields(fd);
      if (!res.ok) {
        setCvError(res.error);
        return;
      }
      const f2 = res.fields;
      // Alleen invullen wat de AI vond; bestaande waarden niet met leeg overschrijven.
      if (f2.firstName) setFirstName(f2.firstName);
      if (f2.lastName) setLastName(f2.lastName);
      if (f2.email) setEmail(f2.email);
      if (f2.phone) setPhone(f2.phone);
      if (f2.discipline) setDiscipline(f2.discipline);
      if (f2.location) setLocation(f2.location);
      if (f2.headline) setHeadline(f2.headline);
      if (f2.linkedinUrl) setLinkedinUrl(f2.linkedinUrl);
      // Werkervaring is het belangrijkste: zet de samenvatting in het eigen
      // Werkervaring-veld (nooit bestaande inhoud overschrijven). Notities blijft
      // vrij voor de recruiter.
      if (f2.experienceSummary) {
        setExperienceSummary((prev) => (prev.trim() ? prev : f2.experienceSummary as string));
      }
      setCvDone(true);
      setTab("persoon");
    } catch {
      setCvError("Het CV kon niet uitgelezen worden. Probeer het opnieuw of vul handmatig in.");
    } finally {
      setReading(false);
    }
  }

  // Het CV-bestand meesturen bij opslaan, zodat het meteen aan de kandidaat hangt.
  function onSubmit(fd: FormData) {
    if (cvFile) fd.set("cvFile", cvFile);
    return formAction(fd);
  }

  return (
    <form
      action={onSubmit}
      data-no-persist={isNew ? "" : undefined}
      className="space-y-5"
      // Verplicht veld leeg in een verborgen stap? Spring naar die stap.
      onInvalidCapture={(ev) => {
        const t = (ev.target as HTMLElement).closest("[data-tab]")?.getAttribute("data-tab");
        if (t && t !== tab) setTab(t);
      }}
    >
      {candidate && <input type="hidden" name="id" value={candidate.id} />}
      {spoor && <input type="hidden" name="spoor" value={spoor} />}

      {/* Concept teruggezet — laat weten dat oude invoer is hersteld + wis-knop */}
      {isNew && restoredHint && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm text-ink-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
            We hebben je eerder ingevulde gegevens teruggezet. Ga gerust verder.
          </span>
          <button
            type="button"
            onClick={wisFormulier}
            className={buttonVariants({ variant: "danger", size: "sm" })}
          >
            <Trash2 className="h-4 w-4" /> Wis formulier
          </button>
        </div>
      )}


      {/* CV inlezen — automatische invulling (alleen bij nieuwe kandidaat) */}
      {stappen && (
        <FolderTabBar label="Stappen nieuwe kandidaat">
          {tabs.map(([key, label, icon]) => (
            <FolderTab key={key} icon={icon} label={label} active={tab === key} onClick={() => setTab(key)} />
          ))}
        </FolderTabBar>
      )}
      {showCvIntake && (
        <Card className={cn("mb-6", zicht("inlezen"))}>
          <CardContent className="space-y-4">
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Cv inlezen</h2>
              <p className="mt-0.5 text-[13px] text-ink-500">
                Sleep een cv (PDF, Word of foto) hierheen. De AI vult de volgende stappen in; jij controleert het. Het cv
                wordt meteen aan de kandidaat gekoppeld.
              </p>
            </div>

            <Dropzone
              name="cvIntakeFile"
              accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf"
              label="Sleep een CV hierheen of klik om te selecteren"
              hint="PDF, Word (.docx) of een duidelijke foto/scan"
              onFilesChange={(files) => {
                const f = files[0] ?? null;
                setCvFile(f);
                setCvDone(false);
                setCvError(null);
                // Direct automatisch inlezen — geen knop meer nodig.
                if (f) void leesCv(f);
              }}
            />

            <div className="flex flex-wrap items-center gap-3">
              {reading && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> Bezig met automatisch inlezen…
                </span>
              )}
              {!reading && cvDone && !cvError && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Ingelezen — controleer de velden in de volgende stappen
                </span>
              )}
              {!reading && cvFile && (
                <button
                  type="button"
                  onClick={() => leesCv()}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
                >
                  <Sparkles className="h-4 w-4" /> Opnieuw inlezen
                </button>
              )}
              {!reading && cvFile && (
                <CvPreviewButton file={cvFile} label="Bekijk CV" />
              )}
            </div>

            {cvError && (
              <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {cvError}
              </p>
            )}
            <div className="flex justify-end border-t border-ink-200 pt-4">
              <button type="button" className={buttonVariants({ variant: "outline" })} onClick={() => setTab("persoon")}>
                Zelf invullen →
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className={stappen && tab === "inlezen" ? "hidden" : ""}>
        <CardContent className={stappen ? "max-w-4xl space-y-6" : "space-y-8"}>
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <section data-tab="persoon" className={`space-y-4 ${zicht("persoon")}`}>
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Persoon</h2>
              <p className="mt-0.5 text-[13px] text-ink-500">Naam en hoe je hem bereikt.</p>
            </div>
            <div className={rij("sm:grid-cols-2 xl:grid-cols-3")}>
              <Field label="Voornaam" htmlFor="firstName" required error={e.firstName}>
                <Input id="firstName" name="firstName" value={firstName} onChange={(ev) => setFirstName(ev.target.value)} required />
              </Field>
              <Field label="Achternaam" htmlFor="lastName" required error={e.lastName}>
                <Input id="lastName" name="lastName" value={lastName} onChange={(ev) => setLastName(ev.target.value)} required />
              </Field>
              <Field label="E-mail" htmlFor="email" error={e.email}>
                <Input id="email" name="email" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} />
              </Field>
              <Field label="Telefoon" htmlFor="phone" error={e.phone}>
                <Input id="phone" name="phone" value={phone} onChange={(ev) => setPhone(ev.target.value)} />
              </Field>
              <Field label="Locatie" htmlFor="location" error={e.location}>
                <Input id="location" name="location" placeholder="Bijv. Rotterdam" value={location} onChange={(ev) => setLocation(ev.target.value)} />
              </Field>
              <Field label="LinkedIn-URL" htmlFor="linkedinUrl" error={e.linkedinUrl}>
                <Input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  type="url"
                  placeholder="https://www.linkedin.com/in/…"
                  value={linkedinUrl}
                  onChange={(ev) => setLinkedinUrl(ev.target.value)}
                />
              </Field>
            </div>
          </section>

          <section data-tab="profiel" className={`space-y-4 ${zicht("profiel")}`}>
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Profiel & beoordeling</h2>
              <p className="mt-0.5 text-[13px] text-ink-500">Wat hij doet, hoe inzetbaar hij is en of hij al op gesprek was.</p>
            </div>
            <div className={rij("sm:grid-cols-2 xl:grid-cols-3")}>
              <Field label="Discipline" htmlFor="discipline" error={e.discipline}>
                <Select id="discipline" name="discipline" defaultValue={discipline} key={`disc-${discipline}`} onValueChange={setDiscipline}>
                  <option value="">— kies —</option>
                  {DISCIPLINES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Headline" htmlFor="headline" hint="Korte functieomschrijving" error={e.headline}>
                <Input
                  id="headline"
                  name="headline"
                  placeholder="Bijv. NDT UT/RT Level 2 inspecteur"
                  value={headline}
                  onChange={(ev) => setHeadline(ev.target.value)}
                />
              </Field>
              <Field
                label="Beoordeling"
                htmlFor="rating"
                hint="Rangschik hoe inzetbaar deze kandidaat is voor klanten."
                error={e.rating}
              >
                <Select id="rating" name="rating" key={`rating-${rating}`} defaultValue={rating} onValueChange={setRating}>
                  {CANDIDATE_RATINGS.map((r) => (
                    <option key={r.value} value={r.value} data-color={r.color}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Beschikbaarheid"
                htmlFor="availability"
                hint="Kan deze kandidaat op dit moment ingezet worden?"
                error={e.availability}
              >
                <Select
                  id="availability"
                  name="availability"
                  key={`avail-${availability}`}
                  defaultValue={availability}
                  onValueChange={setAvailability}
                >
                  {CANDIDATE_AVAILABILITY.map((a) => (
                    <option key={a.value} value={a.value} data-color={a.color}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {availability === "BINNENKORT" && (
                <Field
                  label="Beschikbaar vanaf"
                  htmlFor="availableFrom"
                  hint="Vanaf welke datum is deze kandidaat inzetbaar?"
                  error={e.availableFrom}
                >
                  <DateInput id="availableFrom" name="availableFrom" value={availableFrom} onValueChange={setAvailableFrom} />
                </Field>
              )}
              <Field
                label="Interview met Q4S"
                htmlFor="interviewStatus"
                hint="Is deze kandidaat al bij ons op gesprek geweest?"
                error={e.interviewStatus}
              >
                <Select
                  id="interviewStatus"
                  name="interviewStatus"
                  key={`iv-${interviewStatus}`}
                  defaultValue={interviewStatus}
                  onValueChange={setInterviewStatus}
                >
                  {CANDIDATE_INTERVIEW_STATUSES.map((s) => (
                    <option key={s.value} value={s.value} data-color={s.color}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {interviewStatus !== "NONE" && (
                <Field label="Interviewdatum" htmlFor="interviewDate" error={e.interviewDate}>
                  <DateInput id="interviewDate" name="interviewDate" value={interviewDate} onValueChange={setInterviewDate} />
                </Field>
              )}
            </div>
          </section>

          <section data-tab="ervaring" className={`space-y-4 ${zicht("ervaring")}`}>
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Ervaring & notities</h2>
              <p className="mt-0.5 text-[13px] text-ink-500">Werkervaring uit het cv en je eigen aantekeningen.</p>
            </div>
            <Field
              label="Werkervaring"
              htmlFor="experienceSummary"
              hint="Wordt automatisch uit het CV gehaald. Elke functie op een eigen regel met '•' ervoor — controleer en corrigeer gerust."
              error={e.experienceSummary}
            >
              <Textarea
                id="experienceSummary"
                name="experienceSummary"
                rows={12}
                value={experienceSummary}
                onChange={(ev) => setExperienceSummary(ev.target.value)}
                placeholder={"Bijv.\nJunior NDT/QC Inspector met circa 2 jaar ervaring in NDO (UT, MT, VT).\n• Werkgever — Rol (periode): concrete taken, projecten, normen.\n• Werkgever — Rol (periode): …"}
              />
            </Field>
            <Field
              label="Notities"
              htmlFor="notes"
              hint="Vrije aantekeningen voor de recruiter — losse opmerkingen, afspraken of aandachtspunten."
              error={e.notes}
            >
              <Textarea id="notes" name="notes" rows={8} value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder="Bijv. gebeld op 3 mei — wil richting offshore, min. €X, referentie volgt." />
            </Field>
          </section>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          {isNew && (
            <button
              type="button"
              onClick={wisFormulier}
              className={buttonVariants({ variant: "ghost", size: "md", className: "mr-auto text-red-600 hover:bg-red-50 hover:text-red-700" })}
              title="Leeg het formulier en verwijder het bewaarde concept"
            >
              <Trash2 className="h-4 w-4" /> Wis formulier
            </button>
          )}
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Annuleren
          </Link>
          {stappen && vorige && (
            <button type="button" className={buttonVariants({ variant: "outline" })} onClick={() => setTab(vorige)}>
              ← Vorige
            </button>
          )}
          {stappen && volgende && (
            <button type="button" className={buttonVariants({ variant: "outline" })} onClick={() => setTab(volgende)}>
              Volgende →
            </button>
          )}
          <SubmitButton>{submitLabel}</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
