import Link from "next/link";
import { FileText, Plus, ScrollText } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { CONTRACT_STATUSES } from "@/lib/domain";

export const metadata = { title: "Contracten" };
export const dynamic = "force-dynamic";

export default async function ContractenPage() {
  const contracts = await db.contract.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      consultant: { select: { id: true, firstName: true, lastName: true } },
      placement: { select: { id: true, title: true, client: { select: { companyName: true } } } },
    },
  });

  const drafts = contracts.filter((c) => c.status === "DRAFT").length;
  const signed = contracts.filter((c) => c.status === "SIGNED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracten"
        description="Overeenkomsten van opdracht — vul de gegevens in en het Q4S-format rolt er netjes uit als PDF. Elk contract hangt aan de opdrachtnemer en, indien gekoppeld, aan de plaatsing."
        actions={
          <Link href="/contracten/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw contract
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Contracten totaal" value={contracts.length} icon={<ScrollText className="h-5 w-5" />} accent="brand" />
        <StatCard label="Concept" value={drafts} icon={<FileText className="h-5 w-5" />} accent="amber" />
        <StatCard label="Getekend" value={signed} sub="volledig afgerond" icon={<FileText className="h-5 w-5" />} accent="green" />
      </div>

      <Card>
        {contracts.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<ScrollText className="h-6 w-6" />}
              title="Nog geen contracten"
              description="Maak een overeenkomst van opdracht aan; vul de opdrachtnemer, opdracht en tarieven in en download het als PDF."
              action={
                <Link href="/contracten/nieuw" className={buttonVariants()}>
                  <Plus className="h-4 w-4" /> Nieuw contract
                </Link>
              }
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Opdrachtnemer</TH>
                <TH>Referentie</TH>
                <TH>Plaatsing</TH>
                <TH>Status</TH>
                <TH>Bijgewerkt</TH>
              </TR>
            </THead>
            <TBody>
              {contracts.map((c) => (
                <TR key={c.id} className="cursor-pointer">
                  <TD>
                    <Link href={`/contracten/${c.id}`} className="absolute inset-0 z-0" aria-label={`${c.contractorName} openen`} />
                    <span className="font-medium text-ink-900 group-hover:text-brand-700">{c.contractorName}</span>
                    {c.consultant && (
                      <p className="text-xs text-ink-400">{c.consultant.firstName} {c.consultant.lastName}</p>
                    )}
                  </TD>
                  <TD>{c.number ?? "—"}</TD>
                  <TD>
                    {c.placement ? (
                      <span className="text-ink-600">
                        {c.placement.title}{c.placement.client ? ` · ${c.placement.client.companyName}` : ""}
                      </span>
                    ) : (
                      <span className="text-ink-400">Los contract</span>
                    )}
                  </TD>
                  <TD><StatusBadge options={CONTRACT_STATUSES} value={c.status} /></TD>
                  <TD>{formatDate(c.updatedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
