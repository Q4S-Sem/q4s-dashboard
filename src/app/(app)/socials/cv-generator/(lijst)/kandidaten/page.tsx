import Link from "next/link";
import { FileCheck2, FileX2, Search, Users } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { person } from "@/lib/people";
import { DISCIPLINES } from "@/lib/domain";
import { profileFromCandidateCv } from "../../actions";
import { KandidaatCvKaart } from "./KandidaatCvKaart";

/**
 * Zoek een kandidaat op naam en maak van het CV dat al in zijn dossier zit een
 * Q4S-CV. Scheelt het terugzoeken van hetzelfde bestand in je eigen mappen.
 *
 * Kandidaten zónder CV blijven in de lijst staan: als je op een naam zoekt en
 * die niet verschijnt, ga je twijfelen of de persoon wel bestaat. Nu zie je
 * meteen dat het dossier alleen nog geen CV heeft, met de weg ernaartoe.
 */

export const metadata = { title: "Kandidaten — CV-generator" };
export const dynamic = "force-dynamic";

const FOUTEN: Record<string, string> = {
  "geen-cv": "Bij deze kandidaat staat geen CV in het dossier.",
  "cv-bestand": "Het CV-bestand is niet meer te openen. Upload het opnieuw bij de kandidaat.",
  uitlezen:
    "Het uitlezen van dit CV is mislukt. Controleer de AI-sleutel bij Instellingen, of upload het CV los via het mapje hiernaast.",
};

export default async function CvGeneratorKandidatenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; fout?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";

  const kandidaten = await db.candidate.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { headline: { contains: q } },
            { discipline: { contains: q } },
            { location: { contains: q } },
          ],
        }
      : {},
    select: {
      id: true,
      firstName: true,
      lastName: true,
      headline: true,
      discipline: true,
      location: true,
      photoFileName: true,
      cvFileName: true,
      cvOriginalName: true,
      cvSize: true,
      cvProfile: { select: { id: true, updatedAt: true } },
    },
  });

  // Met CV eerst: dat zijn de enige waar je hier iets mee kunt. Daarbinnen op
  // achternaam, zodat dezelfde zoekopdracht altijd dezelfde volgorde geeft.
  kandidaten.sort((a, b) => {
    const ca = a.cvFileName ? 0 : 1;
    const cb = b.cvFileName ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return a.lastName.localeCompare(b.lastName);
  });

  const metCv = kandidaten.filter((k) => k.cvFileName).length;
  const terug = q
    ? `/socials/cv-generator/kandidaten?q=${encodeURIComponent(q)}`
    : "/socials/cv-generator/kandidaten";

  const labelVan = (d: string | null) =>
    d ? (DISCIPLINES.find((x) => x.value === d)?.label ?? d) : null;

  return (
    <div className="space-y-6">
      {sp.fout && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {FOUTEN[sp.fout] ?? "Er ging iets mis bij het maken van het Q4S-CV."}
        </p>
      )}

      <Card>
        <CardContent className="py-4">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Zoek op naam, functie, discipline of plaats…"
                className="pl-9"
                aria-label="Kandidaat zoeken"
                autoFocus
              />
            </div>
            <Button type="submit" variant="outline">
              Zoeken
            </Button>
            {q && (
              <Link
                href="/socials/cv-generator/kandidaten"
                className={buttonVariants({ variant: "ghost" })}
              >
                Wissen
              </Link>
            )}
          </form>
          <p className="mt-3 text-xs text-ink-500">
            {q
              ? `${kandidaten.length} kandidaat${kandidaten.length === 1 ? "" : "en"} gevonden, waarvan ${metCv} met een CV in het dossier.`
              : `${metCv} van de ${kandidaten.length} kandidaten heeft een CV in het dossier.`}
          </p>
        </CardContent>
      </Card>

      {kandidaten.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title={q ? `Niemand gevonden voor "${q}"` : "Nog geen kandidaten"}
              description={
                q
                  ? "Probeer een deel van de naam, of zoek op discipline."
                  : "Zet eerst kandidaten in de talentpool, dan kun je hun CV hier omzetten."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {kandidaten.map((k) => {
            const vak = labelVan(k.discipline);
            const regel = [k.headline, vak, k.location].filter(Boolean).join("  ·  ");

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
                      href={`/socials/cv-generator/${k.cvProfile.id}`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Q4S-CV openen
                    </Link>
                  ) : null
                }
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar {...person(k)} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">
                      {k.firstName} {k.lastName}
                    </p>
                    {regel && <p className="truncate text-sm text-ink-500">{regel}</p>}
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-400">
                      <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {k.cvOriginalName ?? "CV"}
                      {k.cvSize ? ` · ${Math.max(1, Math.round(k.cvSize / 1024))} kB` : ""}
                    </p>
                  </div>
                </div>
              </KandidaatCvKaart>
            ) : (
              <div
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar {...person(k)} size="md" className="opacity-60" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-500">
                      {k.firstName} {k.lastName}
                    </p>
                    {regel && <p className="truncate text-sm text-ink-400">{regel}</p>}
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400">
                      <FileX2 className="h-3.5 w-3.5 shrink-0" />
                      Geen CV in het dossier
                    </p>
                  </div>
                </div>
                <Link
                  href={`/kandidaten/${k.id}/cv`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  CV toevoegen
                </Link>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
