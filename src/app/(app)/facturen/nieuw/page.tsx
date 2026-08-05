import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatWeekLabel } from "@/lib/utils";
import { computeTimesheetMoney } from "@/lib/toeslag";
import { getCompanySettings } from "@/lib/settings";
import { InvoiceForm, type InvoiceLineOption } from "../InvoiceForm";
import { ClientChooser } from "../ClientChooser";
import { generateInvoice } from "../actions";

export const metadata = { title: "Nieuwe factuur" };

function toInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function NieuweFactuurPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: clientId } = await searchParams;
  const clients = await db.client.findMany({ orderBy: { companyName: "asc" } });

  const back = (
    <Link
      href="/facturen"
      className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
    >
      <ArrowLeft className="h-4 w-4" /> Terug naar facturen
    </Link>
  );

  // Step 1 — choose a client.
  if (!clientId) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        {back}
        <PageHeader
          title="Nieuwe factuur"
          description="Kies de klant waarvoor je wilt factureren — of voeg er meteen één toe."
        />
        <ClientChooser
          clients={clients.map((c) => ({ id: c.id, companyName: c.companyName }))}
        />
      </div>
    );
  }

  // Step 2 — select approved timesheets for the chosen client.
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  const settings = await getCompanySettings();
  const timesheets = await db.timesheet.findMany({
    where: { status: "APPROVED", placement: { clientId } },
    include: { entries: true, placement: { include: { consultant: true } } },
    orderBy: { weekStart: "asc" },
  });

  const lines: InvoiceLineOption[] = timesheets.map((t) => {
    // Same calc as the generated invoice — incl. weekend/overuren toeslagen + km.
    const money = computeTimesheetMoney(
      { entries: t.entries, overtimeHours: t.overtimeHours, kilometers: t.kilometers },
      t.placement,
    );
    return {
      timesheetId: t.id,
      label: `${t.placement.consultant.firstName} ${t.placement.consultant.lastName} — ${t.placement.title} — ${formatWeekLabel(t.weekStart)}`,
      hours: money.hours,
      amount: money.sell.total,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {back}
      <PageHeader
        title="Nieuwe factuur"
        description={client.companyName}
        actions={
          <Link
            href="/facturen/nieuw"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Andere klant
          </Link>
        }
      />

      {lines.length === 0 ? (
        <EmptyState
          title="Geen goedgekeurde urenstaten"
          description={`Er zijn geen goedgekeurde, nog niet gefactureerde urenstaten voor ${client.companyName}.`}
          action={
            <Link href="/uren" className={buttonVariants()}>
              Naar urenregistratie
            </Link>
          }
        />
      ) : (
        <InvoiceForm
          action={generateInvoice}
          clientId={client.id}
          lines={lines}
          vatRate={settings.defaultVatRate}
          defaultIssueDate={toInput(new Date())}
          cancelHref="/facturen"
        />
      )}
    </div>
  );
}
