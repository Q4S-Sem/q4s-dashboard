import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, FileText, User, Printer, Palette } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { profileToData } from "@/lib/cv-doc";
import { formatDate } from "@/lib/utils";
import { CvSheet } from "@/components/cv/CvSheet";
import { loadCvSheet } from "@/lib/cv-render";
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
  // Zelfde bron als de printpagina, dus het voorbeeld hiernaast is precies wat
  // er uit de printer komt.
  const vel = await loadCvSheet(id);
  const backHref = profile.candidateId
    ? `/kandidaten/${profile.candidateId}`
    : "/socials/cv-generator";

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {profile.candidate
          ? `Terug naar ${profile.candidate.firstName} ${profile.candidate.lastName}`
          : "Terug naar de CV-generator"}
      </Link>

      <PageHeader
        title="Q4S-CV nakijken"
        description="De AI heeft dit uit het CV gelezen. Controleer het en pas aan — daarna download je het als PDF of Word."
        actions={
          <ConfirmSubmit
            action={deleteCvProfile}
            id={profile.id}
            message="Dit Q4S-CV-profiel verwijderen? Het originele CV-bestand blijft staan."
            variant="outline"
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
            <Link
              href={`/socials/cv-generator/${profile.id}/print`}
              className={buttonVariants()}
            >
              <Printer className="h-4 w-4" /> Printen / PDF
            </Link>
            <a
              href={`/socials/cv-generator/${profile.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <FileDown className="h-4 w-4" /> PDF-download
            </a>
            <a
              href={`/socials/cv-generator/${profile.id}/docx`}
              className={buttonVariants({ variant: "outline" })}
            >
              <FileDown className="h-4 w-4" /> Word
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

        {vel && (
          <div className="hidden xl:block xl:sticky xl:top-24">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-ink-900">Voorbeeld</span>
              <Link
                href="/gebruikers/cv-template"
                className="inline-flex items-center gap-1.5 text-[13px] text-ink-400 transition-colors hover:text-brand-600"
              >
                <Palette className="h-3.5 w-3.5" /> Vormgeving aanpassen
              </Link>
            </div>
            {/* 45% schaal: een A4 past zo naast het formulier zonder scrollen. */}
            <div className="h-[535px] w-[357px] overflow-hidden rounded-sm border border-ink-200 bg-white">
              <div className="origin-top-left scale-[0.45]">
                <CvSheet
                  doc={vel.doc}
                  template={vel.template}
                  logoSrc={vel.logoSrc}
                  photoSrc={vel.photoSrc}
                />
              </div>
            </div>
            <p className="mt-2 max-w-[357px] text-xs text-ink-400">
              Ververst na opslaan. Klik op &ldquo;Printen / PDF&rdquo; voor het vel op ware grootte.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
