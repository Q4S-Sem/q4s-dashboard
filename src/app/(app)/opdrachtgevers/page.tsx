import Link from "next/link";
import { Building2, Plus, Briefcase, Kanban } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD, RowLink } from "@/components/ui/table";
import { DISCIPLINES } from "@/lib/domain";

export const metadata = { title: "Onze bedrijven" };
export const dynamic = "force-dynamic";

export default async function BedrijvenPage() {
  // Onze eigen klanten met hun openstaande vacatures en lopende deals.
  const clients = await db.client.findMany({
    orderBy: { companyName: "asc" },
    include: {
      vacancies: {
        where: { status: { not: "CONCEPT" } },
        select: { id: true, title: true, discipline: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { deals: { where: { status: "OPEN" } }, placements: true } },
    },
  });

  const totalOpenVacancies = clients.reduce((s, c) => s + c.vacancies.length, 0);
  const totalOpenDeals = clients.reduce((s, c) => s + c._count.deals, 0);
  const withOpenVacancy = clients.filter((c) => c.vacancies.length > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onze bedrijven"
        description="De klanten waar Q4S mensen plaatst — met hun openstaande vacatures en lopende deals. Zet vanuit de talentpool een kandidaat in de pipeline bij een van deze bedrijven."
        actions={
          <Link href="/klanten/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw bedrijf
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Bedrijven" value={clients.length} icon={<Building2 className="h-5 w-5" />} accent="brand" />
        <StatCard label="Openstaande vacatures" value={totalOpenVacancies} icon={<Briefcase className="h-5 w-5" />} accent="green" />
        <StatCard label="Lopende deals" value={totalOpenDeals} icon={<Kanban className="h-5 w-5" />} accent="violet" />
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Nog geen bedrijven"
          description="Voeg je eerste klant toe; daarna kun je er vacatures en kandidaten aan koppelen."
          action={
            <Link href="/klanten/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuw bedrijf
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-xs text-ink-400">
            {withOpenVacancy} van de {clients.length} bedrijven met een openstaande vacature
          </p>
          <Card>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Bedrijf</TH>
                  <TH>Openstaande vacatures</TH>
                  <TH className="text-right">Lopende deals</TH>
                  <TH className="text-right">Plaatsingen</TH>
                </TR>
              </THead>
              <TBody>
                {clients.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <RowLink href={`/klanten/${c.id}`}>{c.companyName}</RowLink>
                      {c.city && <p className="text-xs text-ink-400">{c.city}</p>}
                    </TD>
                    <TD>
                      {c.vacancies.length === 0 ? (
                        <span className="text-sm text-ink-400">—</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.vacancies.slice(0, 3).map((v) => (
                            <Link
                              key={v.id}
                              href={`/vacatures/${v.id}`}
                              className="inline-flex items-center gap-1.5 rounded-sm border border-ink-200 bg-white px-2 py-0.5 text-xs text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50"
                              title={v.title}
                            >
                              <Briefcase className="h-3 w-3 text-ink-400" />
                              <span className="max-w-[180px] truncate">{v.title}</span>
                              {v.discipline && (
                                <StatusBadge options={DISCIPLINES} value={v.discipline} />
                              )}
                            </Link>
                          ))}
                          {c.vacancies.length > 3 && (
                            <span className="text-xs text-ink-400">+{c.vacancies.length - 3}</span>
                          )}
                        </div>
                      )}
                    </TD>
                    <TD className="text-right">
                      {c._count.deals > 0 ? (
                        <Badge color="violet">{c._count.deals}</Badge>
                      ) : (
                        <span className="text-sm text-ink-400">0</span>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums text-ink-600">{c._count.placements}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
