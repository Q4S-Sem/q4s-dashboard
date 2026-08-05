import { notFound } from "next/navigation";
import { Receipt, Coins, CheckCircle2, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoicesPanel } from "../../ClientRelations";
import { getClient } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  return { title: `Facturen · ${client?.companyName ?? "Klant"}` };
}

export default async function KlantFacturenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const invoices = await db.invoice.findMany({
    where: { clientId: id },
    orderBy: { issueDate: "desc" },
  });

  const sum = (rows: typeof invoices) => rows.reduce((s, i) => s + i.total, 0);
  const billed = invoices.filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED");
  const open = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE");
  const paid = invoices.filter((i) => i.status === "PAID");
  const overdue = invoices.filter((i) => i.status === "OVERDUE");
  const drafts = invoices.filter((i) => i.status === "DRAFT");
  const last = invoices[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gefactureerd"
          value={formatCurrency(sum(billed))}
          sub={
            drafts.length > 0
              ? `${billed.length} verzonden · ${drafts.length} in concept`
              : `${billed.length} factu${billed.length === 1 ? "ur" : "ren"} verzonden`
          }
          icon={<Receipt className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Openstaand"
          value={formatCurrency(sum(open))}
          sub={`${open.length} nog niet betaald`}
          icon={<Coins className="h-5 w-5" />}
          accent={open.length > 0 ? "amber" : "slate"}
        />
        <StatCard
          label="Betaald"
          value={formatCurrency(sum(paid))}
          sub={`${paid.length} factu${paid.length === 1 ? "ur" : "ren"}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Te laat"
          value={overdue.length}
          sub={
            last
              ? `laatste factuur ${formatDate(last.issueDate)}`
              : "nog geen facturen"
          }
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={overdue.length > 0 ? "red" : "slate"}
        />
      </div>

      <InvoicesPanel
        invoices={invoices.map((inv) => ({
          id: inv.id,
          number: inv.number,
          issueDate: inv.issueDate.toISOString(),
          total: inv.total,
          status: inv.status,
        }))}
      />
    </div>
  );
}
