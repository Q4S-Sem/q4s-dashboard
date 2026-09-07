import Link from "next/link";
import { Receipt, Plus, Download } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { WeekBalk } from "@/components/week-balk";
import { formatWeekLabel, startOfISOWeek } from "@/lib/utils";
import { parseWeek, ymd } from "@/lib/week-nav";
import { FacturenOverzicht, type FactuurRow } from "./FacturenOverzicht";

export const metadata = { title: "Facturen" };

export default async function FacturenPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; week?: string }>;
}) {
  const { client: clientId, week } = await searchParams;
  const filterClient = clientId
    ? await db.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      })
    : null;

  // Week-filter op FACTUURDATUM. Standaard "alle weken": zo blijft het overzicht
  // compleet en filtert de balk pas als je een week aanklikt.
  const monday = parseWeek(week);
  const wp = monday ? ymd(monday) : "";
  const currentWeek = ymd(startOfISOWeek(new Date()));
  const volgendeMaandag = monday ? new Date(monday) : null;
  volgendeMaandag?.setDate(volgendeMaandag.getDate() + 7);

  const invoices = await db.invoice.findMany({
    where: {
      ...(filterClient ? { clientId: filterClient.id } : {}),
      ...(monday && volgendeMaandag
        ? { issueDate: { gte: monday, lt: volgendeMaandag } }
        : {}),
    },
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

      {/* Week-balk — dezelfde als op alle andere facturatiepagina's */}
      <WeekBalk
        basePath="/facturen"
        week={wp}
        currentWeek={currentWeek}
        extraParams={{ client: clientId }}
        allWeeks
      />

      {filterClient && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm">
          <span className="text-brand-900">
            Facturen voor <strong>{filterClient.companyName}</strong>
          </span>
          <Link
            href={wp ? `/facturen?week=${wp}` : "/facturen"}
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Alle facturen ✕
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title={monday ? "Geen facturen in deze week" : "Nog geen facturen"}
          description={
            monday
              ? `Er staat geen enkele factuur met een factuurdatum in ${formatWeekLabel(monday).toLowerCase()}. Blader met de week-balk hierboven of kies "Alle weken".`
              : "Keur eerst urenstaten goed en genereer daarna een factuur."
          }
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
