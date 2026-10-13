import { XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHubCounts, MSP_WHERE } from "../data";
import { HubVacancyList, HUB_VACANCY_SELECT, toHubVacancies } from "../HubVacancyList";

export const metadata = { title: "Weggelegd · MSP" };

export default async function AfgewezenPage() {
  const [c, rows] = await Promise.all([
    getHubCounts(),
    db.vacancy.findMany({
      where: { ...MSP_WHERE, relevance: "IRRELEVANT" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: HUB_VACANCY_SELECT,
    }),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-ink-400" /> Weggelegd
            <span className="text-sm font-normal text-ink-400">({c.irrelevant})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500">
            Door de AI of door jullie weggelegd, met de reden erbij. Toch interessant? Haal hem
            terug, dan staat hij weer bij Te beoordelen.
          </p>
        </CardContent>
      </Card>

      <HubVacancyList
        vacancies={toHubVacancies(rows)}
        mode="rejected"
        back="/vacaturehub/afgewezen"
        emptyTitle="Nog niets weggelegd"
        emptyDescription="Wat niet bij Q4S past, komt hier terecht."
      />
    </div>
  );
}
