import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Check,
  Trash2,
  FileText,
  ExternalLink,
  ClipboardList,
  Mail,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn, formatCurrency, formatDate, formatHours } from "@/lib/utils";
import { RECEIVED_INVOICE_STATUSES } from "@/lib/domain";
import { getReceivedDetail } from "@/lib/received-invoices";
import { setReceivedStatus, deleteReceivedInvoice, setReceivedVatFlag } from "../actions";
import { DiscrepancyMailButton } from "../DiscrepancyMailButton";

export const metadata = { title: "Ontvangen factuur" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-100 py-2 last:border-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink-900">{value}</dd>
    </div>
  );
}

export default async function ReceivedDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getReceivedDetail(id);
  if (!inv) notFound();

  const period =
    inv.periodStart && inv.periodEnd
      ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}`
      : inv.periodStart || inv.periodEnd
        ? formatDate((inv.periodStart ?? inv.periodEnd) as Date)
        : "—";

  return (
    <div className="space-y-6">
      <BackLink href="/ontvangen-facturen">
        Terug naar ontvangen facturen
      </BackLink>

      <PageHeader
        title={`Factuur ${inv.number ?? "(zonder nummer)"}`}
        description={`Van ${inv.consultantName} · binnengekomen ${inv.issueDate ? formatDate(inv.issueDate) : "—"}`}
        actions={<StatusBadge options={RECEIVED_INVOICE_STATUSES} value={inv.status} />}
      />

      {/* BTW-voorbelasting: meetellen in de aangifte? Standaard uit — de self-billing
          inkoopfactuur dekt deze ZZP-betaling meestal al. Aanzetten voor ZZP'ers die
          zelf factureren zonder dat Q4S een inkoopfactuur maakt. */}
      <form
        action={setReceivedVatFlag}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 bg-ink-50/60 px-4 py-3"
      >
        <input type="hidden" name="id" value={inv.id} />
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="countForVat"
            defaultChecked={inv.countForVat}
            className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
          />
          <span>
            <span className="font-medium text-ink-900">BTW meetellen als voorbelasting</span>
            <span className="mt-0.5 block text-ink-500">
              Zet aan als deze ZZP'er zélf factureert en Q4S géén inkoopfactuur maakt — zo voorkom je dubbeltelling.
              {inv.vatAmount == null && (
                <span className="text-amber-700"> Let op: er is nog geen BTW-bedrag bekend op deze factuur.</span>
              )}
            </span>
          </span>
        </label>
        <SubmitButton size="sm" variant="outline" pendingLabel="Opslaan…">Opslaan</SubmitButton>
      </form>

      {/* Verschil-balk: hun factuur vs onze urenregistratie */}
      {inv.expected ? (
        <div
          className={cn(
            "rounded-2xl border p-5 shadow-sm",
            inv.matched ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-1 flex-wrap items-center justify-center gap-x-8 gap-y-4 text-center sm:justify-start">
              <div>
                <div className="text-xs font-medium text-ink-500">Hun factuur</div>
                <div className="text-2xl font-bold tabular-nums text-ink-900">
                  {formatCurrency(inv.amount)}
                </div>
              </div>
              <div className="text-lg font-medium text-ink-300">vs</div>
              <div>
                <div className="text-xs font-medium text-ink-500">Onze urenregistratie</div>
                <div className="text-2xl font-bold tabular-nums text-ink-900">
                  {formatCurrency(inv.expected.total)}
                </div>
                <div className="text-xs text-ink-400">
                  {inv.expected.weeks} wk · {formatHours(inv.expected.hours)} u
                </div>
              </div>
              <div className="self-stretch border-l border-ink-300/70" />
              <div>
                <div className="text-xs font-medium text-ink-500">Verschil</div>
                <div
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    inv.matched ? "text-emerald-700" : "text-red-700",
                  )}
                >
                  {(inv.diff ?? 0) > 0 ? "+" : ""}
                  {formatCurrency(inv.diff ?? 0)}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-2">
              {inv.matched ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Klopt
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                  <AlertTriangle className="h-4 w-4" /> Afwijking
                </span>
              )}
              {!inv.matched && inv.status !== "PAID" && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <DiscrepancyMailButton id={inv.id} alreadyMailed={inv.mailed} variant="button" />
                  {inv.email && (
                    <a
                      href={`mailto:${inv.email}?subject=${encodeURIComponent(
                        `Factuur ${inv.number ?? ""} — aangepaste factuur`,
                      )}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      title="Open het mailverkeer met deze persoon"
                    >
                      <Mail className="h-4 w-4" /> Mailwisseling
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          {!inv.matched && inv.status !== "PAID" && (
            <p className="mt-3 text-center text-sm text-red-700 sm:text-left">
              Vergelijk hieronder <strong>onze urenregistratie</strong> met <strong>hun factuur</strong> om te
              zien waar het misging. Klopt het niet? Mail de medewerker — we{" "}
              <strong>wachten dan op een aangepaste factuur</strong> en betalen pas ná de correctie.
            </p>
          )}
          {!inv.matched && inv.status === "PAID" && (
            <p className="mt-3 text-center text-sm text-ink-500 sm:text-left">
              Deze factuur is <strong>betaald</strong> ondanks het verschil — bewaard als administratieve notitie.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-500">
          Geen periode ingevuld — vul de periode aan om automatisch tegen de timesheet te controleren.
        </p>
      )}

      {/* Tarief-controle: een afwijking komt vaak door een gewijzigd ZZP-tarief. */}
      {inv.expected && !inv.matched && inv.status !== "PAID" && inv.activePlacements.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">Klopt het uurtarief nog?</p>
              <p className="mt-1 text-sm text-amber-800">
                Een afwijking komt vaak doordat de ZZP&apos;er zijn tarief heeft gewijzigd, terwijl het tarief
                in de plaatsing nog het oude is. Controleer het en werk het zo nodig bij — dan klopt de
                volgende factuur weer vanzelf.
              </p>
              <div className="mt-3 space-y-2">
                {inv.activePlacements.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <span className="font-medium text-ink-900">{p.title}</span>
                      <span className="text-ink-400"> · {p.clientName}</span>
                      <span className="block text-xs text-ink-500">
                        Plaatsingstarief: inkoop {formatCurrency(p.costRate)}/u · verkoop{" "}
                        {formatCurrency(p.chargeRate)}/u
                      </span>
                    </div>
                    <Link
                      href={`/plaatsingen/${p.id}/bewerken`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Tarief bijwerken
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zij-aan-zij vergelijking: urenstaat links, factuur rechts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Onze urenregistratie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-brand-600" /> Onze urenregistratie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inv.weeks.length > 0 ? (
              <>
                <div className="overflow-hidden rounded-lg border border-ink-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink-50 text-xs text-ink-500">
                        <th className="px-3 py-2 text-left font-medium">Week</th>
                        <th className="px-3 py-2 text-right font-medium">Uren</th>
                        <th className="px-3 py-2 text-right font-medium">Bedrag</th>
                        <th className="px-3 py-2 text-right font-medium">
                          <span className="sr-only">Openen</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.weeks.map((w) => (
                        <tr key={w.timesheetId} className="border-t border-ink-100 hover:bg-ink-50/60">
                          <td className="px-3 py-2 text-ink-700">
                            {w.weekLabel}
                            <span className="block text-xs text-ink-400">{w.clientName}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                            {formatHours(w.hours)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                            {formatCurrency(w.buyTotal)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Link
                              href={`/uren/${w.timesheetId}`}
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {inv.expected && (
                        <tr className="border-t border-ink-200 bg-ink-50 font-semibold text-ink-800">
                          <td className="px-3 py-2">Totaal (ex btw)</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatHours(inv.expected.hours)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrency(inv.expected.subtotal)}
                          </td>
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-ink-400">
                  Klik <strong>Open</strong> bij een week om de volledige urenstaat te bekijken en met de
                  factuur te vergelijken.
                </p>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-ink-500">
                Geen urenstaten in deze periode om mee te vergelijken.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Hun factuur */}
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-brand-600" /> Hun factuur
            </CardTitle>
            {inv.hasFile && (
              <a
                href={`/api/ontvangen-factuur/${inv.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ExternalLink className="h-4 w-4" /> Nieuw tabblad
              </a>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between rounded-lg bg-ink-50 px-3 py-2">
              <span className="text-sm text-ink-500">Gefactureerd (incl. btw)</span>
              <span className="text-lg font-bold tabular-nums text-ink-900">
                {formatCurrency(inv.amount)}
              </span>
            </div>
            {inv.hasFile ? (
              <iframe
                src={`/api/ontvangen-factuur/${inv.id}`}
                title={inv.originalName ?? "Factuur"}
                className="h-[560px] w-full rounded-lg border border-ink-200 bg-ink-50"
              />
            ) : (
              <div className="rounded-lg border border-dashed border-ink-300 bg-ink-50/60 px-4 py-12 text-center text-sm text-ink-500">
                Geen bestand bijgevoegd bij deze factuur.
                <div className="mt-2">
                  <Link
                    href="/ontvangen-facturen/importeren"
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Importeer opnieuw met de PDF erbij
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gegevens + statusacties */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Gegevens</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <Row label="Medewerker" value={inv.consultantName} />
              <Row label="Factuurnummer" value={inv.number ?? "—"} />
              <Row label="Factuurdatum" value={inv.issueDate ? formatDate(inv.issueDate) : "—"} />
              <Row label="Periode" value={period} />
              <Row label="Gefactureerd (incl. btw)" value={formatCurrency(inv.amount)} />
              {inv.vatAmount != null && <Row label="Waarvan btw" value={formatCurrency(inv.vatAmount)} />}
              {inv.kilometers != null && (
                <Row label="Kilometers op factuur" value={`${formatHours(inv.kilometers)} km`} />
              )}
              {inv.notes && <Row label="Notitie" value={inv.notes} />}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acties</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {inv.status !== "APPROVED" && inv.status !== "PAID" && (
              <form action={setReceivedStatus}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="status" value="APPROVED" />
                <SubmitButton variant="outline" pendingLabel="…">
                  <Check className="h-4 w-4" /> Gecontroleerd
                </SubmitButton>
              </form>
            )}
            {inv.status !== "PAID" && (
              <form action={setReceivedStatus}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="status" value="PAID" />
                <SubmitButton variant="success" pendingLabel="…">
                  <Wallet className="h-4 w-4" /> Markeer betaald
                </SubmitButton>
              </form>
            )}
            <form action={deleteReceivedInvoice}>
              <input type="hidden" name="id" value={inv.id} />
              <Button type="submit" variant="ghost" title="Verwijderen" aria-label="Verwijderen">
                <Trash2 className="h-4 w-4" /> Verwijderen
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
