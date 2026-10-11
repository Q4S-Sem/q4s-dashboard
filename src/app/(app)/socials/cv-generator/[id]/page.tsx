import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, User, Printer } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { profileToData } from "@/lib/cv-doc";
import { formatDate } from "@/lib/utils";
import { CvProfileForm } from "../CvProfileForm";
import { deleteCvProfile, saveCvProfile } from "../actions";

export const metadata = { title: "Q4S-CV nakijken" };

export default async function CvProfileReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ opgeslagen?: string }>;
}) {
  const { id } = await params;
  const { opgeslagen } = await searchParams;

  const profile = await db.cvProfile.findUnique({
    where: { id },
    include: { candidate: true },
  });
  if (!profile) notFound();

  const data = profileToData(profile);
  // Terug = altijd de generator, ook bij een kandidaat (niet het dossier in Recruitment).
  const backHref = "/socials/cv-generator";

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Terug naar de CV-generator
      </Link>

      <PageHeader
        title="Q4S-CV nakijken"
        description="De AI heeft dit uit het CV gelezen. Controleer het en pas aan — daarna download je het als PDF."
        actions={
          <ConfirmSubmit
            action={deleteCvProfile}
            id={profile.id}
            message="Dit Q4S-CV-profiel verwijderen? Het originele CV-bestand blijft staan."
            trigger="icon"
            iconClassName="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Verwijderen
          </ConfirmSubmit>
        }
      />

      {opgeslagen === "1" && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Opgeslagen. Download hieronder het bijgewerkte CV.
        </p>
      )}

      {/* Downloads + herkomst */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 text-sm text-ink-500">
              {profile.candidate ? (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4 text-ink-400" />
                  <Link
                    href={`/kandidaten/${profile.candidateId}`}
                    className="font-medium text-ink-900 hover:text-brand-700"
                  >
                    {profile.candidate.firstName} {profile.candidate.lastName}
                  </Link>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4 text-ink-400" /> Los CV (geen kandidaat)
                </span>
              )}
              {profile.sourceOriginalName && (
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-ink-400" />
                  uit {profile.sourceOriginalName}
                </span>
              )}
              <span>· bijgewerkt {formatDate(profile.updatedAt)}</span>
            </div>
            <p className="text-xs text-ink-400">
              De download geeft altijd de laatst opgeslagen versie — sla eerst je wijzigingen op.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/socials/cv-generator/${profile.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants()}
            >
              <Printer className="h-4 w-4" /> PDF openen / printen
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Links bewerken, rechts meteen zien wat eruit rolt. Het voorbeeld is
          hetzelfde vel als de printpagina, op schaal. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <CvProfileForm
          action={saveCvProfile}
          profileId={profile.id}
          data={data}
          anonymize={profile.anonymize}
          cancelHref={backHref}
        />

        {/* Het voorbeeld IS de PDF: per A4 opgemaakt, met kop en paginanummer op
            elke pagina. De key ververst hem na opslaan. */}
        <div className="hidden xl:block xl:sticky xl:top-24">
          <p className="mb-2 text-[13px] font-semibold text-ink-900">Voorbeeld</p>
          <iframe
            key={profile.updatedAt.getTime()}
            src={`/socials/cv-generator/${profile.id}/pdf#toolbar=0&navpanes=0&view=FitH`}
            title="Voorbeeld van het Q4S-CV"
            className="h-[640px] w-[460px] rounded-sm border border-ink-200 bg-white"
          />
          <p className="mt-2 max-w-[460px] text-xs text-ink-400">
            Ververst na opslaan. Scroll in het voorbeeld voor de volgende pagina.
          </p>
        </div>
      </div>
    </div>
  );
}
