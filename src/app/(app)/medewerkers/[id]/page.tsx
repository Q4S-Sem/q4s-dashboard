import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Plane,
  Gift,
  TrendingUp,
  Trash2,
  Plus,
  Mail,
  Phone,
  Wallet,
  FileText,
  ExternalLink,
  Clock,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import { round2, formatCurrency, formatDate, formatHours, formatWeekLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { certStatus, CERT_STATUS_META } from "@/lib/evaluaties";
import { isVisionConfigured } from "@/lib/ai";
import { DocUploadForm } from "./DocUploadForm";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  LEAVE_TYPES,
  BONUS_TYPES,
  DISCIPLINES,
  PLACEMENT_STATUSES,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_EMPLOYMENT_TYPES,
  EMPLOYEE_DOC_CATEGORIES,
  MAANDEN,
  labelFor,
} from "@/lib/domain";
import {
  deleteEmployee,
  detachEmployee,
  addLeave,
  deleteLeave,
  addBonus,
  deleteBonus,
  saveReview,
  addPayslip,
  deletePayslip,
  deleteDocument,
  addWorklog,
  deleteWorklog,
} from "../actions";
import { getActivities } from "@/lib/activities";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export const metadata = { title: "Medewerker" };
export const dynamic = "force-dynamic";

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 text-sm text-slate-900">{value || "—"}</div>
    </div>
  );
}

