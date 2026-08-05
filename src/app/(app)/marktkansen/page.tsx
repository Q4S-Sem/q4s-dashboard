import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { db } from "@/lib/db";
import { isAIConfigured } from "@/lib/ai";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { OPPORTUNITY_POTENTIAL, OPPORTUNITY_STATUSES } from "@/lib/domain";
import { GenerateForm } from "./GenerateForm";
import { generateOpportunities } from "./actions";

export const metadata = { title: "Marktkansen" };

export default async function MarktkansenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const opportunities = await db.opportunity.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marktkansen"
        description="Kansen om Q4S te laten groeien — handmatig of door AI gegenereerd."
        actions={
          <Link href="/marktkansen/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe kans
          </Link>
        }
      />

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze kans kan op dit moment niet verwijderd worden.
        </p>
      )}

      <GenerateForm aiReady={isAIConfigured()} action={generateOpportunities} />

      {opportunities.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="Nog geen marktkansen"
          description="Voeg handmatig een kans toe of laat AI nieuwe groeikansen voorstellen."
          action={
            <Link href="/marktkansen/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe kans
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Kans</TH>
                <TH>Sector</TH>
                <TH>Regio</TH>
                <TH>Potentieel</TH>
                <TH>Status</TH>
                <TH>Bron</TH>
              </TR>
            </THead>
            <TBody>
              {opportunities.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <Link
                      href={`/marktkansen/${o.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {o.title}
                    </Link>
                  </TD>
                  <TD>{o.sector ?? "—"}</TD>
                  <TD>{o.region ?? "—"}</TD>
                  <TD>
                    <StatusBadge options={OPPORTUNITY_POTENTIAL} value={o.potential} />
                  </TD>
                  <TD>
                    <StatusBadge options={OPPORTUNITY_STATUSES} value={o.status} />
                  </TD>
                  <TD>
                    <Badge color={o.source === "AI" ? "violet" : "slate"}>
                      {o.source === "AI" ? "AI" : "Handmatig"}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
