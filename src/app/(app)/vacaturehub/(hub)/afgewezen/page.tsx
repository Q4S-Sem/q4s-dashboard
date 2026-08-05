import { XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHubCounts } from "../data";
import { HubVacancyList, HUB_VACANCY_SELECT, toHubVacancies } from "../HubVacancyList";

export const metadata = { title: "Afgewezen · Vacaturehub" };

export default async function AfgewezenPage() {
  const [c, rows] = await Promise.all([
    getHubCounts(),
    db.vacancy.findMany({
      where: { relevance: "IRRELEVANT" },
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
            <XCircle className="h-5 w-5 text-slate-400" /> Buiten de niche
            <span className="text-sm font-normal text-slate-400">({c.irrelevant})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Deze vacatures vallen volgens de beoordeling buiten wat Q4S doet. Bij elke regel staat
            de reden. Ben je het er niet mee eens, zet hem dan terug in de wachtrij — dan beoordeel
            je hem opnieuw.
          </p>
        </CardContent>
      </Card>

      <HubVacancyList
        vacancies={toHubVacancies(rows)}
        mode="rejected"
        back="/vacaturehub/afgewezen"
        emptyTitle="Nog niets afgewezen"
        emptyDescription="Zodra een vacature buiten de niche valt, komt hij hier terecht."
      />
    </div>
  );
}
