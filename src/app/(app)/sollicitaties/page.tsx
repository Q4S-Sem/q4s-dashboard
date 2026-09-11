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
import { formatDate, cn } from "@/lib/utils";

export const metadata = { title: "Sollicitaties" };
export const dynamic = "force-dynamic";

/** Kleurstip per status-tab (zelfde badge-kleuren als APPLICATION_STATUSES). */
const STATUS_DOT: Record<string, string> = {
  NEW: "bg-blue-500",
  SCREENING: "bg-amber-500",
  PROPOSED: "bg-violet-500",
  PLACED: "bg-emerald-500",
  REJECTED: "bg-ink-300",
};

export default async function SollicitatiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const valid = new Set(APPLICATION_STATUSES.map((s) => s.value));
  const activeStatus = sp.status && valid.has(sp.status) ? sp.status : APPLICATION_STATUSES[0].value;

  const applications = await db.application.findMany({
    orderBy: { createdAt: "desc" },
    include: { candidate: true, vacancy: true },
  });

  const counts = new Map<string, number>();
  for (const a of applications) {
    counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
  }

  const rows = applications.filter((a) => a.status === activeStatus);
  const activeLabel = APPLICATION_STATUSES.find((s) => s.value === activeStatus)?.label ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sollicitaties"
        description="Kandidaten die via de publieke vacaturepagina binnenkomen, door de pijplijn."
      />

      {/* Tabs — schakel tussen de sollicitatie-statussen */}
      <nav
        aria-label="Sollicitatiestatus"
        className="flex items-end gap-1 overflow-x-auto border-b border-ink-200"
      >
        {APPLICATION_STATUSES.map((s) => {
          const active = s.value === activeStatus;
          const count = counts.get(s.value) ?? 0;
          return (
            <Link
              key={s.value}
              href={`/sollicitaties?status=${s.value}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-ink-200 border-b-[#fafafa] bg-white text-ink-900"
                  : "border-transparent text-ink-500 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[s.value] ?? "bg-ink-300")} />
              {s.label}
              <span
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title={
            applications.length === 0
              ? "Nog geen sollicitaties"
              : `Geen sollicitaties met status "${activeLabel}"`
          }
          description={
            applications.length === 0
              ? "Sollicitaties komen binnen via de publieke vacaturepagina."
              : "Schakel naar een andere status hierboven om de rest te zien."
          }
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
              {rows.map((a) => (
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
                    <StatusBadge options={APPLICATION_STATUSES} value={a.status} />
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