export default async function MedewerkerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const now = new Date();
  const year = now.getFullYear();
  const aiReady = isVisionConfigured();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const m = await db.employee.findUnique({
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
  });
  if (!m) notFound();

  const [activities, clients] = await Promise.all([
    getActivities("employee", m.id),
    db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
  ]);
  const detacheringen = m.detachering?.placements ?? [];

  const leavesThisYear = m.leaves.filter(
    (l) => l.startDate >= yearStart && l.startDate < yearEnd,
  );
  const daysOf = (type: string) =>
    round2(leavesThisYear.filter((l) => l.type === type).reduce((s, l) => s + l.days, 0));
  const vakantieTaken = daysOf("VAKANTIE");
  const vakantieRest = round2(m.vacationDaysPerYear - vakantieTaken);
  const vacPct =
    m.vacationDaysPerYear > 0
      ? Math.min(100, (vakantieTaken / m.vacationDaysPerYear) * 100)
      : 0;

  const bonusesThisYear = m.bonuses.filter((b) => b.date >= yearStart && b.date < yearEnd);
  const bonusTotal = round2(bonusesThisYear.reduce((s, b) => s + b.amount, 0));

  const reviewThisYear = m.reviews.find((r) => r.year === year);

  const payslipsThisYear = m.payslips.filter((p) => p.year === year);
  const brutoYear = round2(payslipsThisYear.reduce((s, p) => s + p.grossAmount, 0));
  const nettoYear = round2(payslipsThisYear.reduce((s, p) => s + p.netAmount, 0));

  const worklogsThisYear = m.worklogs.filter((w) => w.weekStart >= yearStart && w.weekStart < yearEnd);
  const workedHoursYear = round2(worklogsThisYear.reduce((s, w) => s + w.hours, 0));

  return (
    <div className="space-y-6">
      <Link
        href="/medewerkers"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar medewerkers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600">
            {initials(m.firstName, m.lastName)}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {m.firstName} {m.lastName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {m.jobTitle && <span>{m.jobTitle}</span>}
              <StatusBadge options={EMPLOYEE_DEPARTMENTS} value={m.department} />
              <StatusBadge options={EMPLOYEE_EMPLOYMENT_TYPES} value={m.employmentType} />
              {!m.active && <span className="text-slate-400">· uit dienst</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/medewerkers/${m.id}/bewerken`} className={buttonVariants({ variant: "outline" })}>
            <Pencil className="h-4 w-4" /> Bewerken
          </Link>
          <ConfirmSubmit
            action={deleteEmployee}
            id={m.id}
            message={`Medewerker "${m.firstName} ${m.lastName}" verwijderen? Verlof, bonussen en beoordelingen gaan mee.`}
          >
            Verwijderen
          </ConfirmSubmit>
        </div>
      </div>

      {error === "date" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Vul een geldige startdatum in voor het verlof.
        </p>
      )}
      {error === "upload" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kies een bestand om te uploaden.
        </p>
      )}
      {error === "size" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Het bestand is te groot (max. 15 MB).
        </p>
      )}
      {error === "detach" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Kies een klant en vul een functie in om te detacheren.
        </p>
      )}

      {/* HR-kerncijfers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Gewerkte uren (${year})`}
          value={formatHours(workedHoursYear)}
          sub={`${round2(m.hoursPerWeek)} u/week contract`}
          icon={<Clock className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label={`Vakantie opgenomen (${year})`}
          value={`${vakantieTaken} / ${round2(m.vacationDaysPerYear)}`}
          sub={`${vakantieRest} dagen resterend`}
          icon={<Plane className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard label={`Bonussen (${year})`} value={formatCurrency(bonusTotal)} icon={<Gift className="h-5 w-5" />} accent="violet" />
        <StatCard
          label="Eindejaarsbeoordeling"
          value={reviewThisYear ? `${Math.round(reviewThisYear.scorePct)}%` : "—"}
          sub={`${year}`}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="green"
        />
      </div>

      {/* Verlofsaldo-balk */}
      <Card>
        <CardContent className="py-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Vakantiesaldo {year}</span>
            <span className="tabular-nums text-slate-500">
              {vakantieTaken} van {round2(m.vacationDaysPerYear)} dagen opgenomen ·{" "}
              <span className="font-semibold text-slate-900">{vakantieRest} resterend</span>
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${vacPct}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Detachering — eigen medewerker uitlenen aan een klant */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-slate-500" /> Detachering
          </CardTitle>
          <span className="text-sm text-slate-500">
            Loondienst → wél klantfactuur, géén inkoopfactuur (salaris).
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          {detacheringen.length > 0 && (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Klant</TH>
                  <TH>Functie / locatie</TH>
                  <TH className="text-right">Tarief/u</TH>
                  <TH>Status</TH>
                  <TH className="text-right"><span className="sr-only">Acties</span></TH>
                </TR>
              </THead>
              <TBody>
                {detacheringen.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-medium text-slate-900">{p.client.companyName}</TD>
                    <TD className="text-slate-600">
                      {p.title}
                      {p.workLocation ? ` · ${p.workLocation}` : ""}
                    </TD>
                    <TD className="text-right tabular-nums">{formatCurrency(round2(p.chargeRate))}</TD>
                    <TD><StatusBadge options={PLACEMENT_STATUSES} value={p.status} /></TD>
                    <TD className="text-right">
                      <Link
                        href={`/plaatsingen/${p.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                      >
                        Openen <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          {clients.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Nog geen klanten. Voeg eerst een{" "}
              <Link href="/klanten/nieuw" className="font-medium underline">klant</Link> toe om te kunnen detacheren.
            </p>
          ) : (
            <form action={detachEmployee} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="employeeId" value={m.id} />
              <Field label="Klant" htmlFor="det-client">
                <SearchSelect
                  id="det-client"
                  name="clientId"
                  options={clients.map((c) => ({ value: c.id, label: c.companyName }))}
                  placeholder="Typ een bedrijf…"
                  emptyText="Geen bedrijf gevonden."
                />
              </Field>
              <Field label="Functie / rol" htmlFor="det-title">
                <Input id="det-title" name="title" required placeholder="Bijv. QC-inspecteur L2" />
              </Field>
              <Field label="Discipline" htmlFor="det-disc">
                <Select id="det-disc" name="discipline" defaultValue="OVERIG">
                  {DISCIPLINES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Werklocatie" htmlFor="det-loc">
                <Input id="det-loc" name="workLocation" placeholder="Bijv. Sif Group HKW8" />
              </Field>
              <Field label="Verkooptarief €/u (klant)" htmlFor="det-charge">
                <Input id="det-charge" name="chargeRate" type="number" min={0} step="0.01" required />
              </Field>
              <Field label="Loonkost €/u (intern, marge)" htmlFor="det-cost">
                <Input id="det-cost" name="costRate" type="number" min={0} step="0.01" placeholder="0" />
              </Field>
              <Field label="Weekendtoeslag klant %" htmlFor="det-we">
                <Input id="det-we" name="weekendSurchargeSell" type="number" min={0} step="1" placeholder="0" />
              </Field>
              <Field label="Overurentoeslag klant %" htmlFor="det-ot">
                <Input id="det-ot" name="overtimeSurchargeSell" type="number" min={0} step="1" placeholder="0" />
              </Field>
              <Field label="Km-vergoeding klant €/km" htmlFor="det-km">
                <Input id="det-km" name="kmRateSell" type="number" min={0} step="0.01" placeholder="0" />
              </Field>
              <Field label="Startdatum" htmlFor="det-start">
                <Input id="det-start" name="startDate" type="date" />
              </Field>
              <div className="flex items-end sm:col-span-2 lg:col-span-2 lg:justify-end">
                <SubmitButton className="w-full lg:w-auto" pendingLabel="Detacheren…">
                  <Briefcase className="h-4 w-4" /> Detacheer naar klant
                </SubmitButton>
              </div>
            </form>
          )}

          <p className="text-xs text-slate-400">
            Overuren worden aan de klant gefactureerd (toeslag) en aan {m.firstName} als loon uitbetaald volgens
            contract — er komt <span className="font-medium">géén inkoopfactuur</span>. De loonkost/uur is puur
            voor de margeweergave; het salaris zit al in de eigen loonkosten.
          </p>
        </CardContent>
      </Card>

      {/* Gewerkte uren — eigen urenregistratie */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-500" /> Gewerkte uren
          </CardTitle>
          {workedHoursYear > 0 && (
            <span className="text-sm text-slate-500">
              {year}: <span className="font-medium text-slate-900">{formatHours(workedHoursYear)}</span> gewerkt
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={addWorklog} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="employeeId" value={m.id} />
            <Field label="Week (kies een dag)" htmlFor="wl-week">
              <Input id="wl-week" name="week" type="date" required title="Kies een dag in de week — wordt op de maandag vastgelegd" />
            </Field>
            <Field label="Gewerkte uren" htmlFor="wl-hours">
              <Input id="wl-hours" name="hours" type="number" min={0} step="0.25" required />
            </Field>
            <Field label="Notitie" htmlFor="wl-notes">
              <Input id="wl-notes" name="notes" placeholder="Optioneel" />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Opslaan…">
              <Plus className="h-4 w-4" /> Toevoegen
            </SubmitButton>
          </form>

          {m.worklogs.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">
              Nog geen uren geregistreerd. Voer per week de gewerkte uren in — het totaal verschijnt bovenaan.
            </p>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Week</TH>
                  <TH className="text-right">Uren</TH>
                  <TH>Notitie</TH>
                  <TH className="text-right"><span className="sr-only">Acties</span></TH>
                </TR>
              </THead>
              <TBody>
                {m.worklogs.map((w) => (
                  <TR key={w.id}>
                    <TD className="text-slate-700">
                      {formatWeekLabel(w.weekStart)} · {formatDate(w.weekStart)}
                    </TD>
                    <TD className="text-right tabular-nums font-medium text-slate-900">
                      {formatHours(round2(w.hours))}
                    </TD>
                    <TD className="text-slate-500">{w.notes ?? "—"}</TD>
                    <TD className="text-right">
                      <ConfirmSubmit
                        action={deleteWorklog}
                        id={w.id}
                        hidden={{ employeeId: m.id }}
                        message="Urenregel verwijderen?"
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Verlof */}
      <Card>
        <CardHeader>
          <CardTitle>Verlof &amp; ziekte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={addLeave} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="employeeId" value={m.id} />
            <Field label="Type" htmlFor="leave-type">
              <Select id="leave-type" name="type" defaultValue="VAKANTIE">
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Van" htmlFor="leave-start">
              <Input id="leave-start" name="startDate" type="date" required />
            </Field>
            <Field label="Tot en met" htmlFor="leave-end">
              <Input id="leave-end" name="endDate" type="date" />
            </Field>
            <Field label="Dagen" htmlFor="leave-days">
              <Input
                id="leave-days"
                name="days"
                type="number"
                min={0}
                step="0.5"
                placeholder="auto"
                title="Leeg laten = automatisch berekend op werkdagen, excl. weekend en officiële feestdagen"
              />
            </Field>
            <Field label="Notitie" htmlFor="leave-notes">
              <Input id="leave-notes" name="notes" placeholder="Optioneel" />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Opslaan…">
              <Plus className="h-4 w-4" /> Toevoegen
            </SubmitButton>
          </form>

          {m.leaves.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">Nog geen verlof geregistreerd.</p>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Type</TH>
                  <TH>Periode</TH>
                  <TH className="text-right">Dagen</TH>
                  <TH>Notitie</TH>
                  <TH className="text-right"><span className="sr-only">Acties</span></TH>
                </TR>
              </THead>
              <TBody>
                {m.leaves.map((l) => (
                  <TR key={l.id}>
                    <TD><StatusBadge options={LEAVE_TYPES} value={l.type} /></TD>
                    <TD className="text-slate-600">
                      {formatDate(l.startDate)}
                      {l.endDate && l.endDate.getTime() !== l.startDate.getTime()
                        ? ` – ${formatDate(l.endDate)}`
                        : ""}
                    </TD>
                    <TD className="text-right tabular-nums">{round2(l.days)}</TD>
                    <TD className="text-slate-500">{l.notes ?? "—"}</TD>
                    <TD className="text-right">
                      <ConfirmSubmit
                        action={deleteLeave}
                        id={l.id}
                        hidden={{ employeeId: m.id }}
                        message="Verlofregel verwijderen?"
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bonussen */}
      <Card>
        <CardHeader>
          <CardTitle>Bonussen &amp; provisie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={addBonus} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="employeeId" value={m.id} />
            <Field label="Datum" htmlFor="bonus-date">
              <Input id="bonus-date" name="date" type="date" />
            </Field>
            <Field label="Type" htmlFor="bonus-type">
              <Select id="bonus-type" name="type" defaultValue="PRESTATIE">
                {BONUS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Bedrag (€)" htmlFor="bonus-amount">
              <Input id="bonus-amount" name="amount" type="number" min={0} step="0.01" required />
            </Field>
            <Field label="Omschrijving" htmlFor="bonus-desc">
              <Input id="bonus-desc" name="description" placeholder="Optioneel" />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Opslaan…">
              <Plus className="h-4 w-4" /> Toevoegen
            </SubmitButton>
          </form>

          {m.bonuses.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">Nog geen bonussen geregistreerd.</p>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Datum</TH>
                  <TH>Type</TH>
                  <TH>Omschrijving</TH>
                  <TH className="text-right">Bedrag</TH>
                  <TH className="text-right"><span className="sr-only">Acties</span></TH>
                </TR>
              </THead>
              <TBody>
                {m.bonuses.map((b) => (
                  <TR key={b.id}>
                    <TD className="text-slate-600">{formatDate(b.date)}</TD>
                    <TD><StatusBadge options={BONUS_TYPES} value={b.type} /></TD>
                    <TD className="text-slate-500">{b.description ?? "—"}</TD>
                    <TD className="text-right tabular-nums font-medium text-slate-900">
                      {formatCurrency(round2(b.amount))}
                    </TD>
                    <TD className="text-right">
                      <ConfirmSubmit
                        action={deleteBonus}
                        id={b.id}
                        hidden={{ employeeId: m.id }}
                        message="Bonus verwijderen?"
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Loonstroken */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-slate-500" /> Loonstroken
          </CardTitle>
          {payslipsThisYear.length > 0 && (
            <span className="text-sm text-slate-500">
              {year}: <span className="font-medium text-slate-900">{formatCurrency(brutoYear)}</span> bruto ·{" "}
              <span className="font-medium text-slate-900">{formatCurrency(nettoYear)}</span> netto
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={addPayslip} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="employeeId" value={m.id} />
            <Field label="Maand" htmlFor="slip-month">
              <Select id="slip-month" name="month" defaultValue={String(new Date().getMonth() + 1)}>
                {MAANDEN.map((mn, i) => (
                  <option key={i} value={i + 1}>{mn}</option>
                ))}
              </Select>
            </Field>
            <Field label="Jaar" htmlFor="slip-year">
              <Input id="slip-year" name="year" type="number" min={2020} defaultValue={year} />
            </Field>
            <Field label="Bruto (€)" htmlFor="slip-gross">
              <Input id="slip-gross" name="grossAmount" type="number" min={0} step="0.01" required />
            </Field>
            <Field label="Netto (€)" htmlFor="slip-net">
              <Input id="slip-net" name="netAmount" type="number" min={0} step="0.01" required />
            </Field>
            <Field label="PDF (optioneel)" htmlFor="slip-file">
              <input
                id="slip-file"
                name="file"
                type="file"
                accept="application/pdf,image/*"
                title="Loonstrook (PDF) kiezen"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Opslaan…">
              <Plus className="h-4 w-4" /> Toevoegen
            </SubmitButton>
          </form>

          {m.payslips.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">Nog geen loonstroken geregistreerd.</p>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Periode</TH>
                  <TH className="text-right">Bruto</TH>
                  <TH className="text-right">Netto</TH>
                  <TH>Loonstrook</TH>
                  <TH className="text-right"><span className="sr-only">Acties</span></TH>
                </TR>
              </THead>
              <TBody>
                {m.payslips.map((p) => (
                  <TR key={p.id}>
                    <TD className="capitalize text-slate-700">
                      {MAANDEN[p.month - 1] ?? p.month} {p.year}
                    </TD>
                    <TD className="text-right tabular-nums">{formatCurrency(round2(p.grossAmount))}</TD>
                    <TD className="text-right tabular-nums font-medium text-slate-900">
                      {formatCurrency(round2(p.netAmount))}
                    </TD>
                    <TD>
                      {p.fileName ? (
                        <a
                          href={`/api/medewerkers/payslip/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-400" /> PDF
                          <ExternalLink className="h-3 w-3 text-slate-400" />
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TD>
                    <TD className="text-right">
                      <ConfirmSubmit
                        action={deletePayslip}
                        id={p.id}
                        hidden={{ employeeId: m.id }}
                        message="Loonstrook verwijderen?"
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Documenten & contract */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" /> Documenten &amp; contract
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <DocUploadForm employeeId={m.id} aiReady={aiReady} />

          {m.documents.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">
              Nog geen documenten. Upload hier het contract en andere dossierstukken.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {m.documents.map((d) => {
                const st = d.category === "DIPLOMA" ? certStatus(d.expiryDate, now) : null;
                const days =
                  d.expiryDate != null
                    ? Math.ceil((d.expiryDate.getTime() - now.getTime()) / 86_400_000)
                    : null;
                return (
                  <div key={d.id} className="flex items-center gap-3 py-2.5">
                    <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/api/medewerkers/document/${d.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-slate-900 hover:text-emerald-700"
                      >
                        {d.title}
                      </a>
                      <div className="truncate text-xs text-slate-400">{d.originalName}</div>
                      {st && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <Badge color={CERT_STATUS_META[st].color}>{CERT_STATUS_META[st].label}</Badge>
                          {d.expiryDate ? (
                            <span className="text-slate-500">
                              geldig tot {formatDate(d.expiryDate)}
                              {st !== "expired" && days != null && days > 0 &&
                                ` · nog ${days} ${days === 1 ? "dag" : "dagen"}`}
                              {st === "expired" && days != null &&
                                (days === 0
                                  ? " · vandaag verlopen"
                                  : ` · ${-days} ${-days === 1 ? "dag" : "dagen"} verlopen`)}
                            </span>
                          ) : (
                            <span className="text-slate-400">geen vervaldatum bekend</span>
                          )}
                          {d.aiExtracted && (
                            <span className="inline-flex items-center gap-1 text-cyan-600">
                              <Sparkles className="h-3 w-3" /> automatisch uitgelezen
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <StatusBadge options={EMPLOYEE_DOC_CATEGORIES} value={d.category} />
                    <ConfirmSubmit
                      action={deleteDocument}
                      id={d.id}
                      hidden={{ employeeId: m.id }}
                      message="Document verwijderen?"
                      variant="ghost"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </ConfirmSubmit>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Eindejaarsbeoordeling */}
      <Card>
        <CardHeader>
          <CardTitle>Eindejaarsbeoordeling (percentage)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={saveReview} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[120px_160px_1fr_auto]">
            <input type="hidden" name="employeeId" value={m.id} />
            <Field label="Jaar" htmlFor="rev-year">
              <Input id="rev-year" name="year" type="number" min={2020} defaultValue={year} />
            </Field>
            <Field label="Percentage (%)" htmlFor="rev-pct">
              <Input id="rev-pct" name="scorePct" type="number" min={0} step="1" defaultValue={reviewThisYear?.scorePct ?? 100} />
            </Field>
            <Field label="Toelichting" htmlFor="rev-notes">
              <Input id="rev-notes" name="notes" defaultValue={reviewThisYear?.notes ?? ""} placeholder="Optioneel" />
            </Field>
            <SubmitButton pendingLabel="Opslaan…">Opslaan</SubmitButton>
          </form>

          {m.reviews.length > 0 && (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Jaar</TH>
                  <TH>Percentage</TH>
                  <TH>Toelichting</TH>
                </TR>
              </THead>
              <TBody>
                {m.reviews.map((r) => (
                  <TR key={r.id}>
                    <TD className="tabular-nums text-slate-600">{r.year}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(100, r.scorePct)}%` }}
                          />
                        </div>
                        <span className="tabular-nums font-medium text-slate-900">
                          {Math.round(r.scorePct)}%
                        </span>
                      </div>
                    </TD>
                    <TD className="text-slate-500">{r.notes ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dossier */}
      <Card>
        <CardHeader>
          <CardTitle>Gegevens &amp; contract</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail
              label="E-mail"
              value={
                m.email ? (
                  <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 hover:underline">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {m.email}
                  </a>
                ) : null
              }
            />
            <Detail
              label="Telefoon"
              value={
                m.phone ? (
                  <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1.5 text-slate-700 hover:underline">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {m.phone}
                  </a>
                ) : null
              }
            />
            <Detail label="Dienstverband" value={labelFor(EMPLOYEE_EMPLOYMENT_TYPES, m.employmentType)} />
            <Detail label="Contractvorm" value={m.contractType} />
            <Detail label="In dienst sinds" value={m.startDate ? formatDate(m.startDate) : null} />
            <Detail label="Uit dienst" value={m.endDate ? formatDate(m.endDate) : null} />
            <Detail label="Uren per week" value={`${round2(m.hoursPerWeek)} u`} />
            <Detail label="Maandsalaris" value={m.monthlySalary > 0 ? formatCurrency(round2(m.monthlySalary)) : null} />
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
              value={m.emergencyName ? `${m.emergencyName}${m.emergencyPhone ? ` · ${m.emergencyPhone}` : ""}` : null}
            />
          </div>
          {m.notes && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="whitespace-pre-wrap text-sm text-slate-600">{m.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ActivityFeed
        entityType="employee"
        entityId={m.id}
        path={`/medewerkers/${m.id}`}
        activities={activities}
      />
    </div>
  );
}
