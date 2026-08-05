import { notFound } from "next/navigation";
import { Clock, Plane, Gift, TrendingUp, Mail, Phone, IdCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { round2, formatCurrency, formatDate, formatHours } from "@/lib/utils";
import { EMPLOYEE_EMPLOYMENT_TYPES, labelFor } from "@/lib/domain";
import { getEmployee, yearStats } from "./data";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <div className="mt-1 break-words text-sm text-ink-900">{value || "—"}</div>
    </div>
  );
}

export default async function MedewerkerGegevensPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const m = await getEmployee(id);
  if (!m) notFound();

  const year = new Date().getFullYear();
  const s = yearStats(m, year);

  return (
    <div className="space-y-6">
      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze medewerker kan niet verwijderd worden zolang er gegevens aan gekoppeld zijn.
        </p>
      )}

      {/* HR-kerncijfers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Gewerkte uren (${year})`}
          value={formatHours(s.workedHoursYear)}
          sub={`${round2(m.hoursPerWeek)} u/week contract`}
          icon={<Clock className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label={`Vakantie opgenomen (${year})`}
          value={`${s.vakantieTaken} / ${round2(m.vacationDaysPerYear)}`}
          sub={`${s.vakantieRest} dagen resterend`}
          icon={<Plane className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label={`Bonussen (${year})`}
          value={formatCurrency(s.bonusTotal)}
          icon={<Gift className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Eindejaarsbeoordeling"
          value={s.review ? `${Math.round(s.review.scorePct)}%` : "—"}
          sub={`${year}`}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="green"
        />
      </div>

      {/* Verlofsaldo-balk */}
      <Card>
        <CardContent className="py-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-ink-700">Vakantiesaldo {year}</span>
            <span className="tabular-nums text-ink-500">
              {s.vakantieTaken} van {round2(m.vacationDaysPerYear)} dagen opgenomen ·{" "}
              <span className="font-semibold text-ink-900">{s.vakantieRest} resterend</span>
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${s.vacPct}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Persoons- en contractgegevens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-ink-500" /> Gegevens &amp; contract
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail
              label="E-mail"
              value={
                m.email ? (
                  <a
                    href={`mailto:${m.email}`}
                    className="inline-flex items-center gap-1.5 text-ink-700 hover:text-emerald-700 hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5 text-ink-400" /> {m.email}
                  </a>
                ) : null
              }
            />
            <Detail
              label="Telefoon"
              value={
                m.phone ? (
                  <a
                    href={`tel:${m.phone}`}
                    className="inline-flex items-center gap-1.5 text-ink-700 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5 text-ink-400" /> {m.phone}
                  </a>
                ) : null
              }
            />
            <Detail label="Dienstverband" value={labelFor(EMPLOYEE_EMPLOYMENT_TYPES, m.employmentType)} />
            <Detail label="Contractvorm" value={m.contractType} />
            <Detail label="In dienst sinds" value={m.startDate ? formatDate(m.startDate) : null} />
            <Detail label="Uit dienst" value={m.endDate ? formatDate(m.endDate) : null} />
            <Detail label="Uren per week" value={`${round2(m.hoursPerWeek)} u`} />
            <Detail
              label="Maandsalaris"
              value={m.monthlySalary > 0 ? formatCurrency(round2(m.monthlySalary)) : null}
            />
            <Detail label="Vakantierecht" value={`${round2(m.vacationDaysPerYear)} dagen/jaar`} />
            <Detail label="Pensioenregeling" value={m.pensionScheme} />
            <Detail label="Deelnemersnr. pensioen" value={m.pensionNumber} />
            <Detail label="Pensioen sinds" value={m.pensionStart ? formatDate(m.pensionStart) : null} />
            <Detail
              label="Pensioenbijdrage (wn / wg)"
              value={
                m.pensionEmployeePct != null || m.pensionEmployerPct != null
                  ? `${m.pensionEmployeePct ?? "—"}% / ${m.pensionEmployerPct ?? "—"}%`
                  : null
              }
            />
            <Detail label="Geboortedatum" value={m.dateOfBirth ? formatDate(m.dateOfBirth) : null} />
            <Detail label="BSN" value={m.bsn} />
            <Detail label="IBAN" value={m.iban} />
            <Detail
              label="Adres"
              value={
                m.address || m.city
                  ? `${m.address ?? ""}${m.address && (m.postalCode || m.city) ? ", " : ""}${m.postalCode ?? ""} ${m.city ?? ""}`.trim()
                  : null
              }
            />
            <Detail
              label="Noodcontact"
              value={
                m.emergencyName
                  ? `${m.emergencyName}${m.emergencyPhone ? ` · ${m.emergencyPhone}` : ""}`
                  : null
              }
            />
          </div>
          {m.notes && (
            <div className="mt-5 border-t border-ink-100 pt-4">
              <p className="whitespace-pre-wrap text-sm text-ink-600">{m.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
