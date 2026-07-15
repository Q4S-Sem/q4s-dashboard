import Link from "next/link";
import { IdCard, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { round2, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EMPLOYEE_DEPARTMENTS, EMPLOYEE_EMPLOYMENT_TYPES } from "@/lib/domain";

export const metadata = { title: "Medewerkers" };
export const dynamic = "force-dynamic";

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}

export default async function MedewerkersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const employees = await db.employee.findMany({
    orderBy: [{ active: "desc" }, { firstName: "asc" }],
    include: {
      leaves: { where: { startDate: { gte: yearStart, lt: yearEnd } } },
      bonuses: { where: { date: { gte: yearStart, lt: yearEnd } } },
      reviews: { where: { year } },
    },
  });

  const rows = employees.map((m) => {
    const vakantieTaken = round2(
      m.leaves.filter((l) => l.type === "VAKANTIE").reduce((s, l) => s + l.days, 0),
    );
    const bonusYear = round2(m.bonuses.reduce((s, b) => s + b.amount, 0));
    const reviewPct = m.reviews[0]?.scorePct ?? null;
    return { m, vakantieTaken, bonusYear, reviewPct };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medewerkers"
        description="Het eigen Q4S-team: personeelsdossier, opgenomen verlof, bonussen en de eindejaarsbeoordeling."
        actions={
          <Link href="/medewerkers/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe medewerker
          </Link>
        }
      />

      {sp.error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze medewerker kan op dit moment niet verwijderd worden.
        </p>
      )}

      {employees.length === 0 ? (
        <EmptyState
          icon={<IdCard className="h-6 w-6" />}
          title="Nog geen medewerkers"
          description="Voeg het eigen Q4S-team toe om verlof, bonussen en beoordelingen bij te houden."
          action={
            <Link href="/medewerkers/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe medewerker
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Medewerker</TH>
                <TH>Afdeling</TH>
                <TH>Dienstverband</TH>
                <TH>Vakantie {year}</TH>
                <TH className="text-right">Bonus {year}</TH>
                <TH className="text-right">Beoordeling</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map(({ m, vakantieTaken, bonusYear, reviewPct }) => {
                const pct =
                  m.vacationDaysPerYear > 0
                    ? Math.min(100, (vakantieTaken / m.vacationDaysPerYear) * 100)
                    : 0;
                return (
                  <TR
                    key={m.id}
                    className={`relative cursor-pointer ${m.active ? "" : "opacity-60"}`}
                  >
                    <TD>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {initials(m.firstName, m.lastName)}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/medewerkers/${m.id}`}
                            className="font-medium text-slate-900 after:absolute after:inset-0 hover:text-emerald-700"
                          >
                            {m.firstName} {m.lastName}
                          </Link>
                          {m.jobTitle && (
                            <div className="truncate text-xs text-slate-400">{m.jobTitle}</div>
                          )}
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <StatusBadge options={EMPLOYEE_DEPARTMENTS} value={m.department} />
                    </TD>
                    <TD>
                      <StatusBadge options={EMPLOYEE_EMPLOYMENT_TYPES} value={m.employmentType} />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="whitespace-nowrap text-xs tabular-nums text-slate-500">
                          {vakantieTaken}/{round2(m.vacationDaysPerYear)} dgn
                        </span>
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums text-slate-700">
                      {bonusYear > 0 ? formatCurrency(bonusYear) : "—"}
                    </TD>
                    <TD className="text-right tabular-nums font-medium text-slate-900">
                      {reviewPct != null ? `${Math.round(reviewPct)}%` : <span className="text-slate-300">—</span>}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
