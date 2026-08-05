import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceEditForm } from "../../InvoiceEditForm";
import { updateInvoice } from "../../actions";

export const metadata = { title: "Factuur bewerken" };

/** Local-timezone-safe YYYY-MM-DD. */
function toInput(d: Date) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

export default async function FactuurBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/facturen/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar factuur
      </Link>
      <PageHeader
        title="Factuur bewerken"
        description={`${invoice.number} — corrigeer waar nodig.`}
      />
      <InvoiceEditForm
        action={updateInvoice}
        cancelHref={`/facturen/${id}`}
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
