import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Receipt, Coins, Building2, Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, formatDate, formatHours, formatWeekLabel, round2 } from "@/lib/utils";
import { computeTimesheetMoney } from "@/lib/toeslag";
import { TIMESHEET_STATUSES } from "@/lib/domain";
import {
  setTimesheetStatus,
  deleteTimesheet,
  generateBothForTimesheet,
  generateSalesForTimesheet,
  generatePurchaseForTimesheet,
} from "../actions";

export const metadata = { title: "Urenstaat" };

const weekdayFmt = new Intl.DateTimeFormat("nl-NL", { weekday: "long" });

function StatusButton({
  id,
  status,
  children,
  variant = "secondary",
}: {
  id: string;
  status: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "success";
}) {
  return (
    <form action={setTimesheetStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} size="md">
        {children}
      </Button>
    </form>
  );
}

export default async function UrenstaatDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const ts = await db.timesheet.findUnique({
    where: { id },
    include: {
      entries: { orderBy: { date: "asc" } },
      invoiceLine: { select: { invoiceId: true } },
      purchaseLine: { select: { purchaseInvoiceId: true } },
      placement: { include: { consultant: true, client: true } },
      inbox: { select: { id: true, source: true, originalName: true } },
    },
  });

  if (!ts) notFound();

  const { placement } = ts;
  // Eigen loondienst-personeel: geen inkoopfactuur (salaris) — alleen verkoop.
  const ownStaff = placement.consultant.employmentType === "LOONDIENST";
  // Single source of truth: same calc as the invoice + the /verwerken wizard.
  // Includes weekend/overuren toeslagen + km when configured on the placement.
  const money = computeTimesheetMoney(
    { entries: ts.entries, overtimeHours: ts.overtimeHours, kilometers: ts.kilometers },
    placement,
  );
  const totalHours = money.hours;
  const weekendHours = money.weekendHours;
  const weekdayHours = round2(totalHours - weekendHours);
  const revenue = money.sell.total;
  const cost = money.buy.total;
  const margin = money.margin;
  const isWeekend = (d: Date) => {
    const g = new Date(d).getDay();
    return g === 0 || g === 6;
  };
  const hasToeslag =
    money.sell.weekend > 0 || money.buy.weekend > 0 ||
    money.sell.overtime > 0 || money.buy.overtime > 0 ||
    money.sell.km > 0 || money.buy.km > 0;

  const salesInvoiceId = ts.invoiceLine?.invoiceId ?? null;
  const purchaseInvoiceId = ts.purchaseLine?.purchaseInvoiceId ?? null;
  const canInvoice = ts.status === "APPROVED" || ts.status === "INVOICED";
  // Once the hours back an issued sales OR purchase invoice, they're locked.
  const committed = Boolean(salesInvoiceId || purchaseInvoiceId);

  return (
    <div className="space-y-6">
      <Link
        href="/uren"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar urenregistratie
      </Link>

      <PageHeader
        title={formatWeekLabel(ts.weekStart)}
        description={`${placement.consultant.firstName} ${placement.consultant.lastName} bij ${placement.client.companyName} · ${placement.title}`}
        actions={<StatusBadge options={TIMESHEET_STATUSES} value={ts.status} />}
      />

      {ts.inbox && (
        <Link
          href={`/inbox/${ts.inbox.id}`}
          className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 hover:bg-blue-100"
        >
          <Inbox className="h-4 w-4 shrink-0" />
          <span>
            Deze urenstaat is via de <strong>timesheet-inbox</strong> binnengekomen
            {ts.inbox.originalName ? ` (${ts.inbox.originalName})` : ""} — bekijk het origineel.
          </span>
        </Link>
      )}

      {error === "locked" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze urenstaat is al gefactureerd en kan niet meer gewijzigd worden.
        </p>
      )}
      {(error === "sales" || error === "purchase") && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error === "sales"
            ? "Verkoopfactuur aanmaken mislukt — de urenstaat is mogelijk al gefactureerd."
            : "Inkoopfactuur aanmaken mislukt — de urenstaat is mogelijk al ingekocht."}
        </p>
      )}

      {/* Workflow actions */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Altijd beschikbaar: uren én kilometers samen handmatig aanpassen */}
        <Link href={`/uren/${ts.id}/bewerken`} className={buttonVariants({ variant: "outline" })}>
          <Pencil className="h-4 w-4" /> Weekstaat bewerken
        </Link>

        {ts.status === "DRAFT" && (
          <>
            <StatusButton id={ts.id} status="SUBMITTED" variant="primary">
              Indienen
            </StatusButton>
            <ConfirmSubmit action={deleteTimesheet} id={ts.id} message="Urenstaat verwijderen?">
              Verwijderen
            </ConfirmSubmit>
          </>
        )}
        {ts.status === "SUBMITTED" && (
          <>
            <StatusButton id={ts.id} status="APPROVED" variant="success">
              Goedkeuren
            </StatusButton>
            <StatusButton id={ts.id} status="DRAFT" variant="outline">
              Terug naar concept
            </StatusButton>
            <ConfirmSubmit action={deleteTimesheet} id={ts.id} message="Urenstaat verwijderen?">
              Verwijderen
            </ConfirmSubmit>
          </>
        )}
        {ts.status === "APPROVED" && (
          <>
            <Link
              href={`/facturen/nieuw?client=${placement.clientId}`}
              className={buttonVariants({ variant: "primary" })}
            >
              <Receipt className="h-4 w-4" /> Factureren
            </Link>
            {!committed && (
              <>
                <StatusButton id={ts.id} status="DRAFT" variant="outline">
                  Heropenen
                </StatusButton>
                <ConfirmSubmit action={deleteTimesheet} id={ts.id} message="Urenstaat verwijderen?">
                  Verwijderen
                </ConfirmSubmit>
              </>
            )}
          </>
        )}
        {ts.status === "INVOICED" && ts.invoiceLine?.invoiceId && (
          <Link
            href={`/facturen/${ts.invoiceLine.invoiceId}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Receipt className="h-4 w-4" /> Bekijk factuur
          </Link>
        )}
      </div>

      {/* Financial summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Totaal uren" value={`${formatHours(totalHours)} u`} accent="slate" />
        <StatCard label="Omzet (verkoop)" value={formatCurrency(revenue)} accent="brand" />
        <StatCard label={ownStaff ? "Loonkost (intern)" : "Kostprijs (inkoop)"} value={formatCurrency(cost)} accent="violet" />
        <StatCard label="Marge" value={formatCurrency(margin)} accent="green" />
      </div>

      {/* Toeslagen: weekend, overuren, kilometers — zoals op de factuur */}
      <Card>
        <CardHeader>
          <CardTitle>Toeslagen &amp; kilometers</CardTitle>
          <Link
            href={`/plaatsingen/${placement.id}/bewerken`}
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Toeslagen instellen
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Doordeweeks (ma–vr)" value={`${formatHours(weekdayHours)} u`} accent="slate" />
            <StatCard label="Weekend (za + zo)" value={`${formatHours(weekendHours)} u`} accent="amber" />
            <StatCard label="Overuren" value={`${formatHours(ts.overtimeHours ?? 0)} u`} accent="violet" />
            <StatCard label="Kilometers" value={`${formatHours(ts.kilometers ?? 0)} km`} accent="brand" />
          </div>
          {hasToeslag ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-medium">Toeslag / vergoeding</th>
                    <th className="px-4 py-2 text-right font-medium">Verkoop</th>
                    <th className="px-4 py-2 text-right font-medium">Inkoop</th>
                  </tr>
                </thead>
                <tbody>
                  {(money.sell.weekend > 0 || money.buy.weekend > 0) && (
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700">
                        Weekendtoeslag ({formatHours(placement.weekendSurchargeSell)}% verkoop / {formatHours(placement.weekendSurchargeBuy)}% inkoop)
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(money.sell.weekend)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(money.buy.weekend)}</td>
                    </tr>
                  )}
                  {(money.sell.overtime > 0 || money.buy.overtime > 0) && (
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700">
                        Overurentoeslag ({formatHours(placement.overtimeSurchargeSell)}% verkoop / {formatHours(placement.overtimeSurchargeBuy)}% inkoop)
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(money.sell.overtime)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(money.buy.overtime)}</td>
                    </tr>
                  )}
                  {(money.sell.km > 0 || money.buy.km > 0) && (
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700">Kilometervergoeding ({formatHours(money.kilometers)} km)</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(money.sell.km)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(money.buy.km)}</td>
                    </tr>
                  )}
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                    <td className="px-4 py-2">Totaal incl. toeslagen (excl. BTW)</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(money.sell.total)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(money.buy.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Geen toeslagen of km-vergoeding ingesteld voor deze plaatsing — de
              factuur is dan uren × tarief. Stel ze per persoon in via{" "}
              <Link href={`/plaatsingen/${placement.id}/bewerken`} className="font-medium text-brand-700 hover:text-brand-800">
                de plaatsing
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>

      {/* Two-sided invoicing: purchase (pay consultant) + sales (charge client) */}
      <Card>
        <CardHeader>
          <CardTitle>Facturen</CardTitle>
          {canInvoice && !ownStaff && !salesInvoiceId && !purchaseInvoiceId && (
            <form action={generateBothForTimesheet}>
              <input type="hidden" name="timesheetId" value={ts.id} />
              <SubmitButton size="sm" pendingLabel="Aanmaken…">
                <Receipt className="h-4 w-4" /> Genereer beide
              </SubmitButton>
            </form>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!canInvoice && (
            <p className="text-sm text-slate-500">
              Keur de urenstaat eerst goed om een inkoop- en verkoopfactuur te
              genereren.
            </p>
          )}

          {/* Sales (client) */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Building2 className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Verkoopfactuur — {placement.client.companyName}
                </div>
                <div className="text-xs text-slate-500">
                  {formatHours(totalHours)} u × {formatCurrency(placement.chargeRate)} ={" "}
                  {formatCurrency(money.sell.base)}
                  {hasToeslag && <> + toeslagen = {formatCurrency(revenue)}</>} (excl. BTW)
                </div>
              </div>
            </div>
            {salesInvoiceId ? (
              <Link
                href={`/facturen/${salesInvoiceId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Bekijk
              </Link>
            ) : ts.status === "APPROVED" ? (
              <form action={generateSalesForTimesheet}>
                <input type="hidden" name="timesheetId" value={ts.id} />
                <SubmitButton variant="outline" size="sm">
                  Genereer
                </SubmitButton>
              </form>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </div>

          {/* Purchase (consultant) — of, bij loondienst, salaris i.p.v. inkoopfactuur */}
          {ownStaff ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Coins className="h-[18px] w-[18px]" />
              </div>
              <div className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">Salaris — geen inkoopfactuur.</span>{" "}
                {placement.consultant.firstName} is eigen loondienst-personeel; betaling loopt via het
                salaris (overuren als loon). De loonkost/uur telt alleen mee voor de marge.
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <Coins className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Inkoopfactuur — {placement.consultant.firstName}{" "}
                    {placement.consultant.lastName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatHours(totalHours)} u × {formatCurrency(placement.costRate)} ={" "}
                    {formatCurrency(money.buy.base)}
                    {hasToeslag && <> + toeslagen = {formatCurrency(cost)}</>} (excl. BTW)
                  </div>
                </div>
              </div>
              {purchaseInvoiceId ? (
                <Link
                  href={`/inkoopfacturen/${purchaseInvoiceId}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Bekijk
                </Link>
              ) : canInvoice ? (
                <form action={generatePurchaseForTimesheet}>
                  <input type="hidden" name="timesheetId" value={ts.id} />
                  <SubmitButton variant="outline" size="sm">
                    Genereer
                  </SubmitButton>
                </form>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Uren per dag</CardTitle>
          <span className="text-sm text-slate-500">
            Tarief: {formatCurrency(placement.chargeRate)}/u
          </span>
        </CardHeader>
        {ts.entries.length === 0 ? (
          <CardContent className="text-sm text-slate-500">
            Geen uren geregistreerd.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Dag</TH>
                <TH>Datum</TH>
                <TH>Notitie</TH>
                <TH className="text-right">Km</TH>
                <TH className="text-right">Uren</TH>
              </TR>
            </THead>
            <TBody>
              {ts.entries.map((e) => {
                const weekend = isWeekend(e.date);
                return (
                  <TR key={e.id} className={weekend ? "bg-amber-50/60" : undefined}>
                    <TD className="capitalize">
                      {weekdayFmt.format(e.date)}
                      {weekend && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          weekend
                        </span>
                      )}
                    </TD>
                    <TD>{formatDate(e.date)}</TD>
                    <TD className="text-slate-600">
                      {e.description || <span className="text-slate-300">—</span>}
                    </TD>
                    <TD className="text-right tabular-nums text-slate-600">
                      {e.kilometers ? (
                        formatHours(e.kilometers)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">{formatHours(e.hours)}</TD>
                  </TR>
                );
              })}
              <TR className="hover:bg-transparent">
                <TD className="font-semibold" colSpan={3}>
                  Totaal
                </TD>
                <TD className="text-right font-bold tabular-nums text-slate-600">
                  {ts.kilometers ? formatHours(ts.kilometers) : "—"}
                </TD>
                <TD className="text-right font-bold tabular-nums">
                  {formatHours(totalHours)}
                </TD>
              </TR>
            </TBody>
          </Table>
        )}
      </Card>

      {ts.note && (
        <Card>
          <CardHeader>
            <CardTitle>Notitie</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-slate-600">
            {ts.note}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
