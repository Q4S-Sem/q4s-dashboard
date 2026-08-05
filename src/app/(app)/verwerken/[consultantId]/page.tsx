import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Coins,
  Receipt,
  CheckCircle2,
  Mail,
  Upload,
  PencilLine,
  AlertTriangle,
  Send,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, formatHours, round2, formatWeekLabel } from "@/lib/utils";
import { TIMESHEET_STATUSES } from "@/lib/domain";
import { getCompanySettings } from "@/lib/settings";
import { consultantFlow, type FlowWeek } from "@/lib/facturatie";
import {
  processConsultantFlow,
  processConsultantInkoop,
  processConsultantVerkoop,
} from "../actions";
import { TimesheetPeek } from "./TimesheetPeek";

export const metadata = { title: "Facturatie verwerken" };

const peekDayFmt = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function SourceTag({ source }: { source: string | null }) {
  if (source === "EMAIL")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-500">
        <Mail className="h-3.5 w-3.5" /> E-mail
      </span>
    );
  if (source === "UPLOAD")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-500">
        <Upload className="h-3.5 w-3.5" /> Upload
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-400">
      <PencilLine className="h-3.5 w-3.5" /> Handmatig
    </span>
  );
}

function Totals({ subtotal, vatRate }: { subtotal: number; vatRate: number }) {
  const vat = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vat);
  return (
    <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
      <div className="flex justify-between">
        <dt className="text-ink-500">Subtotaal (excl. btw)</dt>
        <dd className="tabular-nums text-ink-700">{formatCurrency(subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-ink-500">Btw {vatRate}%</dt>
        <dd className="tabular-nums text-ink-700">{formatCurrency(vat)}</dd>
      </div>
      <div className="flex justify-between border-t border-ink-100 pt-1 font-semibold">
        <dt className="text-ink-900">Totaal</dt>
        <dd className="tabular-nums text-ink-900">{formatCurrency(total)}</dd>
      </div>
    </dl>
  );
}

type VerkoopGroup = { clientId: string; clientName: string; weeks: FlowWeek[]; charge: number; margin: number };

export default async function VerwerkenPage({
  params,
  searchParams,
}: {
  params: Promise<{ consultantId: string }>;
  searchParams: Promise<{
    done?: string;
    ok?: string;
    inkoop?: string;
    verkoop?: string;
    appr?: string;
    err?: string;
  }>;
}) {
  const { consultantId } = await params;
  const sp = await searchParams;

  const flow = await consultantFlow(consultantId);
  if (!flow) notFound();

  const settings = await getCompanySettings();
  const vatRate = settings.defaultVatRate ?? 21;
  const name = `${flow.consultant.firstName} ${flow.consultant.lastName}`;
  const isDone = flow.weeks.length === 0;

  // ------------------------------------------------------------------ done view
  if (isDone) {
    const [recentPurchases, recentSales] = await Promise.all([
      db.purchaseInvoice.findMany({ where: { consultantId }, orderBy: { createdAt: "desc" }, take: 3 }),
      db.invoice.findMany({
        where: { lines: { some: { placement: { consultantId } } } },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { client: { select: { companyName: true } } },
      }),
    ]);
    const justProcessed = sp.done === "1" || sp.ok === "inkoop" || sp.ok === "verkoop";
    const errCount = Number(sp.err) || 0;

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/verwerken"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar verwerken
        </Link>

        <Card>
          <CardContent className="space-y-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-900">
                {justProcessed ? "Verwerkt!" : "Niets openstaand"}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                {justProcessed ? (
                  <>
                    De facturatie voor <strong>{name}</strong> is verwerkt
                    {Number(sp.appr) > 0 ? ` (${sp.appr} week/weken goedgekeurd)` : ""}. De facturen
                    staan nu klaar in de <strong>verzendmap</strong> om te versturen.
                  </>
                ) : (
                  <>
                    Er is niets meer te verwerken voor <strong>{name}</strong> — alle uren zijn
                    gefactureerd.
                  </>
                )}
              </p>
            </div>

            {justProcessed && errCount > 0 && (
              <p className="mx-auto flex max-w-md items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-left text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {errCount} onderdeel/onderdelen kon niet worden aangemaakt. Controleer de facturen
                hieronder.
              </p>
            )}

            <div className="mx-auto grid max-w-2xl gap-4 text-left sm:grid-cols-2">
              <div className="rounded-xl border border-ink-200 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
                  <Coins className="h-4 w-4 text-brand-600" /> Inkoopfacturen
                </div>
                {recentPurchases.length === 0 ? (
                  <p className="text-sm text-ink-400">—</p>
                ) : (
                  <ul className="space-y-1">
                    {recentPurchases.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/inkoopfacturen/${p.id}`}
                          className="flex justify-between text-sm hover:text-brand-700"
                        >
                          <span className="font-medium text-ink-700">{p.number}</span>
                          <span className="tabular-nums text-ink-500">{formatCurrency(p.total)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-ink-200 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
                  <Receipt className="h-4 w-4 text-brand-600" /> Verkoopfacturen
                </div>
                {recentSales.length === 0 ? (
                  <p className="text-sm text-ink-400">—</p>
                ) : (
                  <ul className="space-y-1">
                    {recentSales.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/facturen/${s.id}`}
                          className="flex justify-between text-sm hover:text-brand-700"
                        >
                          <span className="font-medium text-ink-700">{s.number}</span>
                          <span className="tabular-nums text-ink-500">{formatCurrency(s.total)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/verzenden" className={buttonVariants()}>
                <Send className="h-4 w-4" /> Naar verzendmap
              </Link>
              <Link href="/verwerken" className={buttonVariants({ variant: "outline" })}>
                Volgende medewerker
              </Link>
              <Link href="/totaaloverzicht" className={buttonVariants({ variant: "outline" })}>
                Naar totaaloverzicht
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ------------------------------------------------------------- overview + 1 knop
  // Per-week day breakdown (uren per dag) voor de "Bekijken"-popup.
  const tsDetails = await db.timesheet.findMany({
    where: { id: { in: flow.weeks.map((w) => w.timesheetId) } },
    select: {
      id: true,
      weekStart: true,
      overtimeHours: true,
      entries: { select: { date: true, hours: true }, orderBy: { date: "asc" } },
    },
  });
  // Dag-sleutel (jaar-maand-dag) zodat we entries op de juiste kalenderdag leggen.
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const peekByTs = new Map(
    tsDetails.map((t) => {
      const byDay = new Map(t.entries.map((e) => [dayKey(e.date), e.hours]));
      // Altijd de volledige week ma→zo tonen; dagen zonder registratie = 0 uur.
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(t.weekStart);
        d.setDate(d.getDate() + i);
        const g = d.getDay();
        return {
          label: peekDayFmt.format(d),
          hours: byDay.get(dayKey(d)) ?? 0,
          weekend: g === 0 || g === 6,
        };
      });
      return [t.id, { overtime: t.overtimeHours ?? 0, days }];
    }),
  );

  // De knop keurt eerst goed en factureert dan; de preview toont dus ALLES wat nog
  // niet op een inkoop-/verkoopfactuur staat (ongeacht of het al goedgekeurd is).
  // Eigen loondienst-personeel (ownStaff) krijgt GÉÉN inkoopfactuur (salaris) →
  // nooit een inkoop-preview, ook al staat er nog geen inkooplijn.
  const inkoopPreview = flow.ownStaff ? [] : flow.weeks.filter((w) => !w.hasPurchase);
  const inkoopSubtotal = round2(inkoopPreview.reduce((s, w) => s + w.cost, 0));

  // Alleen weken MET een klant kunnen verkoopgefactureerd worden — plaatsingen
  // zonder gekoppeld bedrijf slaan we over (blijven wel in de wekenlijst zichtbaar).
  const salesWeeks = flow.weeks.filter((w) => !w.hasSales && w.clientId);
  const vg = new Map<string, VerkoopGroup>();
  for (const w of salesWeeks) {
    if (!w.clientId) continue;
    let g = vg.get(w.clientId);
    if (!g) {
      g = { clientId: w.clientId, clientName: w.clientName, weeks: [], charge: 0, margin: 0 };
      vg.set(w.clientId, g);
    }
    g.weeks.push(w);
    g.charge = round2(g.charge + w.charge);
    g.margin = round2(g.margin + w.margin);
  }
  const verkoopGroups = [...vg.values()];
  const verkoopSubtotal = round2(salesWeeks.reduce((s, w) => s + w.charge, 0));
  const margeTotal = round2(salesWeeks.reduce((s, w) => s + w.margin, 0));
  const submittedCount = flow.needApprovalIds.length;
  const maaktLabel =
    inkoopPreview.length > 0 && verkoopGroups.length > 0
      ? "de inkoop- én verkoopfactu(u)r(en)"
      : inkoopPreview.length > 0
        ? "de inkoopfactuur"
        : "de verkoopfactu(u)r(en)";

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-4">
      <Link
        href="/verwerken"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar verwerken
      </Link>

      <PageHeader
        title={name}
        description="Controleer alles in één overzicht en verwerk het in één klik — inkoop én verkoop tegelijk."
      />

      {sp.ok === "inkoop" && (
        <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Inkoopfactuur aangemaakt. De verkoopfactuur staat hieronder nog klaar.
        </p>
      )}
      {sp.ok === "verkoop" && (
        <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Verkoopfactu(u)r(en) aangemaakt. De inkoopfactuur staat hieronder nog klaar.
        </p>
      )}
      {Number(sp.err) > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Er ging iets mis bij het vorige verwerken — een deel is mogelijk niet aangemaakt. Je kunt
          het hieronder opnieuw proberen voor wat nog openstaat.
        </p>
      )}

      {/* Snelle samenvatting */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Coins className="h-4 w-4 text-brand-600" /> {flow.ownStaff ? "Kost — loon" : `Wij betalen ${name}`}
          </div>
          {flow.ownStaff ? (
            <>
              <p className="mt-1 text-2xl font-bold text-ink-900">Salaris</p>
              <p className="text-xs text-ink-400">eigen personeel — geen inkoopfactuur</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">
                {formatCurrency(inkoopSubtotal)}
              </p>
              <p className="text-xs text-ink-400">inkoop, excl. btw</p>
            </>
          )}
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Receipt className="h-4 w-4 text-brand-600" /> Klant betaalt
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">
            {formatCurrency(verkoopSubtotal)}
          </p>
          <p className="text-xs text-ink-400">verkoop, excl. btw</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Onze marge
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
            {formatCurrency(margeTotal)}
          </p>
          <p className="text-xs text-emerald-600/80">
            {flow.weeks.length} {flow.weeks.length === 1 ? "week" : "weken"}
          </p>
        </div>
      </div>

      {/* 1 — Uren controleren */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
              1
            </span>
            Uren controleren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-500">
            Controleer per week de <strong>uren</strong> en <strong>kilometers</strong> via{" "}
            <strong>Bekijken</strong> (snel overzicht in een pop-up). Klopt alles? Dan hoef je alleen
            onderaan op <strong>Verwerk alles</strong> te klikken.
          </p>
          {submittedCount > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {submittedCount} ingediende week/weken worden bij het verwerken automatisch
              goedgekeurd. Controleer ze eerst hierboven.
            </p>
          )}
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Week</TH>
                  <TH>Klant</TH>
                  <TH>Plaatsing</TH>
                  <TH>Bron</TH>
                  <TH className="text-right">Uren</TH>
                  <TH className="text-right">Km</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {flow.weeks.map((w) => (
                  <TR key={w.timesheetId}>
                    <TD>
                      <Link
                        href={`/uren/${w.timesheetId}`}
                        className="font-medium text-ink-900 hover:text-brand-700"
                      >
                        {formatWeekLabel(w.weekStart)}
                      </Link>
                    </TD>
                    <TD>{w.clientName}</TD>
                    <TD className="text-ink-500">{w.placementTitle}</TD>
                    <TD>
                      <SourceTag source={w.source} />
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatHours(w.workedHours)}
                      {w.overtimeHours > 0 && (
                        <span className="ml-1 text-xs font-normal text-violet-500">
                          ({formatHours(w.hours)} + {formatHours(w.overtimeHours)} ov)
                        </span>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums text-ink-600">
                      {w.kilometers > 0 ? `${formatHours(w.kilometers)} km` : "—"}
                    </TD>
                    <TD>
                      <StatusBadge options={TIMESHEET_STATUSES} value={w.status} />
                    </TD>
                    <TD className="text-right">
                      <TimesheetPeek
                        weekLabel={formatWeekLabel(w.weekStart)}
                        clientName={w.clientName}
                        placementTitle={w.placementTitle}
                        hours={w.hours}
                        kilometers={w.kilometers}
                        overtimeHours={peekByTs.get(w.timesheetId)?.overtime ?? 0}
                        days={peekByTs.get(w.timesheetId)?.days ?? []}
                        urenstaatHref={`/uren/${w.timesheetId}`}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 2 — Inkoop + 3 — Verkoop naast elkaar op brede schermen */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inkoop */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-5 w-5 text-brand-600" />{" "}
              {flow.ownStaff ? "Kost — salaris (geen inkoopfactuur)" : `Inkoopfactuur — wij betalen ${name}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {inkoopPreview.length === 0 ? (
              flow.ownStaff ? (
                <p className="rounded-lg bg-ink-50 px-3 py-3 text-sm text-ink-600">
                  <strong>Eigen loondienst-medewerker.</strong> Betaling loopt via het salaris — er komt
                  <span className="font-medium"> géén inkoopfactuur</span>. De marge hiernaast is berekend
                  met de interne loonkost/uur; overuren worden als loon uitbetaald.
                </p>
              ) : (
                <p className="py-4 text-center text-sm text-ink-400">
                  Inkoop is al aangemaakt voor deze weken.
                </p>
              )
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Week</TH>
                        <TH className="text-right">Uren</TH>
                        <TH className="text-right">Kostprijs/uur</TH>
                        <TH className="text-right">Bedrag</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {inkoopPreview.map((w) => (
                        <TR key={w.timesheetId}>
                          <TD>{formatWeekLabel(w.weekStart)}</TD>
                          <TD className="text-right tabular-nums">
                            {formatHours(w.workedHours)}
                            {w.overtimeHours > 0 && (
                              <span className="ml-1 text-xs font-normal text-violet-500">
                                ({formatHours(w.hours)}+{formatHours(w.overtimeHours)}ov)
                              </span>
                            )}
                          </TD>
                          <TD className="text-right tabular-nums">{formatCurrency(w.costRate)}</TD>
                          <TD className="text-right tabular-nums">
                            {formatCurrency(w.buy.base)}
                            {w.buy.overtime > 0 && (
                              <div className="text-xs font-normal text-ink-400">
                                + {formatCurrency(w.buy.overtime)} overuren ({formatHours(w.overtimeHours)} u)
                              </div>
                            )}
                            {w.buy.weekend > 0 && (
                              <div className="text-xs font-normal text-ink-400">
                                + {formatCurrency(w.buy.weekend)} weekend
                              </div>
                            )}
                            {w.buy.km > 0 && (
                              <div className="text-xs font-normal text-ink-400">
                                + {formatCurrency(w.buy.km)} km ({formatHours(w.kilometers)} km)
                              </div>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
                <div className="flex">
                  <Totals subtotal={inkoopSubtotal} vatRate={vatRate} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Verkoop */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-5 w-5 text-brand-600" /> Verkoopfactuur — naar de klant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {verkoopGroups.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">
                Verkoop is al aangemaakt voor deze weken.
              </p>
            ) : (
              verkoopGroups.map((g) => (
                <div key={g.clientId} className="rounded-xl border border-ink-200">
                  <div className="border-b border-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-900">
                    {g.clientName}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <THead>
                          <TR className="hover:bg-transparent">
                            <TH>Week</TH>
                            <TH className="text-right">Uren</TH>
                            <TH className="text-right">Tarief/uur</TH>
                            <TH className="text-right">Bedrag</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {g.weeks.map((w) => (
                            <TR key={w.timesheetId}>
                              <TD>{formatWeekLabel(w.weekStart)}</TD>
                              <TD className="text-right tabular-nums">
                                {formatHours(w.workedHours)}
                                {w.overtimeHours > 0 && (
                                  <span className="ml-1 text-xs font-normal text-violet-500">
                                    ({formatHours(w.hours)}+{formatHours(w.overtimeHours)}ov)
                                  </span>
                                )}
                              </TD>
                              <TD className="text-right tabular-nums">{formatCurrency(w.chargeRate)}</TD>
                              <TD className="text-right tabular-nums">
                                {formatCurrency(w.sell.base)}
                                {w.sell.overtime > 0 && (
                                  <div className="text-xs font-normal text-ink-400">
                                    + {formatCurrency(w.sell.overtime)} overuren ({formatHours(w.overtimeHours)} u)
                                  </div>
                                )}
                                {w.sell.weekend > 0 && (
                                  <div className="text-xs font-normal text-ink-400">
                                    + {formatCurrency(w.sell.weekend)} weekend
                                  </div>
                                )}
                                {w.sell.km > 0 && (
                                  <div className="text-xs font-normal text-ink-400">
                                    + {formatCurrency(w.sell.km)} km ({formatHours(w.kilometers)} km)
                                  </div>
                                )}
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                        <span className="text-emerald-700">Marge: </span>
                        <span className="font-semibold tabular-nums text-emerald-800">
                          {formatCurrency(g.margin)}
                        </span>
                      </div>
                      <Totals subtotal={g.charge} vatRate={vatRate} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Losse acties — één soort tegelijk, gecentreerd onder de kaarten */}
      {(inkoopPreview.length > 0 || verkoopGroups.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {inkoopPreview.length > 0 && (
            <form action={processConsultantInkoop}>
              <input type="hidden" name="consultantId" value={consultantId} />
              <SubmitButton variant="outline" pendingLabel="Bezig…">
                <Coins className="h-4 w-4" /> Alleen inkoopfactuur maken
              </SubmitButton>
            </form>
          )}
          {verkoopGroups.length > 0 && (
            <form action={processConsultantVerkoop}>
              <input type="hidden" name="consultantId" value={consultantId} />
              <SubmitButton variant="outline" pendingLabel="Bezig…">
                <Receipt className="h-4 w-4" /> Alleen verkoopfactuur
                {verkoopGroups.length > 1 ? "en" : ""} maken
              </SubmitButton>
            </form>
          )}
        </div>
      )}

      {/* Verwerk alles — blijft in beeld terwijl je scrolt */}
      <div className="sticky bottom-4 z-10">
        <div className="flex flex-col gap-4 rounded-2xl border border-emerald-300 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              {flow.ownStaff ? (
                <span className="text-ink-500">Kost via salaris</span>
              ) : (
                <span className="text-ink-600">
                  Inkoop <span className="font-semibold tabular-nums text-ink-900">{formatCurrency(inkoopSubtotal)}</span>
                </span>
              )}
              <span className="text-ink-600">
                Verkoop <span className="font-semibold tabular-nums text-ink-900">{formatCurrency(verkoopSubtotal)}</span>
              </span>
              <span className="text-emerald-700">
                Marge <span className="font-semibold tabular-nums text-emerald-800">{formatCurrency(margeTotal)}</span>
              </span>
            </div>
            <p className="text-xs text-ink-500">
              Dit keurt {submittedCount > 0 ? "de ingediende uren goed en " : ""}maakt {maaktLabel} aan.
              Ze komen klaar te staan in de verzendmap.
            </p>
          </div>
          <form action={processConsultantFlow}>
            <input type="hidden" name="consultantId" value={consultantId} />
            <SubmitButton size="lg" variant="success" pendingLabel="Verwerken…">
              <Zap className="h-5 w-5" /> Verwerk alles
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
