import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { formatWeekLabel } from "@/lib/utils";
import { computeTimesheetMoney } from "@/lib/toeslag";
import { getCompanySettings } from "@/lib/settings";
import { PurchaseInvoiceForm, type PurchaseLineOption } from "../PurchaseInvoiceForm";
import { generatePurchaseInvoice } from "../actions";

export const metadata = { title: "Nieuwe inkoopfactuur" };

function toInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function NieuweInkoopfactuurPage({
  searchParams,
}: {
  searchParams: Promise<{ consultant?: string }>;
}) {
  const { consultant: consultantId } = await searchParams;
  const consultants = await db.consultant.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const back = (
    <Link
      href="/inkoopfacturen"
      className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
    >
      <ArrowLeft className="h-4 w-4" /> Terug naar inkoopfacturen
    </Link>
  );

  // Step 1 — choose a consultant.
  if (!consultantId) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        {back}
        <PageHeader
          title="Nieuwe inkoopfactuur"
          description="Kies de werknemer die je wilt uitbetalen."
        />
        {consultants.length === 0 ? (
          <EmptyState
            title="Nog geen werknemers"
            description="Voeg eerst een werknemer toe."
            action={
              <Link href="/werknemers/nieuw" className={buttonVariants()}>
                Nieuwe werknemer
              </Link>
            }
          />
        ) : (
          <Card>
            <CardContent>
              <form method="get" className="flex items-end gap-3">
                <Field label="Werknemer" htmlFor="consultant" className="flex-1">
                  <Select id="consultant" name="consultant" defaultValue="" required>
                    <option value="" disabled>
                      Kies een werknemer…
                    </option>
                    {consultants.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit">Volgende</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Step 2 — select eligible timesheets for the chosen consultant.
  const consultant = await db.consultant.findUnique({ where: { id: consultantId } });
  if (!consultant) notFound();

  const settings = await getCompanySettings();
  const timesheets = await db.timesheet.findMany({
    where: {
      status: { in: ["APPROVED", "INVOICED"] },
      placement: { consultantId },
      purchaseLine: null,
    },
    include: { entries: true, placement: { include: { client: true } } },
    orderBy: { weekStart: "asc" },
  });

  const lines: PurchaseLineOption[] = timesheets.map((t) => {
    // Same calc as the generated inkoopfactuur — incl. toeslagen + km (buy side).
    const money = computeTimesheetMoney(
      { entries: t.entries, overtimeHours: t.overtimeHours, kilometers: t.kilometers },
      t.placement,
    );
    return {
      timesheetId: t.id,
      label: `${t.placement.title} — ${t.placement.client?.companyName ?? "— geen bedrijf"} — ${formatWeekLabel(t.weekStart)}`,
      hours: money.hours,
      amount: money.buy.total,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {back}
      <PageHeader
        title="Nieuwe inkoopfactuur"
        description={`${consultant.firstName} ${consultant.lastName}`}
        actions={
          <Link
            href="/inkoopfacturen/nieuw"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Andere werknemer
          </Link>
        }
      />

      {lines.length === 0 ? (
        <EmptyState
          title="Geen openstaande urenstaten"
          description={`Er zijn geen goedgekeurde, nog niet ingekochte urenstaten voor ${consultant.firstName} ${consultant.lastName}.`}
          action={
            <Link href="/uren" className={buttonVariants()}>
              Naar urenregistratie
            </Link>
          }
        />
      ) : (
        <PurchaseInvoiceForm
          action={generatePurchaseInvoice}
          consultantId={consultant.id}
          lines={lines}
          vatRate={settings.defaultVatRate}
          defaultIssueDate={toInput(new Date())}
          cancelHref="/inkoopfacturen"
        />
      )}
    </div>
  );
}
