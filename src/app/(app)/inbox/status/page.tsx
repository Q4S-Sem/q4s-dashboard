import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  Inbox as InboxIcon,
  AlertTriangle,
  BellRing,
  Upload,
  Send,
  FileText,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { DISCIPLINES, TIMESHEET_PRESENCE, INBOX_SOURCES, INBOX_STATUSES, labelFor } from "@/lib/domain";
import { isEmailConfigured } from "@/lib/email";
import {
  parseWeekParam,
  timesheetWeekStatus,
  weekParam,
  currentWeekMonday,
  unlinkedInboxItems,
} from "@/lib/timesheets";
import { WeekPicker } from "@/components/week-picker";
import { remindOne, remindAllMissing } from "./actions";

export const metadata = { title: "Timesheet-status" };
export const dynamic = "force-dynamic";

function shiftWeek(monday: Date, deltaWeeks: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return weekParam(d);
}

export default async function TimesheetStatusPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    r?: string;
    sent?: string;
    noEmail?: string;
    sim?: string;
    capped?: string;
  }>;
}) {
  const sp = await searchParams;
  const monday = parseWeekParam(sp.week);
  const wp = weekParam(monday);
  const [status, unlinkedItems] = await Promise.all([
    timesheetWeekStatus(monday),
    unlinkedInboxItems(),
  ]);
  const emailReady = isEmailConfigured();

  const missingCount = status.summary.missing;

  return (
    <div className="space-y-6">
      <Link href="/inbox" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar de inbox
      </Link>

      <PageHeader
        title="Timesheet-status"
        description="Per week checken we of iedereen die voor Q4S werkt zijn urenstaat heeft ingeleverd. Ontbreekt er één? Stuur een herinnering of importeer hem zelf."
        actions={
          <Link href="/inbox" className={buttonVariants({ variant: "outline" })}>
            <Upload className="h-4 w-4" /> Timesheet importeren
          </Link>
        }
      />

      {/* Week navigator */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/inbox/status?week=${shiftWeek(monday, -1)}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ChevronLeft className="h-4 w-4" /> Vorige week
        </Link>
        <div className="flex flex-col items-center">
          <WeekPicker value={wp} basePath="/inbox/status" className="w-72" />
          <p className="mt-1 text-xs text-slate-400">
            week van {formatDate(monday)}
            {weekParam(currentWeekMonday()) === wp ? " · huidige week" : ""}
          </p>
        </div>
        <Link
          href={`/inbox/status?week=${shiftWeek(monday, 1)}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Volgende week <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Result banners */}
      {sp.r === "reminded" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Herinnering verstuurd.</p>
      )}
      {sp.r === "reminded-sim" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Herinnering opgesteld (klaarzet-modus — geen SMTP ingesteld, dus niet echt verzonden).
        </p>
      )}
      {sp.r === "no-email" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze medewerker heeft nog geen e-mailadres. Voeg dat eerst toe bij de werknemer.
        </p>
      )}
      {sp.r === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Versturen mislukt. Controleer de SMTP-instellingen en probeer opnieuw.
        </p>
      )}
      {sp.sent !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.sent} herinnering(en) {Number(sp.sim) > 0 ? "opgesteld" : "verstuurd"}
          {Number(sp.sim) > 0 ? ` (${sp.sim} in klaarzet-modus, niet echt verzonden)` : ""}
          {Number(sp.noEmail) > 0 ? ` · ${sp.noEmail} zonder e-mailadres overgeslagen` : ""}
          {Number(sp.capped) > 0 ? ` · ${sp.capped} boven de limiet — klik nogmaals voor de rest` : ""}.
        </p>
      )}
      {unlinkedItems.length > 0 && (
        <Card className="border-amber-300 ring-1 ring-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Dit moet je oppakken —{" "}
              {unlinkedItems.length} onbevestigd(e) item(s)
            </CardTitle>
            <span className="text-sm text-slate-500">
              Deze urenstaten liggen in de inbox maar zijn nog niet aan een medewerker gekoppeld.
              Bevestig ze eerst — anders lijkt iemand hieronder onterecht te "ontbreken".
            </span>
          </CardHeader>
          <ul className="divide-y divide-slate-100">
            {unlinkedItems.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/inbox/${it.id}`}
                    className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700"
                  >
                    {it.name}
                  </Link>
                  <span className="block truncate text-xs text-slate-400">
                    {it.originalName}
                    {it.weekStart ? ` · week van ${formatDate(it.weekStart)}` : ""}
                  </span>
                </div>
                <StatusBadge options={INBOX_SOURCES} value={it.source} />
                <StatusBadge options={INBOX_STATUSES} value={it.status} />
                <Link
                  href={`/inbox/${it.id}`}
                  className={buttonVariants({ variant: "primary", size: "sm" })}
                >
                  Bevestig <ArrowRight className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {!emailReady && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Klaarzet-modus:</strong> er is geen SMTP ingesteld, dus herinneringen worden opgesteld maar niet
          echt verzonden. Zet <code>SMTP_*</code> in je <code>.env</code> om ze te versturen.
        </p>
      )}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Verwacht" value={status.summary.expected} icon={<Users className="h-5 w-5" />} accent="brand" />
        <StatCard label="Ontvangen" value={status.summary.received} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <StatCard label="In inbox" value={status.summary.inInbox} sub="nog te bevestigen" icon={<InboxIcon className="h-5 w-5" />} accent="violet" />
        <StatCard
          label="Ontbreekt"
          value={status.summary.missing + status.summary.reminded}
          sub={status.summary.reminded > 0 ? `${status.summary.reminded} herinnerd` : undefined}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={status.summary.missing + status.summary.reminded > 0 ? "red" : "slate"}
        />
      </div>

      {status.rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Geen actieve plaatsingen deze week"
          description="Er zijn deze week geen lopende plaatsingen, dus er worden ook geen weekstaten verwacht."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Weekstaten deze week</CardTitle>
            {missingCount > 0 && (
              <form action={remindAllMissing}>
                <input type="hidden" name="week" value={wp} />
                <SubmitButton size="sm" pendingLabel="Versturen…">
                  <BellRing className="h-4 w-4" /> Herinner ontbrekende ({missingCount})
                </SubmitButton>
              </form>
            )}
          </CardHeader>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Medewerker</TH>
                <TH>Discipline</TH>
                <TH>Plaatsing / klant</TH>
                <TH>Status</TH>
                <TH className="text-right">Actie</TH>
              </TR>
            </THead>
            <TBody>
              {status.rows.map((row) => (
                <TR key={row.placementId}>
                  <TD>
                    <Link href={`/werknemers/${row.consultantId}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {row.consultantName}
                    </Link>
                    {row.presence === "REMINDED" && row.reminderSentAt && (
                      <p className="text-[11px] text-amber-600">
                        herinnerd op {formatDate(row.reminderSentAt)}
                        {row.reminderSimulated ? " (klaarzet)" : ""}
                      </p>
                    )}
                    {!row.email && row.presence !== "RECEIVED" && (
                      <Link
                        href={`/werknemers/${row.consultantId}/bewerken`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-700 hover:underline"
                      >
                        geen e-mailadres — toevoegen
                      </Link>
                    )}
                  </TD>
                  <TD className="text-slate-500">
                    {row.discipline ? labelFor(DISCIPLINES, row.discipline) : "—"}
                  </TD>
                  <TD className="text-slate-500">
                    <span className="text-slate-900">{row.placementTitle}</span>
                    <span className="block text-xs text-slate-400">{row.clientName}</span>
                  </TD>
                  <TD>
                    <StatusBadge options={TIMESHEET_PRESENCE} value={row.presence} />
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      {row.presence === "RECEIVED" && row.timesheetId && (
                        <Link
                          href={`/uren/${row.timesheetId}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Bekijk
                        </Link>
                      )}
                      {row.presence === "IN_INBOX" && (
                        <Link href="/inbox" className={buttonVariants({ variant: "outline", size: "sm" })}>
                          <InboxIcon className="h-4 w-4" /> In inbox
                        </Link>
                      )}
                      {(row.presence === "MISSING" || row.presence === "REMINDED") && (
                        <>
                          <Link
                            href={`/inbox?voor=${row.consultantId}&week=${wp}`}
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            <Upload className="h-4 w-4" /> Importeren
                          </Link>
                          {row.email ? (
                            <form action={remindOne}>
                              <input type="hidden" name="consultantId" value={row.consultantId} />
                              <input type="hidden" name="placementId" value={row.placementId} />
                              <input type="hidden" name="week" value={wp} />
                              <SubmitButton
                                variant={row.presence === "REMINDED" ? "outline" : "primary"}
                                size="sm"
                                pendingLabel="…"
                              >
                                <Send className="h-4 w-4" /> {row.presence === "REMINDED" ? "Opnieuw" : "Herinner"}
                              </SubmitButton>
                            </form>
                          ) : (
                            // Zonder e-mailadres kan er geen herinnering — stuur naar het bewerken-
                            // scherm om het toe te voegen, zodat je daarna wél kunt herinneren.
                            <Link
                              href={`/werknemers/${row.consultantId}/bewerken`}
                              className={buttonVariants({ variant: "primary", size: "sm" })}
                              title="Zonder e-mailadres kun je geen herinnering sturen — voeg het toe"
                            >
                              <Mail className="h-4 w-4" /> E-mailadres toevoegen
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
