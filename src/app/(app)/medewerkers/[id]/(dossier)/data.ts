import { cache } from "react";
import { db } from "@/lib/db";
import { round2 } from "@/lib/utils";

// Gedeelde queries van het medewerker-dossier. De kop (layout) en het geopende
// mapje vragen dezelfde medewerker op; `cache` dedupliceert dat binnen één
// request, dus het blijft één query.

export const getEmployee = cache(async (id: string) =>
  db.employee.findUnique({
    where: { id },
    include: {
      leaves: { orderBy: { startDate: "desc" } },
      bonuses: { orderBy: { date: "desc" } },
      reviews: { orderBy: { year: "desc" } },
      payslips: { orderBy: [{ year: "desc" }, { month: "desc" }] },
      documents: { orderBy: { createdAt: "desc" } },
      worklogs: { orderBy: { weekStart: "desc" } },
      detachering: {
        include: {
          placements: {
            orderBy: { startDate: "desc" },
            include: { client: { select: { companyName: true } } },
          },
        },
      },
    },
  }),
);

export type EmployeeDossier = NonNullable<Awaited<ReturnType<typeof getEmployee>>>;

/** Klanten voor de detacheer-keuzelijst. */
export const getClients = cache(async () =>
  db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
);

/** Aantal notities/taken — voor het mapje Notities. */
export const getNotesCount = cache(async (id: string) =>
  db.activity.count({ where: { entityType: "employee", entityId: id } }),
);

/** Kerncijfers over het lopende jaar: uren, vakantie, bonussen, loon. */
export function yearStats(m: EmployeeDossier, year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const inYear = <T extends { [k: string]: unknown }>(rows: T[], key: keyof T) =>
    rows.filter((r) => {
      const d = r[key] as Date;
      return d >= start && d < end;
    });

  const leaves = inYear(m.leaves, "startDate");
  const vakantieTaken = round2(
    leaves.filter((l) => l.type === "VAKANTIE").reduce((s, l) => s + l.days, 0),
  );
  const payslips = m.payslips.filter((p) => p.year === year);

  return {
    vakantieTaken,
    vakantieRest: round2(m.vacationDaysPerYear - vakantieTaken),
    vacPct:
      m.vacationDaysPerYear > 0
        ? Math.min(100, (vakantieTaken / m.vacationDaysPerYear) * 100)
        : 0,
    bonusTotal: round2(inYear(m.bonuses, "date").reduce((s, b) => s + b.amount, 0)),
    review: m.reviews.find((r) => r.year === year) ?? null,
    payslipsThisYear: payslips,
    brutoYear: round2(payslips.reduce((s, p) => s + p.grossAmount, 0)),
    nettoYear: round2(payslips.reduce((s, p) => s + p.netAmount, 0)),
    workedHoursYear: round2(inYear(m.worklogs, "weekStart").reduce((s, w) => s + w.hours, 0)),
  };
}
