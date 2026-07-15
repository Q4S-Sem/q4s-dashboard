import Link from "next/link";
import { Receipt, Plus, Download } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { FacturenOverzicht, type FactuurRow } from "./FacturenOverzicht";

export const metadata = { title: "Facturen" };

export default async function FacturenPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: clientId } = await searchParams;
  const filterClient = clientId
    ? await db.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      })
    : null;

  const invoices = await db.invoice.findMany({
    where: filterClient ? { clientId: filterClient.id } : {},
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: { client: { select: { companyName: true } } },
  });

  const rows: FactuurRow[] = invoices.map((i) => ({
    id: i.id,
    number: i.number,
    clientName: i.client.companyName,
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate.toISOString(),
    subtotal: i.subtotal,
    total: i.total,
    status: i.status,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturen"
        description="Facturen gegenereerd uit goedgekeurde urenstaten — filter op periode en bekijk het overzicht."
        actions={
          <>
            <a
              href="/api/facturen/export"
              className={buttonVariants({ variant: "outline" })}
              title="Download alle facturen (verkoop + inkoop) als ZIP voor de boekhouder"
            >
              <Download className="h-4 w-4" /> Export voor boekhouder
            </a>
            <Link href="/facturen/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe factuur
            </Link>
          </>
        }
      />

      {filterClient && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm">
          <span className="text-brand-900">
            Facturen voor <strong>{filterClient.companyName}</strong>
          </span>
          <Link
            href="/facturen"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Alle facturen ✕
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="Nog geen facturen"
          description="Keur eerst urenstaten goed en genereer daarna een factuur."
          action={
            <Link href="/facturen/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe factuur
            </Link>
          }
        />
      ) : (
        <FacturenOverzicht invoices={rows} />
      )}
    </div>
  );
}
