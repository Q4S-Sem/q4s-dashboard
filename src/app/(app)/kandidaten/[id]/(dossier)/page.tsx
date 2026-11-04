import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { buttonVariants, segmentVariants } from "@/components/ui/button";
import { CvPreviewButton } from "@/components/cv-preview-button";
import { SPOOR, spoorVan } from "@/lib/spoor";
import { RatingSelect } from "../../RatingSelect";
import { AvailabilitySelect } from "../../AvailabilitySelect";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDate } from "@/lib/utils";
import { DISCIPLINES, CANDIDATE_SOURCES, labelFor } from "@/lib/domain";
import { InterviewSelect } from "../../InterviewSelect";
import { ExperienceView } from "../../ExperienceView";
import { saveCandidateInterviewDetails, laadCvIn, setCandidateSpoor } from "../../actions";
import { getCandidate } from "./data";

// CV inladen (AI-uitlezing, evt. tweede lezing met het sterke model) mag even duren.
export const maxDuration = 60;

/** Eén regel: label links, waarde rechts — alles netjes onder elkaar. */
function Regel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-center gap-3 px-4 py-2.5 text-[13px] sm:grid-cols-[11rem_1fr]">
      <dt className="text-ink-500">{label}</dt>
      <dd className="min-w-0 break-words text-ink-900">{children || <span className="text-ink-300">—</span>}</dd>
    </div>
  );
}

/** Blok met kop en regels eronder. */
function Blok({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-ink-200 bg-white">
      <h2 className="border-b border-ink-200 px-4 py-2.5 text-[13px] font-semibold text-ink-900">{titel}</h2>
      <dl className="divide-y divide-ink-100">{children}</dl>
    </section>
  );
}

/** Foutmelding die via ?error=... terugkomt van een server-action. */
function Fout({ children }: { children: React.ReactNode }) {
  return <p className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700">{children}</p>;
}

