import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatCurrency, formatDate, formatHours, formatPercent } from "@/lib/utils";
import { PURCHASE_INVOICE_STATUSES } from "@/lib/domain";
import { setPurchaseInvoiceStatus, deletePurchaseInvoice } from "../actions";
import { PrintButton } from "../PrintButton";

export const metadata = { title: "Inkoopfactuur" };

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
    <form action={setPurchaseInvoiceStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant}>
        {children}
      </Button>
    </form>
  );
}

function Lines({ items }: { items: (string | null | undefined)[] }) {
  return (
    <>
      {items
        .filter((x) => x && x.trim())
        .map((x, i) => (
          <div key={i}>{x}</div>
        ))}
    </>
  );
}

export default async function InkoopfactuurDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [invoice, settings] = await Promise.all([
    db.purchaseInvoice.findUnique({
      where: { id },
      include: { consultant: true, lines: true },
    }),
    getCompanySettings(),
  ]);

  if (!invoice) notFound();
  const c = invoice.consultant;
  const supplierName = c.companyName || `${c.firstName} ${c.lastName}`;

  return (
    <div className="space-y-6">
      {/* Toolbar (hidden when printing) */}
      <div className="no-print space-y-4">
        <Link
          href="/inkoopfacturen"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar inkoopfacturen
        </Link>

        {error === "locked" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Een betaalde inkoopfactuur kan niet verwijderd worden.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink-900">
              {invoice.number}
            </h1>
            <StatusBadge options={PURCHASE_INVOICE_STATUSES} value={invoice.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {invoice.status === "DRAFT" && (
              <>
                <StatusButton id={invoice.id} status="APPROVED" variant="primary">
                  Goedkeuren (te betalen)
                </StatusButton>
                <StatusButton id={invoice.id} status="CANCELLED" variant="outline">
                  Annuleren
                </StatusButton>
                <ConfirmSubmit action={deletePurchaseInvoice} id={invoice.id} message="Inkoopfactuur verwijderen? De urenstaten komen weer vrij.">
                  Verwijderen
                </ConfirmSubmit>
              </>
            )}
            {invoice.status === "APPROVED" && (
              <>
                <StatusButton id={invoice.id} status="PAID" variant="success">
                  Markeer als betaald
                </StatusButton>
                <StatusButton id={invoice.id} status="DRAFT" variant="outline">
                  Terug naar concept
                </StatusButton>
              </>
            )}
            {invoice.status === "PAID" && (
              <StatusButton id={invoice.id} status="APPROVED" variant="outline">
                Markeer als onbetaald
              </StatusButton>
            )}
            {invoice.status === "CANCELLED" && (
              <ConfirmSubmit action={deletePurchaseInvoice} id={invoice.id} message="Inkoopfactuur definitief verwijderen?">
                Verwijderen
              </ConfirmSubmit>
            )}
            <Link href={`/inkoopfacturen/${invoice.id}/bewerken`} className={buttonVariants({ variant: "outline" })}>
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <PrintButton />
          </div>
        </div>
      </div>

      {/* The invoice document */}
      <div className="print-area mx-auto max-w-3xl rounded-xl border border-ink-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xl font-bold text-ink-900">{supplierName}</div>
            <div className="mt-2 text-sm text-ink-600">
              <Lines
                items={[
                  c.companyName ? `${c.firstName} ${c.lastName}` : null,
                  c.address,
                  [c.postalCode, c.city].filter(Boolean).join(" "),
                  c.country,
                ]}
              />
              <div className="mt-2">
                <Lines
                  items={[
                    c.vatNumber ? `BTW: ${c.vatNumber}` : null,
                    c.kvkNumber ? `KvK: ${c.kvkNumber}` : null,
                    c.iban ? `IBAN: ${c.iban}` : null,
                  ]}
                />
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold uppercase tracking-tight text-ink-900">
              Inkoopfactuur
            </div>
            <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
              Self-billing
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-8">
                <dt className="text-ink-500">Factuurnummer</dt>
                <dd className="font-medium text-ink-900">{invoice.number}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-ink-500">Factuurdatum</dt>
                <dd className="text-ink-900">{formatDate(invoice.issueDate)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-ink-500">Vervaldatum</dt>
                <dd className="text-ink-900">{formatDate(invoice.dueDate)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-ink-100 pt-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              Te betalen door
            </div>
            <div className="mt-2 text-sm text-ink-700">
              <div className="font-semibold text-ink-900">
                {settings.companyName || "Q4S"}
              </div>
              <Lines
                items={[
                  settings.address,
                  [settings.postalCode, settings.city].filter(Boolean).join(" "),
                  settings.country,
                  settings.vatNumber ? `BTW: ${settings.vatNumber}` : null,
                  settings.kvkNumber ? `KvK: ${settings.kvkNumber}` : null,
                ]}
              />
            </div>
          </div>
          <div className="text-right text-sm text-ink-600">
            <Lines items={[settings.email, settings.phone, settings.website]} />
          </div>
        </div>

        {/* Lines */}
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="py-2 pr-2">Omschrijving</th>
              <th className="py-2 px-2 text-right">Uren</th>
              <th className="py-2 px-2 text-right">Tarief</th>
              <th className="py-2 pl-2 text-right">Bedrag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-2.5 pr-2 text-ink-700">{l.description}</td>
                <td className="py-2.5 px-2 text-right tabular-nums">{formatHours(l.quantity)}</td>
                <td className="py-2.5 px-2 text-right tabular-nums">{formatCurrency(l.unitPrice)}</td>
                <td className="py-2.5 pl-2 text-right tabular-nums">{formatCurrency(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">Subtotaal</span>
              <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">BTW ({formatPercent(invoice.vatRate)})</span>
              <span className="tabular-nums">{formatCurrency(invoice.vatAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-bold text-ink-900">
              <span>Totaal</span>
              <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-ink-100 pt-6 text-sm text-ink-600">
          {c.iban ? (
            <p>
              Q4S betaalt het totaalbedrag aan{" "}
              <span className="font-medium text-ink-900">{c.iban}</span> o.v.v.
              factuurnummer {invoice.number}.
            </p>
          ) : (
            <p className="text-ink-500">
              Geen IBAN bekend voor {supplierName}; vul deze aan in het werknemersdossier.
            </p>
          )}
          {invoice.notes && <p className="mt-3">{invoice.notes}</p>}
          <p className="mt-3 text-ink-500">
            Self-billing factuur opgesteld door {settings.companyName || "Q4S"} namens {supplierName}.
          </p>
        </div>
      </div>
    </div>
  );
}
