import Link from "next/link";
import { Building2, Plus, Briefcase, Kanban, Users2, UserPlus, HardHat } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FilterTegels, type FilterTegel } from "@/components/ui/filter-tegels";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD, RowLink } from "@/components/ui/table";
import { DISCIPLINES } from "@/lib/domain";
import { BedrijvenFilters } from "./BedrijvenFilters";
import { ContactpersonenTab } from "./ContactpersonenTab";

export const metadata = { title: "Klanten & contacten" };
export const dynamic = "force-dynamic";

export default async function BedrijvenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const filter = sp.filter || "";
  const tab = sp.tab === "contacten" ? "contacten" : "bedrijven";

  // Onze eigen klanten met hun openstaande vacatures en lopende deals.
  const clients = await db.client.findMany({
    where: q
      ? {
          OR: [
            { companyName: { contains: q } },
            { city: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { companyName: "asc" },
    include: {
      vacancies: {
        where: { status: { not: "CONCEPT" } },
        select: { id: true, title: true, discipline: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { deals: { where: { status: "OPEN" } }, placements: true, crmContacts: true } },
    },
  });

  // Statusfilter na de counts (afgeleid, niet direct in de query).
  const filtered = clients.filter((c) => {
    if (filter === "open-vacancy") return c.vacancies.length > 0;
    if (filter === "open-deal") return c._count.deals > 0;
    if (filter === "placements") return c._count.placements > 0;
    return true;
  });

  const aantal = (f: string) =>
    clients.filter((c) => (f === "open-vacancy" ? c.vacancies.length > 0 : f === "open-deal" ? c._count.deals > 0 : c._count.placements > 0)).length;
  const href = (f: string, t = "bedrijven") => {
    const p = new URLSearchParams();
    if (t === "contacten") p.set("tab", "contacten");
    if (f) p.set("filter", f);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `/opdrachtgevers?${qs}` : "/opdrachtgevers";
  };
  const contactTotaal = clients.reduce((s, c) => s + c._count.crmContacts, 0);
  const isB = tab === "bedrijven";
  const tegels: FilterTegel[] = [
    { key: "alle", label: "Alle bedrijven", waarde: clients.length, icon: <Building2 className="h-4 w-4" />, toon: "slate", href: href(""), actief: isB && !filter },
    { key: "vac", label: "Met open vacature", waarde: aantal("open-vacancy"), icon: <Briefcase className="h-4 w-4" />, toon: "green", href: href("open-vacancy"), actief: isB && filter === "open-vacancy" },
    { key: "deal", label: "In de pipeline", waarde: aantal("open-deal"), icon: <Kanban className="h-4 w-4" />, toon: "violet", href: href("open-deal"), actief: isB && filter === "open-deal" },
    { key: "plaats", label: "Met plaatsingen", waarde: aantal("placements"), icon: <HardHat className="h-4 w-4" />, toon: "amber", href: href("placements"), actief: isB && filter === "placements" },
    { key: "contacten", label: "Contactpersonen", waarde: contactTotaal, icon: <Users2 className="h-4 w-4" />, toon: "blue", href: href("", "contacten"), actief: !isB },
  ];
  const withOpenVacancy = clients.filter((c) => c.vacancies.length > 0).length;
  const hasFilter = Boolean(q || filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klanten & contacten"
        description="Onze bedrijven met hun vacatures, pipeline en plaatsingen — en per bedrijf de contactpersonen."
        actions={
          <>
            <Link href="/crm/contacten/nieuw" className={buttonVariants({ variant: "outline" })}>
              <UserPlus className="h-4 w-4" /> Nieuw contact
            </Link>
            <Link href="/klanten/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuw bedrijf
            </Link>
          </>
        }
      />

      <FilterTegels items={tegels} label="Klanten en contacten" />

      {!isB ? (
        <>
          <ContactpersonenTab />
        </>
      ) : clients.length === 0 && !hasFilter ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Nog geen bedrijven"
          description="Voeg je eerste klant toe; daarna kun je er vacatures en kandidaten aan koppelen."
          action={
            <Link href="/klanten/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuw bedrijf
            </Link>
          }
        />
      ) : (
        <>
          <BedrijvenFilters q={q} filter={filter} />

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="Geen bedrijven gevonden"
              description="Pas je zoekopdracht of filter aan."
              action={
                <Link href="/opdrachtgevers" className={buttonVariants({ variant: "outline" })}>
                  <Plus className="h-4 w-4" /> Filters wissen
                </Link>
              }
            />
          ) : (
            <>
          <p className="text-xs text-ink-400">
            {hasFilter
              ? `${filtered.length} van de ${clients.length} bedrijven`
              : `${withOpenVacancy} van de ${clients.length} bedrijven met een openstaande vacature`}
          </p>
          <Card>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Bedrijf</TH>
                  <TH>Openstaande vacatures</TH>
                  <TH className="text-right">Contacten</TH>
                  <TH className="text-right">In pipeline</TH>
                  <TH className="text-right">Plaatsingen</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <RowLink href={`/opdrachtgevers/${c.id}`}>{c.companyName}</RowLink>
                      {c.city && <p className="text-xs text-ink-400">{c.city}</p>}
                    </TD>
                    <TD>
                      {c.vacancies.length === 0 ? (
                        <span className="text-sm text-ink-400">—</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.vacancies.slice(0, 3).map((v) => (
                            <Link
                              key={v.id}
                              href={`/vacatures/${v.id}`}
                              className="inline-flex items-center gap-1.5 rounded-sm border border-ink-200 bg-white px-2 py-0.5 text-xs text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50"
                              title={v.title}
                            >
                              <Briefcase className="h-3 w-3 text-ink-400" />
                              <span className="max-w-[180px] truncate">{v.title}</span>
                              {v.discipline && (
                                <StatusBadge options={DISCIPLINES} value={v.discipline} />
                              )}
                            </Link>
                          ))}
                          {c.vacancies.length > 3 && (
                            <span className="text-xs text-ink-400">+{c.vacancies.length - 3}</span>
                          )}
                        </div>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums text-ink-600">{c._count.crmContacts}</TD>
                    <TD className="text-right">
                      {c._count.deals > 0 ? (
                        <Badge color="violet">{c._count.deals}</Badge>
                      ) : (
                        <span className="text-sm text-ink-400">0</span>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums text-ink-600">{c._count.placements}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