/** Formatteer een datum als "YYYY-MM-DD" voor een <input type="date">. */
function toDateInputValue(d: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function OverzichtTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; cv?: string; reden?: string }>;
}) {
  const { id } = await params;
  const { error, cv, reden } = await searchParams;
  const candidate = await getCandidate(id);
  if (!candidate) notFound();

  return (
    <div className="space-y-6">
      {error === "in-use" && (
        <Fout>
          Deze kandidaat kan niet verwijderd worden zolang er sollicitaties aan
          gekoppeld zijn.
        </Fout>
      )}
      {error === "geen-cv" && <Fout>Er hangt nog geen CV aan deze kandidaat. Voeg het toe bij het tabblad CV.</Fout>}
      {error === "cv-lezen" && <Fout>Het CV kon niet uitgelezen worden{reden ? ` (${reden})` : ""}. Probeer het opnieuw of vul de gegevens zelf in.</Fout>}
      {cv === "ingeladen" && (
        <p className="rounded-sm bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          CV ingeladen — lege velden zijn aangevuld. Controleer ze en geef een beoordeling.
        </p>
      )}
      {error === "foto" && <Fout>Kies een afbeelding om te uploaden.</Fout>}
      {error === "foto-groot" && <Fout>De foto is te groot (max. 5 MB).</Fout>}
      {error === "foto-type" && <Fout>Alleen JPG, PNG of WebP.</Fout>}

      <div className="max-w-3xl space-y-5">
        {/* Belangrijkste eerst: waar staat deze kandidaat? */}
        <Blok titel="Status">
          <Regel label="Beoordeling"><RatingSelect id={candidate.id} value={candidate.rating} className="w-52" /></Regel>
          <Regel label="Beschikbaarheid">
            <div className="flex flex-wrap items-center gap-2">
              <AvailabilitySelect id={candidate.id} value={candidate.availability} className="w-52" />
              {candidate.availability === "BINNENKORT" && candidate.availableFrom && (
                <span className="text-xs text-ink-500">vanaf {formatDate(candidate.availableFrom)}</span>
              )}
            </div>
          </Regel>
          <Regel label="Interview met Q4S"><InterviewSelect id={candidate.id} value={candidate.interviewStatus} className="w-52" /></Regel>
          <Regel label="Spoor">
            <form action={setCandidateSpoor} className="flex gap-1.5">
              <input type="hidden" name="id" value={candidate.id} />
              {(["PROJECT", "VAST"] as const).map((s) => (
                <button key={s} type="submit" name="spoor" value={s} aria-pressed={spoorVan(candidate.spoor) === s} className={segmentVariants(spoorVan(candidate.spoor) === s, "h-7 text-xs")}>
                  {SPOOR[s].label}
                </button>
              ))}
            </form>
          </Regel>
          <Regel label="Cv">
            {candidate.cvFileName ? (
              <div className="flex flex-wrap items-center gap-2">
                <CvPreviewButton
                  src={`/api/cv/${candidate.id}`}
                  name={candidate.cvOriginalName ?? `CV ${`${candidate.firstName} ${candidate.lastName}`}`}
                  mime={candidate.cvMimeType ?? ""}
                  label="Bekijken"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                />
                <form action={laadCvIn}>
                  <input type="hidden" name="id" value={candidate.id} />
                  <SubmitButton size="sm" variant="outline" pendingLabel="Cv lezen…">
                    <FileDown className="h-4 w-4" /> Opnieuw inlezen
                  </SubmitButton>
                </form>
              </div>
            ) : (
              <Link href={`/kandidaten/${candidate.id}/cv`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <FileDown className="h-4 w-4" /> Cv toevoegen
              </Link>
            )}
          </Regel>
        </Blok>

        <Blok titel="Gegevens">
          <Regel label="Functie">{candidate.headline}</Regel>
          <Regel label="Discipline">{candidate.discipline ? labelFor(DISCIPLINES, candidate.discipline) : null}</Regel>
          <Regel label="Locatie">{candidate.location}</Regel>
          <Regel label="Telefoon">{candidate.phone && <a href={`tel:${candidate.phone}`} className="hover:underline">{candidate.phone}</a>}</Regel>
          <Regel label="E-mail">{candidate.email && <a href={`mailto:${candidate.email}`} className="hover:underline">{candidate.email}</a>}</Regel>
          <Regel label="LinkedIn">
            {candidate.linkedinUrl && (
              <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                Profiel <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
              </a>
            )}
          </Regel>
          <Regel label="Bron">{labelFor(CANDIDATE_SOURCES, candidate.source)}</Regel>
          <Regel label="Toegevoegd">{formatDate(candidate.createdAt)}</Regel>
        </Blok>

        {candidate.experienceSummary && candidate.experienceSummary.trim() && (
          <section className="rounded-lg border border-ink-200 bg-white">
            <h2 className="border-b border-ink-200 px-4 py-2.5 text-[13px] font-semibold text-ink-900">Werkervaring</h2>
            <div className="px-4 py-3 text-[13px]">
              <ExperienceView summary={candidate.experienceSummary} />
            </div>
          </section>
        )}

        {candidate.interviewStatus !== "NONE" && (
          <section className="rounded-lg border border-ink-200 bg-white">
            <h2 className="border-b border-ink-200 px-4 py-2.5 text-[13px] font-semibold text-ink-900">Interview met Q4S</h2>
            <form action={saveCandidateInterviewDetails} className="space-y-4 p-4">
              <input type="hidden" name="id" value={candidate.id} />
              <Field label="Datum interview" htmlFor="interviewDate">
                <Input id="interviewDate" name="interviewDate" type="date" className="max-w-[220px]" defaultValue={toDateInputValue(candidate.interviewDate)} />
              </Field>
              <Field label="Notities bij het interview" htmlFor="interviewNotes">
                <Textarea id="interviewNotes" name="interviewNotes" rows={5} defaultValue={candidate.interviewNotes ?? ""} placeholder="Bijv. sterke indruk, per direct beschikbaar, wil richting offshore…" />
              </Field>
              <div className="flex justify-end">
                <SubmitButton size="sm" pendingLabel="Opslaan…">Opslaan</SubmitButton>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
