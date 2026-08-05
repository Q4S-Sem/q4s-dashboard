import Link from "next/link";
import { HardHat, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { DISCIPLINES, EMPLOYMENT_TYPES, labelFor } from "@/lib/domain";

export const metadata = { title: "Werknemers-hub" };

export default async function WerknemersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const consultants = await db.consultant.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { _count: { select: { placements: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Werknemers-hub"
        description="De specialisten die Q4S detacheert — QA, QC, lassers, fitters en NDO."
        actions={
          <Link href="/werknemers/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe werknemer
          </Link>
        }
      />

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze werknemer kan niet verwijderd worden zolang er plaatsingen aan
          gekoppeld zijn.
        </p>
      )}

      {consultants.length === 0 ? (
        <EmptyState
          icon={<HardHat className="h-6 w-6" />}
          title="Nog geen werknemers"
          description="Voeg je eerste specialist toe om plaatsingen te kunnen aanmaken."
          action={
            <Link href="/werknemers/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe werknemer
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Naam</TH>
                <TH>Discipline</TH>
                <TH>Dienstverband</TH>
                <TH className="text-right">Inkooptarief</TH>
                <TH>Actief</TH>
                <TH className="text-right">Plaatsingen</TH>
              </TR>
            </THead>
            <TBody>
              {consultants.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link
                      href={`/werknemers/${c.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                  </TD>
                  <TD>
                    <StatusBadge options={DISCIPLINES} value={c.discipline} />
                  </TD>
                  <TD>{labelFor(EMPLOYMENT_TYPES, c.employmentType)}</TD>
                  <TD className="text-right tabular-nums">
                    {formatCurrency(c.defaultCostRate)}/u
                  </TD>
                  <TD>
                    {c.active ? (
                      <Badge color="green">Actief</Badge>
                    ) : (
                      <Badge color="slate">Inactief</Badge>
                    )}
                  </TD>
                  <TD className="text-right tabular-nums">{c._count.placements}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
