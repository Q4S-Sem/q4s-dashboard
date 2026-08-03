import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatCurrency, formatDate, formatHours, formatPercent } from "@/lib/utils";
import { INVOICE_STATUSES } from "@/lib/domain";
import { setInvoiceStatus, deleteInvoice } from "../actions";
import { PrintButton } from "../PrintButton";

export const metadata = { title: "Factuur" };

function effectiveStatus(status: string, dueDate: Date, now: Date) {
  if (status === "SENT" && dueDate < now) return "OVERDUE";
  return status;
}

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
    <form action={setInvoiceStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant}>
        {children}
      </Button>
    </form>
  );
}

/** Render a multi-line address block, skipping empty lines. */
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

export default async function FactuurDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const now = new Date();

  const [invoice, settings] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: { client: true, lines: true },
    }),
    getCompanySettings(),
  ]);

  if (!invoice) notFound();

  const status = effectiveStatus(invoice.status, invoice.dueDate, now);
  const c = invoice.client;

  return (
    <div className="space-y-6">
      {/* Toolbar (hidden when printing) */}
      <div className="no-print space-y-4">
        <Link
          href="/facturen"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar facturen
        </Link>

        {error === "locked" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Een verzonden of betaalde factuur kan niet verwijderd worden.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {invoice.number}
            </h1>
            <StatusBadge options={INVOICE_STATUSES} value={status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {invoice.status === "DRAFT" && (
              <>
                <StatusButton id={invoice.id} status="SENT" variant="primary">
                  Markeer als verzonden
                </StatusButton>
                <StatusButton id={invoice.id} status="CANCELLED" variant="outline">
                  Annuleren
                </StatusButton>
                <ConfirmSubmit action={deleteInvoice} id={invoice.id} message="Factuur verwijderen? De urenstaten komen weer vrij.">
                  Verwijderen
                </ConfirmSubmit>
              </>
            )}
            {invoice.status === "SENT" && (
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
              <StatusButton id={invoice.id} status="SENT" variant="outline">
                Markeer als onbetaald
              </StatusButton>
            )}
            {invoice.status === "CANCELLED" && (
              <ConfirmSubmit action={deleteInvoice} id={invoice.id} message="Factuur definitief verwijderen?">
                Verwijderen
              </ConfirmSubmit>
            )}
            <Link
              href={`/facturen/${invoice.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <PrintButton />
          </div>
        </div>
      </div>

      {/* The invoice document */}
      <div className="print-area mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xl font-bold text-slate-900">
              {settings.companyName || "Q4S"}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              <Lines
                items={[
                  settings.address,
                  [settings.postalCode, settings.city].filter(Boolean).join(" "),
                  settings.country,
                ]}
              />
              <div className="mt-2">
                <Lines
                  items={[
                    settings.email,
                    settings.phone,
                    settings.website,
                  ]}
                />
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold uppercase tracking-tight text-slate-900">
              Factuur
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-8">
                <dt className="text-slate-500">Factuurnummer</dt>
                <dd className="font-medium text-slate-900">{invoice.number}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-slate-500">Factuurdatum</dt>
                <dd className="text-slate-900">{formatDate(invoice.issueDate)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-slate-500">Vervaldatum</dt>
                <dd className="text-slate-900">{formatDate(invoice.dueDate)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-slate-100 pt-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Factuur aan
            </div>
            <div className="mt-2 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">{c.companyName}</div>
              <Lines
                items={[
                  c.contactName,
                  c.address,
                  [c.postalCode, c.city].filter(Boolean).join(" "),
                  c.country,
                  c.vatNumber ? `BTW: ${c.vatNumber}` : null,
                ]}
              />
            </div>
          </div>
          <div className="text-right text-sm text-slate-600">
            <Lines
              items={[
                settings.vatNumber ? `BTW: ${settings.vatNumber}` : null,
                settings.kvkNumber ? `KvK: ${settings.kvkNumber}` : null,
                settings.iban ? `IBAN: ${settings.iban}` : null,
              ]}
            />
          </div>
        </div>

        {/* Lines */}
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Omschrijving</th>
              <th className="py-2 px-2 text-right">Uren</th>
              <th className="py-2 px-2 text-right">Tarief</th>
              <th className="py-2 pl-2 text-right">Bedrag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-2.5 pr-2 text-slate-700">{l.description}</td>
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
              <span className="text-slate-500">Subtotaal</span>
              <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">BTW ({formatPercent(invoice.vatRate)})</span>
              <span className="tabular-nums">{formatCurrency(invoice.vatAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-900">
              <span>Totaal</span>
              <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-slate-100 pt-6 text-sm text-slate-600">
          {settings.iban && (
            <p>
              Gelieve het totaalbedrag binnen {c.paymentTermDays} dagen te voldoen op{" "}
              <span className="font-medium text-slate-900">{settings.iban}</span> o.v.v.
              factuurnummer {invoice.number}.
            </p>
          )}
          {invoice.notes && <p className="mt-3">{invoice.notes}</p>}
          <p className="mt-3 font-medium text-slate-900">
            {settings.companyName || "Q4S B.V."}
          </p>
        </div>
      </div>
    </div>
  );
}
