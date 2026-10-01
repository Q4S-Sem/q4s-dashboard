import Link from "next/link";
import { tariefSuffix } from "@/lib/toeslag";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  BookUp,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Mail,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { RECEIVED_INVOICE_STATUSES } from "@/lib/domain";
import { getReceivedDetail } from "@/lib/received-invoices";
import { isSnelStartConnected, snelStartMessage } from "@/lib/snelstart";
import { cn, formatCurrency, formatDate, formatHours } from "@/lib/utils";
import { DiscrepancyMailButton } from "../DiscrepancyMailButton";
import {
  deleteReceivedInvoice,
  pushReceivedInvoiceToSnelStart,
  resetWeekVanuitFactuur,
  setReceivedStatus,
  setReceivedVatFlag,
} from "../actions";

// ---------------------------------------------------------------------------
// ÉÉN ontvangen ZZP-factuur: links wat ONZE urenregistratie zegt, rechts HUN
// document inline. Daartussen het verschil, zodat je in één blik ziet waar het
// misging. Dit is de inkoop (Optie A) — Q4S genereert hier nooit een eigen
// inkoopfactuur, en er wordt niets uitbetaald zonder een expliciete klik.
// ---------------------------------------------------------------------------

export const metadata = { title: "Ontvangen factuur" };
export const dynamic = "force-dynamic";

function Regel({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-100 py-2 last:border-0">
      <dt className="text-[13px] text-ink-500">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-ink-900">{value}</dd>
    </div>
  );
}

