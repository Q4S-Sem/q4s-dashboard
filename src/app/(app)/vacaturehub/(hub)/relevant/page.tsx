import Link from "next/link";
import { Sparkles, PencilLine } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getHubCounts } from "../data";
import { HubVacancyList, HUB_VACANCY_SELECT, toHubVacancies } from "../HubVacancyList";

export const metadata = { title: "Relevant · Vacaturehub" };

type SP = { published?: string; remaining?: string; error?: string; tab?: string };

export default async function RelevantPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const showLive = sp.tab === "live";

  const [c, rows] = await Promise.all([
    getHubCounts(),
    db.vacancy.findMany({
      where: {
        relevance: "RELEVANT",
        status: showLive ? "PUBLISHED" : { not: "PUBLISHED" },
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
            <Sparkles className="h-5 w-5 text-violet-500" /> Past bij Q4S
            <span className="text-sm font-normal text-slate-400">({c.relevant})</span>
          </CardTitle>
          <Link href="/vacatures" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilLine className="h-4 w-4" /> Naar maken
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Deze vacatures passen binnen de niche. Stuur ze door naar Maken: daar schrijf je de
            tekst af (of laat je de AI dat doen), lees je 'm na en zet je 'm zelf op q4s.nl.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href="/vacaturehub/relevant"
              className={
                showLive
                  ? "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  : "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
              }
            >
              Klaar voor maken ({c.toPublish})
            </Link>
            <Link
              href="/vacaturehub/relevant?tab=live"
              className={
                showLive
                  ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              }
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
        emptyTitle={showLive ? "Nog niets live" : "Niets meer te publiceren"}
        emptyDescription={
          showLive
            ? "Zodra je een relevante vacature publiceert, staat hij hier."
            : "Alle relevante vacatures staan al op de website."
        }
      />
    </div>
  );
}
