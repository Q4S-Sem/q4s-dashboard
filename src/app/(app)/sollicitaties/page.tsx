import Link from "next/link";
import { Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, THead, TBody, TR, TH, TD, RowLink } from "@/components/ui/table";
import { APPLICATION_STATUSES } from "@/lib/domain";
import { person } from "@/lib/people";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sollicitaties" };

export default async function SollicitatiesPage() {
  const applications = await db.application.findMany({
    orderBy: { createdAt: "desc" },
    include: { candidate: true, vacancy: true },
  });

  const counts = new Map<string, number>();
  for (const a of applications) {
    counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sollicitaties"
        description="Kandidaten die via de publieke vacaturepagina binnenkomen, door de pijplijn."
      />

      <div className="flex flex-wrap gap-2">
        {APPLICATION_STATUSES.map((s) => (
          <div
            key={s.value}
            className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-sm"
          >
            <StatusBadge options={APPLICATION_STATUSES} value={s.value} />
            <span className="text-sm font-semibold tabular-nums text-ink-900">
              {counts.get(s.value) ?? 0}
            </span>
          </div>
        ))}
      </div>

      {applications.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Nog geen sollicitaties"
          description="Sollicitaties komen binnen via de publieke vacaturepagina."
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Kandidaat</TH>
                <TH>Vacature</TH>
                <TH>Aangemaakt</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {applications.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <RowLink
                      href={`/sollicitaties/${a.id}`}
                      className="flex items-center gap-2.5 font-semibold"
                    >
                      <Avatar {...person(a.candidate)} size="sm" />
                      <span>
                        {a.candidate.firstName} {a.candidate.lastName}
                      </span>
                    </RowLink>
                  </TD>
                  <TD>{a.vacancy?.title ?? "—"}</TD>
                  <TD>{formatDate(a.createdAt)}</TD>
                  <TD>
                    <StatusBadge
                      options={APPLICATION_STATUSES}
                      value={a.status}
                    />
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
