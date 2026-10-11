import Link from "next/link";
import { Eye, EyeOff, FileDown, FileUp, FileUser, Search, Upload, Users } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/field";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { ZOEK_ICOON } from "@/components/ui/tabel-zoek";
import { person } from "@/lib/people";
import { formatDate } from "@/lib/utils";
import { UploadCvForm } from "../UploadCvForm";
import { profileFromCandidateCv, startCvProfile } from "../actions";
import { KandidaatCvKaart } from "../KandidaatCvKaart";

/**
 * Eén scherm: links een kandidaat kiezen (zoek op naam), rechts zelf een CV
 * erin slepen. Beide paden lezen het CV uit en sturen je door naar het
 * bewerk-scherm `[id]`. Daaronder de al gemaakte Q4S-CV's.
 */

export const metadata = { title: "CV-generator" };
export const dynamic = "force-dynamic";

const BASE = "/socials/cv-generator";

const FOUTEN: Record<string, string> = {
  "geen-cv": "Bij deze kandidaat staat geen CV in het dossier.",
  "cv-bestand": "Het CV-bestand is niet meer te openen. Upload het opnieuw bij de kandidaat.",
  uitlezen:
    "Het uitlezen van dit CV is mislukt. Controleer de AI-sleutel bij Instellingen, of sleep het CV rechts zelf erin.",
};

export default async function CvGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; fout?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  // Elk woord moet in voor-/achternaam of functie staan, zodat "jeroen roels"
  // werkt. Hoofdletterongevoelig.
  const woorden = q.split(/\s+/).filter(Boolean);
  const bevat = (w: string) => ({ contains: w, mode: "insensitive" as const });

  const [kandidaten, profiles] = await Promise.all([
    db.candidate.findMany({
      where: woorden.length
        ? {
            AND: woorden.map((w) => ({
              OR: [{ firstName: bevat(w) }, { lastName: bevat(w) }, { headline: bevat(w) }],
            })),
          }
        : {},
      select: {
        id: true,
        firstName: true,
        lastName: true,
        headline: true,
        photoFileName: true,
        cvFileName: true,
        cvOriginalName: true,
        cvProfile: { select: { id: true } },
      },
    }),
    db.cvProfile.findMany({
      include: { candidate: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Met CV eerst (daar kun je hier iets mee), dan op achternaam.
  kandidaten.sort(
    (a, b) =>
      (a.cvFileName ? 0 : 1) - (b.cvFileName ? 0 : 1) || a.lastName.localeCompare(b.lastName),
  );
  const terug = q ? `${BASE}?q=${encodeURIComponent(q)}` : BASE;

  return (
    <div className="space-y-6">
      {sp.fout && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {FOUTEN[sp.fout] ?? "Er ging iets mis bij het maken van het Q4S-CV."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Links: kandidaat kiezen */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-ink-400" /> Kies een kandidaat
            </CardTitle>
          </CardHeader>
          <div className="border-b border-ink-100 px-5 py-3">
            <AutoFilterForm basePath={BASE} className="relative">
              <Search className={ZOEK_ICOON} />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Typ een naam…"
                className="pl-9"
                aria-label="Kandidaat zoeken op naam"
                autoComplete="off"
              />
            </AutoFilterForm>
          </div>
          {kandidaten.length === 0 ? (
            <CardContent>
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title={q ? `Niemand gevonden voor "${q}"` : "Nog geen kandidaten"}
                description={q ? "Probeer een deel van de naam." : "Zet eerst kandidaten in de talentpool."}
              />
            </CardContent>
          ) : (
            <div className="max-h-[22rem] flex-1 divide-y divide-ink-100 overflow-y-auto overscroll-contain">
              {kandidaten.map((k) => {
                const info = (
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar {...person(k)} size="sm" className={k.cvFileName ? undefined : "opacity-60"} />
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-medium ${k.cvFileName ? "text-ink-900" : "text-ink-500"}`}
                      >
                        {k.firstName} {k.lastName}
                      </p>
                      <p className="truncate text-xs text-ink-400">
                        {k.cvFileName
                          ? (k.headline ?? k.cvOriginalName ?? "CV in dossier")
                          : "Geen CV in het dossier"}
                      </p>
                    </div>
                  </div>
                );
                return k.cvFileName ? (
                  <KandidaatCvKaart
                    key={k.id}
                    action={profileFromCandidateCv}
                    candidateId={k.id}
                    terug={terug}
                    opnieuw={Boolean(k.cvProfile)}
                    acties={
                      k.cvProfile ? (
                        <Link
                          href={`${BASE}/${k.cvProfile.id}`}
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          Openen
                        </Link>
                      ) : null
                    }
                  >
                    {info}
                  </KandidaatCvKaart>
                ) : (
                  <div key={k.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    {info}
                    <Link
                      href={`/kandidaten/${k.id}/cv`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      <FileUp className="h-4 w-4" /> CV toevoegen
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Rechts: zelf een CV erin zetten */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-ink-400" /> Of zet zelf een CV erin
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <UploadCvForm action={startCvProfile} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gemaakte Q4S-CV&apos;s</CardTitle>
        </CardHeader>
        {profiles.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<FileUser className="h-6 w-6" />}
              title="Nog geen Q4S-CV's"
              description="Kies hierboven een kandidaat of zet een CV erin."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Naam</TH>
                <TH>Functietitel</TH>
                <TH>Kandidaat</TH>
                <TH>Anoniem</TH>
                <TH>Bijgewerkt</TH>
                <TH>Download</TH>
              </TR>
            </THead>
            <TBody>
              {profiles.map((p) => (
                <TR key={p.id} className="cursor-pointer">
                  <TD>
                    {/* Hele rij klikbaar naar het bewerk-scherm; knoppen staan met z-10 erboven. */}
                    <Link
                      href={`${BASE}/${p.id}`}
                      className="absolute inset-0 z-0"
                      aria-label={`${p.fullName} bewerken`}
                    />
                    <span className="font-medium text-ink-900 group-hover:text-brand-700">
                      {p.fullName}
                    </span>
                  </TD>
                  <TD>{p.headline ?? "—"}</TD>
                  <TD>
                    {p.candidate ? (
                      <Link
                        href={`/kandidaten/${p.candidate.id}`}
                        className="relative z-10 text-ink-600 hover:text-brand-700"
                      >
                        {p.candidate.firstName} {p.candidate.lastName}
                      </Link>
                    ) : (
                      <span className="text-ink-400">Los CV</span>
                    )}
                  </TD>
                  <TD>
                    {p.anonymize ? (
                      <span className="inline-flex items-center gap-1.5 text-ink-600">
                        <EyeOff className="h-3.5 w-3.5 text-ink-400" /> Ja
                      </span>
                    ) : (
                      <span className="text-amber-700">Nee</span>
                    )}
                  </TD>
                  <TD>{formatDate(p.updatedAt)}</TD>
                  <TD>
                    <div className="relative z-10 flex gap-1.5">
                      <Link
                        href={`${BASE}/${p.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                        title="Voorbeeld bekijken"
                      >
                        <Eye className="h-3.5 w-3.5" /> Voorbeeld
                      </Link>
                      <a
                        href={`${BASE}/${p.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        <FileDown className="h-3.5 w-3.5" /> PDF
                      </a>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
