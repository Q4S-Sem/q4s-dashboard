import Link from "next/link";
import { Coins, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { InkoopfacturenOverzicht, type InkoopRow } from "./InkoopfacturenOverzicht";

export const metadata = { title: "Inkoopfacturen" };

export default async function InkoopfacturenPage() {
  const invoices = await db.purchaseInvoice.findMany({
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: { consultant: true },
  });

  const toPay = invoices
    .filter((i) => i.status === "APPROVED")
    .reduce((s, i) => s + i.total, 0);

  const rows: InkoopRow[] = invoices.map((i) => ({
    id: i.id,
    number: i.number,
    consultantName: `${i.consultant.firstName} ${i.consultant.lastName}`,
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate.toISOString(),
    subtotal: i.subtotal,
    total: i.total,
    status: i.status,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inkoopfacturen"
        description="Self-billing facturen die Q4S aan de werknemers (ZZP) betaalt — uren × inkooptarief, incl. BTW. Filter op periode of week."
        actions={
          <Link href="/inkoopfacturen/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe inkoopfactuur
          </Link>
        }
      />

      {toPay > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Te betalen aan werknemers: <strong>{formatCurrency(toPay)}</strong>
        </p>
      )}

      {invoices.length === 0 ? (
        <EmptyState
          icon={<Coins className="h-6 w-6" />}
          title="Nog geen inkoopfacturen"
          description="Genereer een inkoopfactuur uit goedgekeurde urenstaten, of in één klik samen met de klantfactuur vanuit een urenstaat."
          action={
            <Link href="/inkoopfacturen/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe inkoopfactuur
            </Link>
          }
        />
      ) : (
        <InkoopfacturenOverzicht invoices={rows} />
      )}
    </div>
  );
}
