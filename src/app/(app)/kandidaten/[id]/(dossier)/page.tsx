import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDate } from "@/lib/utils";
import { DISCIPLINES, CANDIDATE_SOURCES, CANDIDATE_AVAILABILITY } from "@/lib/domain";
import { InterviewSelect } from "../../InterviewSelect";
import { saveCandidateInterviewDetails } from "../../actions";
import { getCandidate } from "./data";

/** Eén label + waarde in het gegevens-raster. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink-900">{value || "—"}</dd>
    </div>
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
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
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
      {error === "foto" && <Fout>Kies een afbeelding om te uploaden.</Fout>}
      {error === "foto-groot" && <Fout>De foto is te groot (max. 5 MB).</Fout>}
      {error === "foto-type" && <Fout>Alleen JPG, PNG of WebP.</Fout>}

      {/* Gegevens */}
      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail
              label="Discipline"
              value={
                candidate.discipline ? (
                  <StatusBadge options={DISCIPLINES} value={candidate.discipline} />
                ) : null
              }
            />
            <Detail label="Headline" value={candidate.headline} />
            <Detail label="Locatie" value={candidate.location} />
            <Detail label="E-mail" value={candidate.email} />
            <Detail label="Telefoon" value={candidate.phone} />
            <Detail
              label="Bron"
              value={<StatusBadge options={CANDIDATE_SOURCES} value={candidate.source} />}
            />
            <Detail
              label="Beschikbaarheid"
              value={
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge options={CANDIDATE_AVAILABILITY} value={candidate.availability} />
                  {candidate.availability === "BINNENKORT" && candidate.availableFrom && (
                    <span className="text-xs text-ink-500">
                      vanaf {formatDate(candidate.availableFrom)}
                    </span>
                  )}
                </div>
              }
            />
            <Detail
              label="LinkedIn"
              value={
                candidate.linkedinUrl ? (
                  <a
                    href={candidate.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"
                  >
                    Profiel <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
                  </a>
                ) : null
              }
            />
            <Detail label="Toegevoegd" value={formatDate(candidate.createdAt)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interview met Q4S</CardTitle>
          <span className="text-sm text-ink-400">
            De kennismaking met Q4S — status, datum en wat er besproken is.
          </span>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Interview met Q4S */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Interview met Q4S
              </span>
              <InterviewSelect id={candidate.id} value={candidate.interviewStatus} />
            </div>

            {candidate.interviewStatus !== "NONE" && (
              <form
                action={saveCandidateInterviewDetails}
                className="space-y-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3"
              >
                <input type="hidden" name="id" value={candidate.id} />
                <div className="max-w-[220px]">
                  <Field label="Datum interview" htmlFor="interviewDate">
                    <Input
                      id="interviewDate"
                      name="interviewDate"
                      type="date"
                      defaultValue={toDateInputValue(candidate.interviewDate)}
                    />
                  </Field>
                </div>
                <Field label="Notities bij het interview" htmlFor="interviewNotes">
                  <Textarea
                    id="interviewNotes"
                    name="interviewNotes"
                    rows={3}
                    defaultValue={candidate.interviewNotes ?? ""}
                    placeholder="Bijv. sterke indruk, per direct beschikbaar, wil richting offshore…"
                  />
                </Field>
                <div className="flex justify-end">
                  <SubmitButton size="sm" pendingLabel="Opslaan…">
                    Opslaan
                  </SubmitButton>
                </div>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
