import Link from "next/link";
import { Inbox, ArrowRight, Receipt, Coins, Users, Sparkles, Send, Archive, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, formatHours, round2 } from "@/lib/utils";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { pendingWorkByConsultant } from "@/lib/facturatie";
import { getOutbox } from "@/lib/verzenden";
import { processAll } from "./actions";

export const metadata = { title: "Verwerken" };
export const dynamic = "force-dynamic";

export default async function VerwerkenPage({
  searchParams,
}: {
  searchParams: Promise<{
    batch?: string;
    inkoop?: string;
    verkoop?: string;
    appr?: string;
    err?: string;
  }>;
}) {
  const sp = await searchParams;
  const [rows, outbox] = await Promise.all([pendingWorkByConsultant(), getOutbox()]);

  const totals = rows.reduce(
    (acc, r) => ({
      teFactureren: round2(acc.teFactureren + r.teFactureren),
      teBetalen: round2(acc.teBetalen + r.teBetalen),
      needApproval: acc.needApproval + r.needApproval,
    }),
    { teFactureren: 0, teBetalen: 0, needApproval: 0 },
  );

  const readyClient = outbox.sales.length;
  const readyWorker = outbox.purchase.length;
  // Medewerkers met daadwerkelijk te genereren facturen (niet puur ter goedkeuring).
  const readyToBill = rows.filter((r) => r.teFactureren > 0 || r.teBetalen > 0).length;
  const batchCreated = Number(sp.inkoop ?? 0) + Number(sp.verkoop ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturatie verwerken"
        description="Per medewerker stap voor stap, of in één klik alles automatisch: uren → inkoopfactuur → verkoopfactuur met marge → klaar om te versturen."
        actions={
          <>
            <Link href="/inbox/status" className={buttonVariants({ variant: "outline" })}>
              <ClipboardList className="h-4 w-4" /> Timesheet-status
            </Link>
            <Link href="/verwerken/archief" className={buttonVariants({ variant: "outline" })}>
              <Archive className="h-4 w-4" /> Archief
            </Link>
          </>
        }
      />

      {sp.batch === "1" && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            Number(sp.err) > 0
              ? "bg-amber-50 text-amber-800"
              : batchCreated > 0
                ? "bg-emerald-50 text-emerald-800"
                : "bg-slate-50 text-slate-600"
          }`}
        >
          {batchCreated > 0 ? (
            <>
              Automatisch verwerkt: {sp.inkoop} inkoopfactu{Number(sp.inkoop) === 1 ? "ur" : "ren"} en {sp.verkoop}{" "}
              verkoopfactu{Number(sp.verkoop) === 1 ? "ur" : "ren"} aangemaakt.
              {Number(sp.appr) > 0
                ? ` ${sp.appr} weeksta${Number(sp.appr) === 1 ? "at" : "ten"} nog ter goedkeuring — die keur je zelf goed.`
                : ""}
              {Number(sp.err) > 0 ? ` ${sp.err} regel(s) niet gelukt.` : ""} De facturen staan klaar in de{" "}
              <Link href="/verzenden" className="font-medium underline">
                verzendmap
              </Link>
              .
            </>
          ) : (
            <>
              Niets automatisch te genereren.
              {Number(sp.appr) > 0
                ? ` ${sp.appr} weeksta${Number(sp.appr) === 1 ? "at" : "ten"} wacht nog op goedkeuring — die keur je zelf goed per medewerker.`
                : " Er waren geen goedgekeurde uren om te factureren."}
              {Number(sp.err) > 0 ? ` (${sp.err} regel(s) gaven een fout.)` : ""}
            </>
          )}
        </p>
      )}

      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Timesheets komen binnen via <strong>admin@q4s.nl</strong> of upload je zelf in de{" "}
        <Link href="/inbox" className="font-medium text-brand-700 hover:underline">
          inbox
        </Link>
        . Op de{" "}
        <Link href="/inbox/status" className="font-medium text-brand-700 hover:underline">
          timesheet-status
        </Link>{" "}
        zie je wie er nog ontbreekt.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Te factureren" value={formatCurrency(totals.teFactureren)} icon={<Receipt className="h-5 w-5" />} accent="brand" />
        <StatCard label="Te betalen (inkoop)" value={formatCurrency(totals.teBetalen)} icon={<Coins className="h-5 w-5" />} accent="violet" />
        <StatCard label="Medewerkers met werk" value={rows.length} sub={totals.needApproval > 0 ? `${totals.needApproval} ter goedkeuring` : undefined} icon={<Users className="h-5 w-5" />} accent="amber" />
      </div>

      {/* Batch: alles automatisch genereren — alleen als er echt te factureren valt */}
      {readyToBill > 0 && (
        <Card className="border-brand-200 bg-brand-50/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-brand-600" /> Alles in één keer verwerken
              </p>
              <p className="mt-1 max-w-xl text-sm text-slate-600">
                Genereert automatisch de inkoop- én verkoopfacturen voor {readyToBill} medewerker(s) met goedgekeurde
                uren. Weekstaten die nog ter goedkeuring staan worden hiermee overgeslagen — die keur je zelf goed per
                medewerker.
              </p>
            </div>
            <form action={processAll}>
              <SubmitButton pendingLabel="Facturen genereren…">
                <Sparkles className="h-4 w-4" /> Genereer alle facturen
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Klaar om te versturen (verzendmap) */}
      {(readyClient > 0 || readyWorker > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-slate-400" /> Klaar om te versturen
            </CardTitle>
            <Link href="/verzenden" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Naar verzendmap <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-2xl font-bold text-slate-900">{readyClient}</p>
              <p className="text-sm text-slate-500">verkoopfactu{readyClient === 1 ? "ur" : "ren"} naar de klant</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-2xl font-bold text-slate-900">{readyWorker}</p>
              <p className="text-sm text-slate-500">
                inkoopfactu{readyWorker === 1 ? "ur" : "ren"} naar de medewerker
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Uitbetaling naar de medewerker gaat later automatisch.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="Niets te verwerken"
          description="Er zijn geen openstaande uren. Zodra een timesheet binnenkomt en is bevestigd, verschijnt de medewerker hier."
          action={
            <Link href="/inbox" className={buttonVariants()}>
              <Inbox className="h-4 w-4" /> Naar de inbox
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Medewerker</TH>
                <TH>Discipline</TH>
                <TH className="text-right">Weken</TH>
                <TH className="text-right">Uren</TH>
                <TH className="text-right">Te factureren</TH>
                <TH className="text-right">Te betalen</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.consultantId}>
                  <TD>
                    <Link
                      href={`/verwerken/${r.consultantId}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {r.name}
                    </Link>
                    {r.needApproval > 0 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        {r.needApproval} ter goedkeuring
                      </span>
                    )}
                  </TD>
                  <TD className="text-slate-500">
                    {r.discipline ? labelFor(DISCIPLINES, r.discipline) : "—"}
                  </TD>
                  <TD className="text-right tabular-nums">{r.weeks}</TD>
                  <TD className="text-right tabular-nums">{formatHours(r.hours)}</TD>
                  <TD className="text-right tabular-nums">{formatCurrency(r.teFactureren)}</TD>
                  <TD className="text-right tabular-nums">{formatCurrency(r.teBetalen)}</TD>
                  <TD className="text-right">
                    <Link
                      href={`/verwerken/${r.consultantId}`}
                      className={buttonVariants({ size: "sm" })}
                    >
                      Verwerken <ArrowRight className="h-4 w-4" />
                    </Link>
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
