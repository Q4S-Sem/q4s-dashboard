import Link from "next/link";
import { Plug, Plus, Star } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { VMS_STATUSES } from "@/lib/domain";

export const metadata = { title: "Connectors" };

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Prioriteit ${value}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            i <= value
              ? "h-3.5 w-3.5 fill-brand-500 text-brand-500"
              : "h-3.5 w-3.5 text-ink-300"
          }
        />
      ))}
    </span>
  );
}

export default async function ConnectorsPage() {
  const connectors = await db.vmsConnector.findMany({
    orderBy: [{ priority: "desc" }, { name: "asc" }],
    include: { _count: { select: { vacancies: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="VMS-connectors"
        description="Inhuurplatforms en VMS-en waar vacatures vandaan komen (Magnit, SAP Fieldglass, Beeline, Inhuurdesk Rijk, Mercell, TenderNed, FlexOord)."
        actions={
          <Link href="/connectors/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe connector
          </Link>
        }
      />

      {connectors.length === 0 ? (
        <EmptyState
          icon={<Plug className="h-6 w-6" />}
          title="Nog geen connectors"
          description="Voeg een VMS of inhuurplatform toe om vacatures te kunnen importeren."
          action={
            <Link href="/connectors/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe connector
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Naam</TH>
                <TH>Prioriteit</TH>
                <TH>Status</TH>
                <TH className="text-right">Vacatures</TH>
              </TR>
            </THead>
            <TBody>
              {connectors.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link
                      href={`/connectors/${c.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {c.name}
                    </Link>
                  </TD>
                  <TD>
                    <Stars value={c.priority} />
                  </TD>
                  <TD>
                    <StatusBadge options={VMS_STATUSES} value={c.status} />
                  </TD>
                  <TD className="text-right tabular-nums">{c._count.vacancies}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
