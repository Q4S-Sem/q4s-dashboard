import Link from "next/link";
import { Archive, Search, Folder, Paperclip } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDateLong } from "@/lib/utils";

export const metadata = { title: "Archief" };
export const dynamic = "force-dynamic";

// Model name → Dutch folder label.
const ENTITY_LABELS: Record<string, string> = {
  Vacancy: "Vacatures",
  Expense: "Declaraties",
  Candidate: "Kandidaten",
  Client: "Klanten",
  Placement: "Plaatsingen",
  Evaluation: "Evaluaties",
  Certificate: "Certificaten",
  Document: "Documenten",
  CalendarEvent: "Agenda-items",
  Task: "Taken",
  SocialPost: "Social posts",
  AppUser: "Gebruikers",
  TimesheetInbox: "Timesheet-inbox",
  Timesheet: "Urenstaten",
  Invoice: "Verkoopfacturen",
  PurchaseInvoice: "Inkoopfacturen",
  TargetClient: "Opdrachtgevers",
  Opportunity: "Marktkansen",
  Application: "Sollicitaties",
  OutreachMessage: "Outreach",
  VmsConnector: "VMS-connectors",
  PostLink: "Tracked links",
  Challenge: "Vakproeven",
  Consultant: "Werknemers",
};
const entLabel = (t: string) => ENTITY_LABELS[t] ?? t;

type SP = { q?: string; type?: string };

export default async function ArchiefPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const type = sp.type || "";

  const where = {
    ...(type ? { entityType: type } : {}),
    ...(q
      ? { OR: [{ label: { contains: q } }, { summary: { contains: q } }] }
      : {}),
  };

  const [items, typeGroups, total] = await Promise.all([
    db.archivedItem.findMany({ where, orderBy: { deletedAt: "desc" }, take: 300 }),
    db.archivedItem.groupBy({ by: ["entityType"], _count: { _all: true } }),
    db.archivedItem.count(),
  ]);

  const folders = typeGroups
    .map((g) => ({ type: g.entityType, label: entLabel(g.entityType), count: g._count._all }))
    .sort((a, b) => a.label.localeCompare(b.label, "nl"));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Archief"
        description="Alles wat je in het dashboard verwijdert wordt hier automatisch bewaard — gesorteerd in mappen per soort, met bestanden, en altijd terug te vinden."
      />

      {total === 0 ? (
        <EmptyState
          icon={<Archive className="h-6 w-6" />}
          title="Het archief is leeg"
          description="Zodra je iets verwijdert, verschijnt het hier zodat je het later nog kunt terugvinden."
        />
      ) : (
        <>
          {/* Zoeken */}
          <Card>
            <CardContent className="py-4">
              <form method="get" className="flex flex-wrap items-center gap-3">
                {type && <input type="hidden" name="type" value={type} />}
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <Input name="q" defaultValue={q} placeholder="Zoek in het archief op naam of inhoud…" className="pl-9" aria-label="Zoeken" />
                </div>
                <button type="submit" className={buttonVariants()}>
                  <Search className="h-4 w-4" /> Zoeken
                </button>
                {(q || type) && (
                  <Link href="/archief" className={buttonVariants({ variant: "outline" })}>
                    Wissen
                  </Link>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Mappen */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
              Mappen
            </h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Link
                href={q ? `/archief?q=${encodeURIComponent(q)}` : "/archief"}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  type === "" ? "border-brand-300 bg-brand-50" : "border-ink-200 bg-white hover:bg-ink-50"
                }`}
              >
                <Archive className="h-5 w-5 text-brand-600" />
                <span className="flex-1 text-sm font-medium text-ink-800">Alles</span>
                <span className="text-sm tabular-nums text-ink-500">{total}</span>
              </Link>
              {folders.map((f) => {
                const href = `/archief?type=${f.type}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
                return (
                  <Link
                    key={f.type}
                    href={href}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                      type === f.type ? "border-brand-300 bg-brand-50" : "border-ink-200 bg-white hover:bg-ink-50"
                    }`}
                  >
                    <Folder className="h-5 w-5 text-ink-400" />
                    <span className="flex-1 truncate text-sm font-medium text-ink-800">{f.label}</span>
                    <span className="text-sm tabular-nums text-ink-500">{f.count}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Items */}
          <Card>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-ink-400">
                  Niets gevonden in het archief.
                </p>
              ) : (
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Naam</TH>
                      <TH>Soort</TH>
                      <TH>Verwijderd op</TH>
                      <TH></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {items.map((it) => (
                      <TR key={it.id}>
                        <TD>
                          <Link
                            href={`/archief/${it.id}`}
                            className="font-medium text-ink-900 hover:text-brand-700"
                          >
                            {it.label}
                          </Link>
                          {it.filesJson && (
                            <Paperclip className="ml-2 inline h-3.5 w-3.5 text-ink-400" />
                          )}
                          {it.summary && (
                            <div className="truncate text-xs text-ink-400">{it.summary}</div>
                          )}
                        </TD>
                        <TD className="text-ink-600">{entLabel(it.entityType)}</TD>
                        <TD className="whitespace-nowrap text-ink-600">
                          {formatDateLong(it.deletedAt)}
                        </TD>
                        <TD className="text-right">
                          <Link
                            href={`/archief/${it.id}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            Bekijken
                          </Link>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
