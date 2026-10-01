import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { BookUp, Pencil, Printer, Send } from "lucide-react";
import { db } from "@/lib/db";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { INVOICE_STATUSES } from "@/lib/domain";
import { invoicePdfHref, invoicePdfPreviewHref } from "@/lib/factuur-bulk";
import { isSnelStartConnected, snelStartMessage } from "@/lib/snelstart";
import { setInvoiceStatus, deleteInvoice, pushInvoiceToSnelStart } from "../actions";

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

export default async function FactuurDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; snelstart?: string }>;
}) {
  const { id } = await params;
  const { error, snelstart } = await searchParams;
  const now = new Date();

  const invoice = await db.invoice.findUnique({ where: { id } });

  if (!invoice) notFound();

  const status = effectiveStatus(invoice.status, invoice.dueDate, now);
  const pdfHref = invoicePdfHref(invoice.id);
  const snelstartMelding = snelStartMessage(snelstart);

  return (
    <div className="space-y-6">
      {/* Toolbar (hidden when printing) */}
      <div className="no-print space-y-4">
        <BackLink href="/facturen">
          Terug naar facturen
        </BackLink>

        {error === "locked" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Een verzonden of betaalde factuur kan niet verwijderd worden.
          </p>
        )}

        {snelstartMelding && (
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              snelstartMelding.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {snelstartMelding.text}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink-900">
              {invoice.number}
            </h1>
            <StatusBadge options={INVOICE_STATUSES} value={status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {invoice.status === "DRAFT" && (
              <>
                <StatusButton id={invoice.id} status="READY" variant="primary">
                  Naar verzendmap
                </StatusButton>
                <StatusButton id={invoice.id} status="CANCELLED" variant="outline">
                  Annuleren
                </StatusButton>
                <ConfirmSubmit action={deleteInvoice} id={invoice.id} message="Factuur verwijderen? De urenstaten komen weer vrij.">
                  Verwijderen
                </ConfirmSubmit>
              </>
            )}
            {invoice.status === "READY" && (
              <>
                <Link href="/verzenden" className={buttonVariants({ variant: "primary" })}>
                  <Send className="h-4 w-4" /> Naar verzendmap
                </Link>
                <StatusButton id={invoice.id} status="DRAFT" variant="outline">
                  Terug naar concept
                </StatusButton>
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
            {/* Handmatig naar de boekhouding; nooit automatisch, nooit twee keer. */}
            {isSnelStartConnected() &&
              (invoice.snelstartId ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-ink-100 px-3 py-1 text-sm font-medium text-ink-600">
                  <BookUp className="h-4 w-4" /> In SnelStart geboekt
                </span>
              ) : (
                <form action={pushInvoiceToSnelStart}>
                  <input type="hidden" name="id" value={invoice.id} />
                  <SubmitButton variant="outline" pendingLabel="Boeken…">
                    <BookUp className="h-4 w-4" /> Naar SnelStart
                  </SubmitButton>
                </form>
              ))}
            <Link
              href={`/facturen/${invoice.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <Printer className="h-4 w-4" /> Printen / PDF
            </a>
          </div>
        </div>
      </div>

      {/* Eén bron van waarheid: dezelfde echte PDF als Instellingen, verzenden en export. */}
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-md border border-ink-200 bg-ink-100">
        <iframe
          title={`Factuur ${invoice.number}`}
          src={invoicePdfPreviewHref(invoice.id)}
          className="h-[calc(100vh-220px)] min-h-[720px] w-full border-0"
        />
      </div>
    </div>
  );
}