export default async function OntvangenFactuurPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ snelstart?: string }>;
}) {
  const { id } = await params;
  const { snelstart } = await searchParams;
  const inv = await getReceivedDetail(id);
  if (!inv) notFound();

  const snelstartMelding = snelStartMessage(snelstart);
  const periode =
    inv.periodStart && inv.periodEnd
      ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}`
      : inv.periodStart || inv.periodEnd
        ? formatDate((inv.periodStart ?? inv.periodEnd) as Date)
        : "—";

  return (
    <div className="space-y-5">
      <BackLink href="/facturatie/inkoop">Terug naar inkoop &amp; betalingen</BackLink>

      <PageHeader
        eyebrow="Inkoop"
        title={`Factuur ${inv.number ?? "(zonder nummer)"}`}
        description={`Van ${inv.consultantName} · binnengekomen ${inv.issueDate ? formatDate(inv.issueDate) : "—"}`}
        actions={<StatusBadge options={RECEIVED_INVOICE_STATUSES} value={inv.status} />}
      />

      {snelstartMelding && (
        <p
          className={cn(
            "rounded-sm border px-3 py-2 text-[13px]",
            snelstartMelding.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {snelstartMelding.text}
        </p>
      )}

      {/* Het verschil: hun factuur naast onze urenregistratie. */}
      {inv.expected ? (
        <div
          className={cn(
            "rounded-sm border p-5 shadow-[0_1px_2px_rgb(0_0_0/.04)]",
            inv.matched ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-4">
              <div>
                <div className="text-xs font-medium text-ink-500">Hun factuur</div>
                <div className="text-2xl font-semibold tabular-nums text-ink-900">
                  {formatCurrency(inv.amount)}
                </div>
              </div>
              <div className="text-base text-ink-300">vs</div>
              <div>
                <div className="text-xs font-medium text-ink-500">Onze urenregistratie</div>
                <div className="text-2xl font-semibold tabular-nums text-ink-900">
                  {formatCurrency(inv.expected.total)}
                </div>
                <div className="text-xs text-ink-400">
                  {inv.expected.weeks} wk · {formatHours(inv.expected.hours)} u
                </div>
              </div>
              <div className="self-stretch border-l border-ink-200" />
              <div>
                <div className="text-xs font-medium text-ink-500">Verschil</div>
                <div
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    inv.matched ? "text-emerald-700" : "text-red-700",
                  )}
                >
                  {(inv.diff ?? 0) > 0 ? "+" : ""}
                  {formatCurrency(inv.diff ?? 0)}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {inv.matched ? (
                <Badge color="green">Klopt</Badge>
              ) : (
                <Badge color="red">Afwijking</Badge>
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
            <p className="mt-3 text-[13px] text-red-700">
              Vergelijk hieronder <strong>onze urenregistratie</strong> met <strong>hun factuur</strong>{" "}
              om te zien waar het misging. Klopt het niet? Mail de freelancer — we{" "}
              <strong>wachten dan op een aangepaste factuur</strong> en betalen pas ná de correctie.
            </p>
          )}
          {!inv.matched && inv.status === "PAID" && (
            <p className="mt-3 text-[13px] text-ink-500">
              Deze factuur is <strong>betaald</strong> ondanks het verschil — bewaard als
              administratieve notitie.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-sm border border-ink-200 bg-white px-4 py-3 text-[13px] text-ink-500">
          Geen periode ingevuld — zonder periode valt er niet tegen de urenstaat te vergelijken.
        </p>
      )}

      {/* Een afwijking komt vaak door een gewijzigd ZZP-tarief in de plaatsing. */}
      {inv.expected && !inv.matched && inv.status !== "PAID" && inv.activePlacements.length > 0 && (
        <div className="rounded-sm border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-amber-900">Klopt het uurtarief nog?</p>
              <p className="mt-1 text-[13px] text-amber-800">
                Een afwijking komt vaak doordat de ZZP&apos;er zijn tarief heeft gewijzigd terwijl de
                plaatsing nog het oude tarief heeft. Werk het bij en de volgende factuur klopt vanzelf.
              </p>
              <div className="mt-3 space-y-2">
                {inv.activePlacements.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0 text-[13px]">
                      <span className="font-medium text-ink-900">{p.title}</span>
                      <span className="text-ink-400"> · {p.clientName}</span>
                      <span className="block text-xs text-ink-500">
                        Plaatsingstarief: inkoop {formatCurrency(p.costRate)}{tariefSuffix(p)} · verkoop{" "}
                        {formatCurrency(p.chargeRate)}{tariefSuffix(p)}
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

      {/* Zij-aan-zij: onze uren links, hun document rechts. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-ink-400" /> Onze urenregistratie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inv.weeks.length > 0 ? (
              <>
                <div className="overflow-hidden rounded-sm border border-ink-200">
                  <table className="w-full text-[13px]">
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
                            {w.weekKey ? (
                              <Link
                                href={`/facturatie/${w.placementId}/${w.weekKey}`}
                                className={buttonVariants({ variant: "outline", size: "sm" })}
                              >
                                Dossier
                              </Link>
                            ) : (
                              <span className="text-xs text-ink-300">—</span>
                            )}
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
                  Klik <strong>Dossier</strong> bij een week om de urenstaat, de factuur en het
                  contract naast elkaar te zien.
                </p>
              </>
            ) : (
              <p className="py-6 text-center text-[13px] text-ink-500">
                Geen urenstaten in deze periode om mee te vergelijken.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-ink-400" /> Hun factuur
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
            <div className="flex items-baseline justify-between rounded-sm bg-ink-50 px-3 py-2">
              <span className="text-[13px] text-ink-500">Gefactureerd (incl. btw)</span>
              <span className="text-base font-semibold tabular-nums text-ink-900">
                {formatCurrency(inv.amount)}
              </span>
            </div>
            {inv.hasFile ? (
              <iframe
                src={`/api/ontvangen-factuur/${inv.id}`}
                title={inv.originalName ?? "Factuur"}
                className="h-[560px] w-full rounded-sm border border-ink-200 bg-ink-50"
              />
            ) : (
              <div className="rounded-sm border border-dashed border-ink-300 bg-ink-50/60 px-4 py-12 text-center text-[13px] text-ink-500">
                Er zit geen bestand bij deze factuur.
                <div className="mt-2">
                  <Link
                    href="/facturatie"
                    className="font-medium text-brand-700 underline underline-offset-2"
                  >
                    Voeg de factuur toe in Week verwerken
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gegevens + wat je ermee kunt */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Gegevens</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <Regel label="Freelancer" value={inv.consultantName} />
              <Regel label="Factuurnummer" value={inv.number ?? "—"} />
              <Regel label="Factuurdatum" value={inv.issueDate ? formatDate(inv.issueDate) : "—"} />
              <Regel label="Periode" value={periode} />
              <Regel label="Gefactureerd (incl. btw)" value={formatCurrency(inv.amount)} />
              {inv.vatAmount != null && (
                <Regel label="Waarvan btw" value={formatCurrency(inv.vatAmount)} />
              )}
              {inv.kilometers != null && (
                <Regel label="Kilometers op factuur" value={`${formatHours(inv.kilometers)} km`} />
              )}
              {inv.notes && <Regel label="Notitie" value={inv.notes} />}
            </dl>

            {/* Btw-voorbelasting: telt de btw van deze factuur mee in de aangifte? */}
            <form
              action={setReceivedVatFlag}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-ink-200 bg-ink-50/60 px-4 py-3"
            >
              <input type="hidden" name="id" value={inv.id} />
              <label className="flex cursor-pointer items-start gap-3 text-[13px]">
                <input
                  type="checkbox"
                  name="countForVat"
                  defaultChecked={inv.countForVat}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
                />
                <span>
                  <span className="font-medium text-ink-900">Btw meetellen als voorbelasting</span>
                  <span className="mt-0.5 block text-ink-500">
                    Telt de btw van deze factuur mee in het btw-overzicht onder Rapportage.
                    {inv.vatAmount == null && (
                      <span className="text-amber-700">
                        {" "}
                        Let op: er is nog geen btw-bedrag bekend op deze factuur.
                      </span>
                    )}
                  </span>
                </span>
              </label>
              <SubmitButton size="sm" variant="outline" pendingLabel="Opslaan…">
                Opslaan
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acties</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {inv.status !== "APPROVED" && inv.status !== "PAID" && (
              <form action={setReceivedStatus}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="status" value="APPROVED" />
                <input type="hidden" name="terug" value="detail" />
                <SubmitButton variant="outline" pendingLabel="…">
                  <Check className="h-4 w-4" /> Goedkeuren
                </SubmitButton>
              </form>
            )}
            {inv.status !== "PAID" && (
              <form action={setReceivedStatus}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="status" value="PAID" />
                <input type="hidden" name="terug" value="detail" />
                <SubmitButton variant="success" pendingLabel="…">
                  <Wallet className="h-4 w-4" /> Markeer betaald
                </SubmitButton>
              </form>
            )}
            {inv.status !== "PAID" && inv.matched === false && (
              <form action={setReceivedStatus}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="status" value="DISPUTED" />
                <input type="hidden" name="terug" value="detail" />
                <SubmitButton variant="outline" pendingLabel="…">
                  <AlertTriangle className="h-4 w-4" /> Markeer als afwijking
                </SubmitButton>
              </form>
            )}

            {/* Handmatig boeken in de boekhouding — bewust geen automatische doorzet. */}
            {isSnelStartConnected() &&
              (inv.snelstartId ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-ink-100 px-3 py-1 text-[13px] font-medium text-ink-600">
                  <BookUp className="h-4 w-4" /> In SnelStart geboekt
                </span>
              ) : (
                <form action={pushReceivedInvoiceToSnelStart}>
                  <input type="hidden" name="id" value={inv.id} />
                  <SubmitButton variant="outline" pendingLabel="Boeken…">
                    <BookUp className="h-4 w-4" /> Naar SnelStart
                  </SubmitButton>
                </form>
              ))}

            <ConfirmSubmit
              action={deleteReceivedInvoice}
              id={inv.id}
              trigger="button"
              variant="danger"
              message="Deze factuur verwijderen?"
              description="Alleen de ontvangen factuur gaat weg. Wil je ook de urenstaat en de week terugzetten? Gebruik dan 'Verwijderen & resetten'."
              confirmLabel="Verwijderen"
            >
              Verwijderen
            </ConfirmSubmit>

            {inv.status !== "PAID" && (
              <ConfirmSubmit
                action={resetWeekVanuitFactuur}
                id={inv.id}
                trigger="button"
                variant="danger"
                message="Deze week verwijderen en resetten?"
                description="Fout gemaakt? Dit verwijdert deze factuur, de urenstaat van deze week én een eventuele concept-verkoopfactuur, en zet de weekstaat terug in Week verwerken. Verstuurde of betaalde verkoopfacturen blijven beschermd."
                confirmLabel="Verwijderen & resetten"
              >
                <span className="inline-flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Verwijderen &amp; resetten
                </span>
              </ConfirmSubmit>
            )}

            {inv.status === "PAID" && (
              <p className="flex items-start gap-2 text-xs text-ink-500">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                Deze factuur is betaald — een betaalde factuur zetten we nooit automatisch terug.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
