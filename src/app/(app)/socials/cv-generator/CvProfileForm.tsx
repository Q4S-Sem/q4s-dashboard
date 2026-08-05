"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, X, EyeOff, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import type {
  CvCertificate,
  CvEducation,
  CvExperience,
  CvLanguage,
  CvProfileData,
} from "@/lib/cv-profile";

/**
 * Review-scherm: de AI-uitvoer corrigeren vóór het CV naar een opdrachtgever gaat.
 *
 * De herhalende secties zijn client-state (toevoegen/verwijderen/herordenen kan
 * niet met platte form-velden) en gaan als JSON-tekst mee in verborgen inputs.
 * De server valideert die JSON opnieuw met Zod — zie saveCvProfile in actions.ts.
 */

function SectionCard({
  title,
  description,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  description?: string;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <span className="text-sm text-ink-400">{description}</span>}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {onAdd && (
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4" /> {addLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RowShell({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="relative rounded-lg border border-ink-200 bg-ink-50/60 p-3 pr-10">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Verwijderen"
        title="Verwijderen"
        className="absolute right-2 top-2 rounded-md p-1.5 text-ink-400 hover:bg-white hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function CvProfileForm({
  action,
  profileId,
  data,
  anonymize: initialAnonymize,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  profileId: string;
  data: CvProfileData;
  anonymize: boolean;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  const [anonymize, setAnonymize] = useState(initialAnonymize);
  const [skills, setSkills] = useState<string[]>(data.skills);
  const [skillDraft, setSkillDraft] = useState("");
  const [experience, setExperience] = useState<CvExperience[]>(data.experience);
  const [education, setEducation] = useState<CvEducation[]>(data.education);
  const [certificates, setCertificates] = useState<CvCertificate[]>(data.certificates);
  const [languages, setLanguages] = useState<CvLanguage[]>(data.languages);

  const addSkill = () => {
    const v = skillDraft.trim();
    if (!v || skills.includes(v)) {
      setSkillDraft("");
      return;
    }
    setSkills([...skills, v]);
    setSkillDraft("");
  };

  const patch = <T,>(list: T[], i: number, next: Partial<T>): T[] =>
    list.map((item, idx) => (idx === i ? { ...item, ...next } : item));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={profileId} />
      {/* Secties reizen als JSON mee; de server hervalideert ze. */}
      <input type="hidden" name="skillsJson" value={JSON.stringify(skills)} />
      <input type="hidden" name="experienceJson" value={JSON.stringify(experience)} />
      <input type="hidden" name="educationJson" value={JSON.stringify(education)} />
      <input type="hidden" name="certificatesJson" value={JSON.stringify(certificates)} />
      <input type="hidden" name="languagesJson" value={JSON.stringify(languages)} />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      {/* Anonimiseren — bovenaan, want dit bepaalt wat de klant te zien krijgt. */}
      <Card>
        <CardContent className="py-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="anonymize"
              checked={anonymize}
              onChange={(ev) => setAnonymize(ev.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                {anonymize ? (
                  <EyeOff className="h-4 w-4 text-ink-400" />
                ) : (
                  <Eye className="h-4 w-4 text-ink-400" />
                )}
                Anonimiseren voor de opdrachtgever
              </span>
              <span className="mt-0.5 block text-sm text-ink-500">
                {anonymize ? (
                  <>
                    Achternaam wordt een initiaal en contactgegevens van de kandidaat
                    verdwijnen — ook uit de profielschets en de bullets. Q4S staat als enige
                    contact op het CV.
                  </>
                ) : (
                  <>
                    <strong className="font-medium text-amber-700">Let op:</strong> volledige
                    naam en contactgegevens van de kandidaat komen op het CV. De opdrachtgever
                    kan de kandidaat dan rechtstreeks benaderen.
                  </>
                )}
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      {/* Kop */}
      <Card>
        <CardHeader>
          <CardTitle>Kop van het CV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Volledige naam" htmlFor="fullName" required error={e.fullName}>
              <Input id="fullName" name="fullName" defaultValue={data.fullName} required />
            </Field>
            <Field
              label="Functietitel"
              htmlFor="headline"
              error={e.headline}
              hint="Bijv. 6G TIG-lasser"
            >
              <Input id="headline" name="headline" defaultValue={data.headline} />
            </Field>
            <Field label="Locatie / regio" htmlFor="location" error={e.location}>
              <Input id="location" name="location" defaultValue={data.location} />
            </Field>
            <Field
              label="Beschikbaarheid"
              htmlFor="availability"
              error={e.availability}
              hint="Bijv. per direct"
            >
              <Input id="availability" name="availability" defaultValue={data.availability} />
            </Field>
            <Field label="Jaren ervaring" htmlFor="yearsExperience" error={e.yearsExperience}>
              <Input
                id="yearsExperience"
                name="yearsExperience"
                type="number"
                min={0}
                max={70}
                defaultValue={data.yearsExperience ?? ""}
              />
            </Field>
          </div>
          <Field
            label="Profielschets"
            htmlFor="summary"
            error={e.summary}
            hint="2 tot 4 zinnen — dit is het eerste wat een opdrachtgever leest."
          >
            <Textarea id="summary" name="summary" rows={4} defaultValue={data.summary} />
          </Field>
        </CardContent>
      </Card>

      {/* Kerncompetenties */}
      <SectionCard title="Kerncompetenties" description="Losse trefwoorden — deze komen als labels op het CV.">
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {skills.map((s, i) => (
              <span
                key={`${s}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-ink-50 py-1 pl-2.5 pr-1 text-sm text-ink-700"
              >
                {s}
                <button
                  type="button"
                  onClick={() => setSkills(skills.filter((_, idx) => idx !== i))}
                  aria-label={`${s} verwijderen`}
                  title={`${s} verwijderen`}
                  className="rounded p-0.5 text-ink-400 hover:bg-white hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={skillDraft}
            onChange={(ev) => setSkillDraft(ev.target.value)}
            onKeyDown={(ev) => {
              // Enter mag hier niet het hele formulier submitten.
              if (ev.key === "Enter") {
                ev.preventDefault();
                addSkill();
              }
            }}
            placeholder="Bijv. TIG 6G, ISO 9606-1, VCA…"
            aria-label="Competentie toevoegen"
            className="max-w-xs"
          />
          <Button type="button" variant="outline" onClick={addSkill}>
            <Plus className="h-4 w-4" /> Toevoegen
          </Button>
        </div>
      </SectionCard>

      {/* Werkervaring */}
      <SectionCard
        title="Werkervaring"
        description="Nieuwste bovenaan. Eén bullet per regel."
        addLabel="Functie toevoegen"
        onAdd={() =>
          setExperience([
            ...experience,
            { employer: "", role: "", period: "", location: "", bullets: [] },
          ])
        }
      >
        {experience.length === 0 && (
          <p className="text-sm text-ink-500">Nog geen werkervaring — voeg een functie toe.</p>
        )}
        {experience.map((job, i) => (
          <RowShell key={i} onRemove={() => setExperience(experience.filter((_, idx) => idx !== i))}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Functie" htmlFor={`role-${i}`}>
                <Input
                  id={`role-${i}`}
                  value={job.role}
                  onChange={(ev) => setExperience(patch(experience, i, { role: ev.target.value }))}
                />
              </Field>
              <Field label="Werkgever" htmlFor={`employer-${i}`}>
                <Input
                  id={`employer-${i}`}
                  value={job.employer}
                  onChange={(ev) =>
                    setExperience(patch(experience, i, { employer: ev.target.value }))
                  }
                />
              </Field>
              <Field label="Periode" htmlFor={`period-${i}`} hint="Bijv. mrt 2019 – heden">
                <Input
                  id={`period-${i}`}
                  value={job.period}
                  onChange={(ev) => setExperience(patch(experience, i, { period: ev.target.value }))}
                />
              </Field>
              <Field label="Locatie" htmlFor={`joblocation-${i}`}>
                <Input
                  id={`joblocation-${i}`}
                  value={job.location}
                  onChange={(ev) =>
                    setExperience(patch(experience, i, { location: ev.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Taken en resultaten" htmlFor={`bullets-${i}`} hint="Eén per regel.">
                <Textarea
                  id={`bullets-${i}`}
                  rows={3}
                  value={job.bullets.join("\n")}
                  onChange={(ev) =>
                    setExperience(
                      patch(experience, i, {
                        bullets: ev.target.value.split("\n").map((b) => b.trim()).filter(Boolean),
                      }),
                    )
                  }
                />
              </Field>
            </div>
          </RowShell>
        ))}
      </SectionCard>

      {/* Opleiding */}
      <SectionCard
        title="Opleiding"
        addLabel="Opleiding toevoegen"
        onAdd={() => setEducation([...education, { school: "", degree: "", period: "" }])}
      >
        {education.map((ed, i) => (
          <RowShell key={i} onRemove={() => setEducation(education.filter((_, idx) => idx !== i))}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Diploma / richting" htmlFor={`degree-${i}`}>
                <Input
                  id={`degree-${i}`}
                  value={ed.degree}
                  onChange={(ev) => setEducation(patch(education, i, { degree: ev.target.value }))}
                />
              </Field>
              <Field label="School" htmlFor={`school-${i}`}>
                <Input
                  id={`school-${i}`}
                  value={ed.school}
                  onChange={(ev) => setEducation(patch(education, i, { school: ev.target.value }))}
                />
              </Field>
              <Field label="Periode" htmlFor={`edperiod-${i}`}>
                <Input
                  id={`edperiod-${i}`}
                  value={ed.period}
                  onChange={(ev) => setEducation(patch(education, i, { period: ev.target.value }))}
                />
              </Field>
            </div>
          </RowShell>
        ))}
      </SectionCard>

      {/* Certificeringen */}
      <SectionCard
        title="Certificeringen"
        description="Vaak doorslaggevend voor een opdrachtgever — controleer deze extra goed."
        addLabel="Certificaat toevoegen"
        onAdd={() => setCertificates([...certificates, { name: "", issuer: "", year: "" }])}
      >
        {certificates.map((c, i) => (
          <RowShell
            key={i}
            onRemove={() => setCertificates(certificates.filter((_, idx) => idx !== i))}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Certificaat" htmlFor={`certname-${i}`}>
                <Input
                  id={`certname-${i}`}
                  value={c.name}
                  onChange={(ev) => setCertificates(patch(certificates, i, { name: ev.target.value }))}
                />
              </Field>
              <Field label="Uitgever" htmlFor={`issuer-${i}`}>
                <Input
                  id={`issuer-${i}`}
                  value={c.issuer}
                  onChange={(ev) =>
                    setCertificates(patch(certificates, i, { issuer: ev.target.value }))
                  }
                />
              </Field>
              <Field label="Jaar / geldigheid" htmlFor={`certyear-${i}`}>
                <Input
                  id={`certyear-${i}`}
                  value={c.year}
                  onChange={(ev) => setCertificates(patch(certificates, i, { year: ev.target.value }))}
                />
              </Field>
            </div>
          </RowShell>
        ))}
      </SectionCard>

      {/* Talen */}
      <SectionCard
        title="Talen"
        addLabel="Taal toevoegen"
        onAdd={() => setLanguages([...languages, { name: "", level: "" }])}
      >
        {languages.map((l, i) => (
          <RowShell key={i} onRemove={() => setLanguages(languages.filter((_, idx) => idx !== i))}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Taal" htmlFor={`lang-${i}`}>
                <Input
                  id={`lang-${i}`}
                  value={l.name}
                  onChange={(ev) => setLanguages(patch(languages, i, { name: ev.target.value }))}
                />
              </Field>
              <Field label="Niveau" htmlFor={`level-${i}`} hint="Bijv. moedertaal, B2">
                <Input
                  id={`level-${i}`}
                  value={l.level}
                  onChange={(ev) => setLanguages(patch(languages, i, { level: ev.target.value }))}
                />
              </Field>
            </div>
          </RowShell>
        ))}
      </SectionCard>

      <div className="flex justify-end gap-3">
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Annuleren
        </Link>
        <SubmitButton pendingLabel="Opslaan…">Opslaan</SubmitButton>
      </div>
    </form>
  );
}
