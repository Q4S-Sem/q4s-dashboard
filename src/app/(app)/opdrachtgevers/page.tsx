import Link from "next/link";
import { Target, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TARGET_STATUSES } from "@/lib/domain";

export const metadata = { title: "Opdrachtgevers" };

function Stars({ priority }: { priority: number }) {
  const n = Math.max(1, Math.min(5, priority));
  return (
    <span className="text-amber-500" title={`Prioriteit ${n}/5`}>
      {"★".repeat(n)}
      <span className="text-slate-200">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default async function OpdrachtgeversPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const targets = await db.targetClient.findMany({
    orderBy: [{ priority: "desc" }, { name: "asc" }],
    include: { vmsConnector: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opdrachtgevers"
        description="Acquisitie-roadmap: bedrijven die Q4S wil binnenhalen, op prioriteit."
        actions={
          <Link href="/opdrachtgevers/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe opdrachtgever
          </Link>
        }
      />

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze opdrachtgever kan niet verwijderd worden zolang er sollicitaties
          aan gekoppeld zijn.
        </p>
      )}

      {targets.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="Nog geen opdrachtgevers"
          description="Voeg je eerste doelbedrijf toe om de acquisitie-roadmap op te bouwen."
          action={
            <Link href="/opdrachtgevers/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe opdrachtgever
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
                <TH>VMS</TH>
                <TH>Sector</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {targets.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <Link
                      href={`/opdrachtgevers/${t.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {t.name}
                    </Link>
                  </TD>
                  <TD>
                    <Stars priority={t.priority} />
                  </TD>
                  <TD>{t.vmsConnector?.name ?? "—"}</TD>
                  <TD>{t.sector ?? "—"}</TD>
                  <TD>
                    <StatusBadge options={TARGET_STATUSES} value={t.status} />
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
