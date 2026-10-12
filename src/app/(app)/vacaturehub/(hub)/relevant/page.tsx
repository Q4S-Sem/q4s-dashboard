import Link from "next/link";
import { Sparkles, PencilLine } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants, SEGMENT_GROEP, segmentVariants } from "@/components/ui/button";
import { getHubCounts } from "../data";
import { HubVacancyList, HUB_VACANCY_SELECT, toHubVacancies } from "../HubVacancyList";

export const metadata = { title: "Opgepakt · MSP" };

type SP = { published?: string; remaining?: string; error?: string; tab?: string };

export default async function RelevantPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const showLive = sp.tab === "live";

  const [c, rows] = await Promise.all([
    getHubCounts(),
    db.vacancy.findMany({
      where: {
        relevance: "RELEVANT",
        // Opgepakt = uit de inbox gehaald: uitgeschreven (Gereed) of live.
        status: showLive ? "PUBLISHED" : { notIn: ["PUBLISHED", "CONCEPT"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: HUB_VACANCY_SELECT,
    }),
  ]);

  const back = `/vacaturehub/relevant${showLive ? "?tab=live" : ""}`;

  return (
    <div className="space-y-6">
      {sp.error === "ai" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          De AI-actie is niet gelukt. Controleer de sleutel bij Instellingen › API-sleutels.
        </p>
      )}
      {sp.published !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.published} vacature(s) uitgeschreven en gepubliceerd · {sp.remaining} nog te doen.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" /> Opgepakt
            <span className="text-sm font-normal text-ink-400">({c.opgepakt})</span>
          </CardTitle>
          <Link href="/vacatures" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilLine className="h-4 w-4" /> Naar maken
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-500">
            Leads die jullie hebben opgepakt. De AI heeft ze uitgeschreven; controleer de tekst en
            zet ze op q4s.nl en LinkedIn.
          </p>
          <div className={SEGMENT_GROEP}>
            <Link
              href="/vacaturehub/relevant"
              className={segmentVariants(!showLive)}
            >
              Te controleren
            </Link>
            <Link
              href="/vacaturehub/relevant?tab=live"
              className={segmentVariants(showLive)}
            >
              Live op de site ({c.published})
            </Link>
          </div>
        </CardContent>
      </Card>

      <HubVacancyList
        vacancies={toHubVacancies(rows)}
        mode="publish"
        back={back}
        emptyTitle={showLive ? "Nog niets live" : "Niets te controleren"}
        emptyDescription={
          showLive
            ? "Zodra je een relevante vacature publiceert, staat hij hier."
            : "Pak een lead op vanuit Te beoordelen; hij komt dan hier te staan."
        }
      />
    </div>
  );
}
