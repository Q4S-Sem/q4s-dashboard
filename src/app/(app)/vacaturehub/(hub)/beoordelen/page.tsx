import { Filter } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { bulkFilterVacancies } from "../../actions";
import { getHubCounts } from "../data";
import { HubVacancyList, HUB_VACANCY_SELECT, toHubVacancies } from "../HubVacancyList";

export const metadata = { title: "Te beoordelen · Vacaturehub" };

type SP = { filtered?: string; remaining?: string; error?: string };

export default async function BeoordelenPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [c, rows] = await Promise.all([
    getHubCounts(),
    db.vacancy.findMany({
      where: { relevance: "UNKNOWN" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: HUB_VACANCY_SELECT,
    }),
  ]);

  return (
    <div className="space-y-6">
      {sp.error === "ai" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          De AI-actie is niet gelukt. Controleer de sleutel bij Instellingen › API-sleutels.
        </p>
      )}
      {sp.filtered !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.filtered} vacature(s) beoordeeld · {sp.remaining} nog te gaan.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-amber-500" /> Nog te beoordelen
            <span className="text-sm font-normal text-ink-400">({c.unknown})</span>
          </CardTitle>
          <form action={bulkFilterVacancies}>
            <input type="hidden" name="back" value="/vacaturehub/beoordelen" />
            <SubmitButton pendingLabel="AI beoordeelt…" disabled={c.unknown === 0}>
              <Filter className="h-4 w-4" /> Laat AI de eerste 10 doen
            </SubmitButton>
          </form>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500">
            De AI kijkt of een vacature binnen de Q4S-niche valt en schrijft erbij waarom. Ben je
            het er niet mee eens, of wil je niet wachten? Beoordeel zelf met “Past bij ons” of
            “Niet passend”.
          </p>
        </CardContent>
      </Card>

      <HubVacancyList
        vacancies={toHubVacancies(rows)}
        mode="judge"
        back="/vacaturehub/beoordelen"
        emptyTitle="Alles is beoordeeld"
        emptyDescription="Er staan geen nieuwe vacatures meer in de wachtrij. Nieuwe instroom verschijnt hier vanzelf."
      />
    </div>
  );
}
