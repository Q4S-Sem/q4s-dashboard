import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Upload,
  FileText,
  FileUser,
  FileDown,
  EyeOff,
  ExternalLink,
  Sparkles,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field } from "@/components/ui/field";
import { formatDate } from "@/lib/utils";
import { uploadCv, deleteCv } from "../../../actions";
import { profileFromCandidateCv } from "../../../../socials/cv-generator/actions";
import { getCandidate } from "../data";

/** Foutmelding die via ?error=... terugkomt van een server-action. */
function Fout({ children }: { children: React.ReactNode }) {
  return <p className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700">{children}</p>;
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function CvTab({
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
      {error === "upload" && <Fout>Kies een bestand om te uploaden.</Fout>}
      {error === "size" && <Fout>Het bestand is te groot (max. 15 MB).</Fout>}
      {error === "geen-cv" && (
        <Fout>Er staat nog geen CV bij deze kandidaat — upload er eerst een.</Fout>
      )}
      {error === "cv-bestand" && (
        <Fout>Het CV-bestand kon niet geopend worden. Upload het CV opnieuw.</Fout>
      )}
      {error === "uitlezen" && (
        <Fout>
          Dit CV kon niet uitgelezen worden. Probeer het via de{" "}
          <Link href="/socials/cv-generator" className="font-medium underline">
            CV-generator
          </Link>{" "}
          — daar zie je precies wat er misging.
        </Fout>
      )}

      {/* CV */}
      <Card>
        <CardHeader>
          <CardTitle>CV</CardTitle>
        </CardHeader>
        {candidate.cvFileName ? (
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={`/api/cv/${candidate.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-ink-900 hover:text-brand-700"
            >
              <FileText className="h-4 w-4 text-ink-400" />
              {candidate.cvOriginalName ?? "CV"}
              {candidate.cvSize != null && (
                <span className="text-sm font-normal text-ink-400">
                  ({fileSize(candidate.cvSize)})
                </span>
              )}
              <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
            </a>
            <ConfirmSubmit
              action={deleteCv}
              id={candidate.id}
              message="CV verwijderen?"
              variant="ghost"
            >
              Verwijderen
            </ConfirmSubmit>
          </CardContent>
        ) : (
          <CardContent>
            <form
              action={uploadCv}
              className="grid items-end gap-3 sm:grid-cols-12"
            >
              <input type="hidden" name="candidateId" value={candidate.id} />
              <Field label="Bestand" htmlFor="cv-file" className="sm:col-span-9">
                <input
                  id="cv-file"
                  name="file"
                  type="file"
                  required
                  aria-label="CV kiezen"
                  title="CV kiezen"
                  className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-ink-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-ink-800"
                />
              </Field>
              <div className="sm:col-span-3">
                <SubmitButton className="w-full" pendingLabel="Uploaden…">
                  <Upload className="h-4 w-4" /> Upload CV
                </SubmitButton>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Q4S-CV — het opgemaakte CV dat naar opdrachtgevers gaat */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUser className="h-4 w-4 text-ink-400" /> Q4S-CV
          </CardTitle>
          <span className="text-sm text-ink-400">
            Het CV in Q4S-opmaak met ons logo — klaar om naar een opdrachtgever te sturen.
          </span>
        </CardHeader>
        <CardContent>
          {candidate.cvProfile ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-ink-500">
                Gemaakt · bijgewerkt {formatDate(candidate.cvProfile.updatedAt)}
                {candidate.cvProfile.anonymize ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-ink-600">
                    <EyeOff className="h-3.5 w-3.5 text-ink-400" /> geanonimiseerd
                  </span>
                ) : (
                  <span className="ml-2 text-amber-700">volledige gegevens</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/socials/cv-generator/${candidate.cvProfile.id}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Pencil className="h-4 w-4" /> Nakijken
                </Link>
                <a
                  href={`/socials/cv-generator/${candidate.cvProfile.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants()}
                >
                  <FileDown className="h-4 w-4" /> PDF
                </a>
                <a
                  href={`/socials/cv-generator/${candidate.cvProfile.id}/docx`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <FileDown className="h-4 w-4" /> Word
                </a>
              </div>
            </div>
          ) : candidate.cvFileName ? (
            <form
              action={profileFromCandidateCv}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <input type="hidden" name="candidateId" value={candidate.id} />
              <p className="text-sm text-ink-500">
                Laat de AI het CV hierboven uitlezen; daarna kun je het nakijken en als Q4S-CV
                downloaden.
              </p>
              <SubmitButton pendingLabel="AI leest CV…">
                <Sparkles className="h-4 w-4" /> Q4S-CV maken
              </SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-ink-500">
              Upload eerst een CV hierboven — daarna kan de generator er een Q4S-CV van maken.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
