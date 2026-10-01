import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BellRing, BookUp, CheckCircle2, Printer, Send } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { db } from "@/lib/db";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { INVOICE_STATUSES } from "@/lib/domain";
import { invoicePdfHref } from "@/lib/factuur-bulk";
import { verkoopWeergaveStatus } from "@/lib/facturatie-lijsten";
import { isSnelStartConnected, snelStartMessage } from "@/lib/snelstart";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceEditForm } from "../InvoiceEditForm";
import {
  deleteInvoice,
  pushInvoiceToSnelStart,
  sendInvoiceReminder,
  setInvoiceStatus,
  updateInvoice,
} from "../actions";

// ---------------------------------------------------------------------------
// ÉÉN verkoopfactuur: links het bewerkbare formulier, rechts de ECHTE PDF die
// live meeloopt terwijl je typt (dezelfde renderer als de verzending). Bovenaan
// de stappen van de trechter als knoppen — elk een bewuste klik.
// ---------------------------------------------------------------------------

export const metadata = { title: "Verkoopfactuur" };
export const dynamic = "force-dynamic";

/** Lokale-tijd-veilige "YYYY-MM-DD" voor een date-input. */
function toInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatusKnop({
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

export default async function VerkoopfactuurPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    fout?: string;
    snelstart?: string;
    opgeslagen?: string;
    herinnering?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { client: { select: { companyName: true, email: true, invoiceEmail: true } }, lines: true },
  });
  if (!invoice) notFound();

  const weergave = verkoopWeergaveStatus(
    { status: invoice.status, dueDate: invoice.dueDate },
    now,
  );
  const teLaat = weergave === "OVERDUE";
  const heeftMail = Boolean(invoice.client.invoiceEmail?.trim() || invoice.client.email?.trim());
  const snelstartMelding = snelStartMessage(sp.snelstart);

  return (
    <div className="space-y-5">
      <BackLink href="/facturatie/verkoop">Terug naar verkoopfacturen</BackLink>

      {sp.opgeslagen === "1" && (
        <p className="flex items-start gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> De factuur is opgeslagen.
        </p>
      )}
      {sp.fout === "vergrendeld" && (
        <p className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Een verzonden of betaalde factuur kan
          niet verwijderd worden. Gebruik <strong>Annuleren</strong> — dan blijft de administratie
          staan en komen de urenstaten weer vrij.
        </p>
      )}
      {sp.herinnering && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-sm border px-3 py-2 text-[13px]",
            sp.herinnering === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}
        >
          <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
          {sp.herinnering === "ok"
            ? "De betalingsherinnering is verstuurd."
            : sp.herinnering === "geen-adres"
              ? "Geen herinnering verstuurd: deze klant heeft geen e-mailadres."
              : sp.herinnering === "niet-verzonden"
                ? "Alleen een verzonden, nog niet betaalde factuur kan herinnerd worden."
                : "De herinnering kon niet verstuurd worden."}
        </p>
      )}
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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink-900">
              {invoice.number}
            </h1>
            <StatusBadge options={INVOICE_STATUSES} value={weergave} />
          </div>
          <p className="mt-1 text-[13px] text-ink-500">
            {invoice.client.companyName} · {formatCurrency(invoice.total)} incl. btw · vervalt{" "}
            <span className={teLaat ? "font-semibold text-red-700" : undefined}>
              {formatDate(invoice.dueDate)}
            </span>
            {invoice.reminderCount > 0 && (
              <>
                {" "}
                · {invoice.reminderCount}× herinnerd
                {invoice.reminderSentAt ? ` (${formatDate(invoice.reminderSentAt)})` : ""}
              </>
            )}
          </p>
          {!heeftMail && (
            <p className="mt-1 text-xs text-amber-700">
              Deze klant heeft geen factuur-e-mailadres — vul dat eerst aan bij Klanten, anders kan
              de factuur niet verstuurd worden.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === "DRAFT" && (
            <>
              <StatusKnop id={invoice.id} status="READY" variant="primary">
                <Send className="h-4 w-4" /> Naar klaar
              </StatusKnop>
              <StatusKnop id={invoice.id} status="CANCELLED" variant="outline">
                Annuleren
              </StatusKnop>
            </>
          )}
          {invoice.status === "READY" && (
            <>
              <Link
                href="/facturatie/verkoop?tab=klaar"
                className={buttonVariants({ variant: "primary" })}
              >
                <Send className="h-4 w-4" /> Verzenden in de lijst
              </Link>
              <StatusKnop id={invoice.id} status="DRAFT" variant="outline">
                Terug naar concept
              </StatusKnop>
            </>
          )}
          {invoice.status === "SENT" && (
            <>
              <StatusKnop id={invoice.id} status="PAID" variant="success">
                Markeer als betaald
              </StatusKnop>
              {teLaat && (
                <ConfirmSubmit
                  action={sendInvoiceReminder}
                  id={invoice.id}
                  hidden={{ terug: "detail" }}
                  trigger="button"
                  variant="outline"
                  confirmVariant="primary"
                  confirmLabel="Herinnering sturen"
                  message={`Betalingsherinnering sturen voor ${invoice.number}?`}
                  description="Er gaat nu een e-mail naar de klant. De toon loopt op: 1e herinnering, 2e herinnering, daarna een aanmaning."
                >
                  <span className="inline-flex items-center gap-2">
                    <BellRing className="h-4 w-4" /> Betalingsherinnering
                  </span>
                </ConfirmSubmit>
              )}
              <StatusKnop id={invoice.id} status="CANCELLED" variant="outline">
                Crediteren / annuleren
              </StatusKnop>
            </>
          )}
          {invoice.status === "PAID" && (
            <StatusKnop id={invoice.id} status="SENT" variant="outline">
              Markeer als onbetaald
            </StatusKnop>
          )}
          {(invoice.status === "DRAFT" || invoice.status === "CANCELLED") && (
            <ConfirmSubmit
              action={deleteInvoice}
              id={invoice.id}
              message={`Factuur ${invoice.number} verwijderen?`}
              description="De urenstaten op deze factuur komen weer vrij om te factureren."
            >
              Verwijderen
            </ConfirmSubmit>
          )}

          {/* Handmatig naar de boekhouding; nooit automatisch, nooit twee keer. */}
          {isSnelStartConnected() &&
            (invoice.snelstartId ? (
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-ink-100 px-3 py-1 text-[13px] font-medium text-ink-600">
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

          <a
            href={invoicePdfHref(invoice.id)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <Printer className="h-4 w-4" /> Printen / PDF
          </a>
        </div>
      </div>

      <InvoiceEditForm
        action={updateInvoice}
        cancelHref="/facturatie/verkoop"
        previewUrl={`/facturatie/verkoop/${invoice.id}/voorbeeld`}
        invoice={{
          id: invoice.id,
          number: invoice.number,
          issueDate: toInput(invoice.issueDate),
          dueDate: toInput(invoice.dueDate),
          vatRate: invoice.vatRate,
          notes: invoice.notes,
          lines: invoice.lines.map((l) => ({
            id: l.id,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        }}
      />
    </div>
  );
}
