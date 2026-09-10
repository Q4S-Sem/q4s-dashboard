"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Candidate } from "@prisma/client";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
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
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  candidate?: Candidate;
  submitLabel: string;
  cancelHref: string;
  showCvIntake?: boolean;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
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
  const [availability, setAvailability] = useState(candidate?.availability ?? "ONBEKEND");
  const [interviewStatus, setInterviewStatus] = useState(candidate?.interviewStatus ?? "NONE");
  const [notes, setNotes] = useState(candidate?.notes ?? "");

  // CV-inlezen-status
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvDone, setCvDone] = useState(false);

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
      // Werkervaring is het belangrijkste: zet de samenvatting in Notities als die
      // nog leeg is (nooit bestaande notities overschrijven).
      if (f2.experienceSummary) {
        setNotes((prev) => (prev.trim() ? prev : f2.experienceSummary as string));
      }
      setCvDone(true);
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
    <form action={onSubmit}>
      {candidate && <input type="hidden" name="id" value={candidate.id} />}

      {/* CV inlezen — automatische invulling (alleen bij nieuwe kandidaat) */}
      {showCvIntake && (
        <Card className="mb-6">
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <Sparkles className="h-[18px] w-[18px]" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-ink-900">CV automatisch inlezen</h2>
                <p className="text-sm text-ink-500">
                  Sleep een CV (PDF, Word of foto) hierheen. De AI leest naam, contactgegevens,
                  functie en discipline uit en vult het formulier hieronder — controleer het nog even
                  vóór je opslaat. Het CV wordt meteen aan de kandidaat gekoppeld.
                </p>
              </div>
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
                  <CheckCircle2 className="h-4 w-4" /> Ingelezen — controleer de velden hieronder
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          {/* Compacte velden — vullen de volle breedte in 2/3 kolommen */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
            <Field label="Locatie" htmlFor="location" error={e.location}>
              <Input id="location" name="location" placeholder="Bijv. Rotterdam" value={location} onChange={(ev) => setLocation(ev.target.value)} />
            </Field>
            <Field
              label="Beoordeling"
              htmlFor="rating"
              hint="Rangschik hoe inzetbaar deze kandidaat is voor klanten."
              error={e.rating}
            >
              <Select id="rating" name="rating" defaultValue={candidate?.rating ?? "ONBEKEND"}>
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
                defaultValue={candidate?.availability ?? "ONBEKEND"}
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
                <Input id="availableFrom" name="availableFrom" type="date" defaultValue={di(candidate?.availableFrom)} />
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
                defaultValue={candidate?.interviewStatus ?? "NONE"}
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
                <Input id="interviewDate" name="interviewDate" type="date" defaultValue={di(candidate?.interviewDate)} />
              </Field>
            )}
          </div>

          {/* Beschrijvende velden */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Headline" htmlFor="headline" hint="Korte functieomschrijving" error={e.headline}>
              <Input
                id="headline"
                name="headline"
                placeholder="Bijv. NDT UT/RT Level 2 inspecteur"
                value={headline}
                onChange={(ev) => setHeadline(ev.target.value)}
              />
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

          <Field label="Notities" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" rows={7} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
          </Field>
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
