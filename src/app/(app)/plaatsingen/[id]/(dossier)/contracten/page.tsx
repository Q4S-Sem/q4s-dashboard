import Link from "next/link";
import { notFound } from "next/navigation";
import { ScrollText, Plus, FileDown } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { CONTRACT_STATUSES } from "@/lib/domain";
import { getPlacement } from "../data";

export const metadata = { title: "Contracten — plaatsing" };
export const dynamic = "force-dynamic";

export default async function PlaatsingContractenTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const placement = await getPlacement(id);
  if (!placement) notFound();

  const contracts = await db.contract.findMany({
    where: { placementId: id },
    orderBy: { updatedAt: "desc" },
  });

  // Nieuw contract voor deze plaatsing: voor-ingevuld met de opdrachtnemer.
  const newHref = `/contracten/nieuw?consultantId=${placement.consultantId}&placementId=${id}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">
          Overeenkomsten van opdracht die aan deze plaatsing gekoppeld zijn.
        </p>
        <Link href={newHref} className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" /> Nieuw contract
        </Link>
      </div>

      <Card>
        {contracts.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<ScrollText className="h-6 w-6" />}
              title="Nog geen contract"
              description="Maak een overeenkomst van opdracht aan; die verschijnt dan hier bij de plaatsing."
              action={
                <Link href={newHref} className={buttonVariants()}>
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
                <TH>Status</TH>
                <TH>Bijgewerkt</TH>
                <TH>PDF</TH>
              </TR>
            </THead>
            <TBody>
              {contracts.map((c) => (
                <TR key={c.id} className="cursor-pointer">
                  <TD>
                    <Link href={`/contracten/${c.id}`} className="absolute inset-0 z-0" aria-label={`${c.contractorName} openen`} />
                    <span className="font-medium text-ink-900 group-hover:text-brand-700">{c.contractorName}</span>
                  </TD>
                  <TD>{c.number ?? "—"}</TD>
                  <TD><StatusBadge options={CONTRACT_STATUSES} value={c.status} /></TD>
                  <TD>{formatDate(c.updatedAt)}</TD>
                  <TD>
                    <Link
                      href={`/contracten/${c.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`relative z-10 ${buttonVariants({ variant: "ghost", size: "sm" })}`}
                    >
                      <FileDown className="h-3.5 w-3.5" /> PDF
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
