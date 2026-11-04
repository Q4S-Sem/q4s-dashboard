import Link from "next/link";
import { Plus, Search, X, Briefcase, Users2, Sparkles, Kanban } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { ZOEK_ICOON } from "@/components/ui/tabel-zoek";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, cn } from "@/lib/utils";
import { DISCIPLINES, labelFor, type BadgeColor } from "@/lib/domain";
import { VacatureTabs } from "./VacatureTabs";

// Functie · opdrachtgever · vakgebied · start/fase · actie
const KOLOMMEN = "grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_10rem_8rem_2.5rem]";

export const metadata = { title: "Vacatures" };
export const dynamic = "force-dynamic";

const ICOON_KNOP =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 transition-colors hover:border-ink-400 hover:text-ink-900";

/**
 * Vacatures = deals bij bedrijven, in een tab-switch:
 *  - OPEN: nog geen kandidaat gekoppeld → hier zoek je met AI de juiste persoon.
 *  - PIPELINE: een kandidaat gekoppeld → de vacature staat in de pipeline.
 * Compacte rijen met icoonknoppen; filterbalk (zoeken + discipline + opdrachtgever)
 * in dezelfde stijl als Alle kandidaten.
 */
export default async function VacaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; d?: string; q?: string; klant?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "pipeline" ? "pipeline" : "open";
  const vak = sp.d ?? "";
  const klant = sp.klant ?? "";
  const q = sp.q?.trim().toLowerCase() ?? "";

  const deals = await db.deal.findMany({
    where: { status: "OPEN" },
    include: {
      stage: true,
      client: { select: { id: true, companyName: true, city: true } },
      vacancy: { select: { id: true, title: true } },
    },
    orderBy: [{ expectedCloseDate: "asc" }, { createdAt: "desc" }],
  });

  // Kandidaatnamen voor de gevulde vacatures ophalen (Deal.candidateId heeft geen relatie).
  const candIds = [...new Set(deals.map((d) => d.candidateId).filter((x): x is string => !!x))];
  const cands = candIds.length
    ? await db.candidate.findMany({ where: { id: { in: candIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const candName = new Map(cands.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]));

  const inView = deals.filter((d) => (view === "pipeline" ? d.candidateId : !d.candidateId));
  const vakken = [...new Set(inView.map((d) => d.discipline).filter((x): x is string => !!x))].sort((a, b) =>
    labelFor(DISCIPLINES, a).localeCompare(labelFor(DISCIPLINES, b), "nl"),
  );
  const klanten = [
    ...new Map(inView.filter((d) => d.client).map((d) => [d.client!.id, d.client!.companyName])),
  ].sort((a, b) => a[1].localeCompare(b[1], "nl"));
  // Elk woord moet ergens in titel, bedrijf, plaats of kandidaat staan.
  const woorden = q.split(/\s+/).filter(Boolean);
  const rows = inView.filter((d) => {
    if (vak && d.discipline !== vak) return false;
    if (klant && d.client?.id !== klant) return false;
    if (!woorden.length) return true;
    const hooi = [d.title, d.client?.companyName ?? d.company, d.client?.city, d.candidateId ? candName.get(d.candidateId) : ""]
      .join(" ")
      .toLowerCase();
    return woorden.every((w) => hooi.includes(w));
  });
  const gefilterd = Boolean(vak || klant || q);
  const nu = new Date().getTime();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures"
        description="Alle vacatures op één plek: zoek met AI de juiste kandidaat, volg de pipeline en zet de vacature online op de website."
        actions={
          <Link href="/crm/vacatures/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe vacature
          </Link>
        }
      />

      <VacatureTabs actief={view} />

      <AutoFilterForm
            basePath="/crm/vacatures"
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,22rem)_12rem_12rem_auto]"
          >
            <input type="hidden" name="view" value={view} />
            <div className="relative">
              <Search className={ZOEK_ICOON} />
              <Input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Zoek op functie, bedrijf, plaats, kandidaat…"
                className="pl-9"
                aria-label="Zoeken"
                autoComplete="off"
              />
            </div>
            <Select name="d" defaultValue={vak} aria-label="Discipline">
              <option value="">Alle disciplines</option>
              {vakken.map((d) => (
                <option key={d} value={d}>
                  {labelFor(DISCIPLINES, d)}
                </option>
              ))}
            </Select>
            <Select name="klant" defaultValue={klant} aria-label="Opdrachtgever">
              <option value="">Alle opdrachtgevers</option>
              {klanten.map(([id, naam]) => (
                <option key={id} value={id}>
                  {naam}
                </option>
              ))}
            </Select>
            <div className="flex items-center">
              {gefilterd && (
                // Gewone <a>: volledige reload zet ook de (ongecontroleerde) velden leeg.
                <a href={`/crm/vacatures?view=${view}`} className={buttonVariants({ variant: "outline" })}>
                  <X className="h-4 w-4" /> Wissen
                </a>
              )}
            </div>
          </AutoFilterForm>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title={gefilterd ? "Geen vacatures gevonden met deze filters" : view === "pipeline" ? "Nog geen geplaatste vacatures" : "Geen openstaande vacatures"}
          description={
            view === "pipeline"
              ? "Zodra je een kandidaat aan een vacature koppelt, verschijnt die hier én op het pipeline-bord."
              : "Leg een vacature vast of alle vacatures hebben al een kandidaat. 🎉"
          }
          action={
            view === "open" ? (
              <Link href="/crm/vacatures/nieuw" className={buttonVariants()}>
                <Plus className="h-4 w-4" /> Nieuwe vacature
              </Link>
            ) : undefined
          }
        />
      ) : (
        // Overzicht als tabel: vaste kolommen zodat alles recht onder elkaar staat.
        <Card className="overflow-hidden">
          <div className={cn(KOLOMMEN, "hidden h-9 border-b border-ink-200 bg-ink-50 text-[12px] font-medium text-ink-500 md:grid")}>
            <span>Functie</span>
            <span>Opdrachtgever</span>
            <span>Vakgebied</span>
            <span>{view === "pipeline" ? "Fase" : "Start"}</span>
            <span className="sr-only">Acties</span>
          </div>
          <div className="divide-y divide-ink-200/70">
            {rows.map((k) => {
              const overdue = k.expectedCloseDate && k.expectedCloseDate.getTime() < nu;
              const kandidaat = k.candidateId ? candName.get(k.candidateId) : null;
              const bedrijf = k.client?.companyName ?? k.company;
              return (
                <div key={k.id} className={cn(KOLOMMEN, "group relative grid min-h-11 py-2 text-[13px] transition-colors hover:bg-ink-50/80")}>
                  <div className="min-w-0">
                    <Link
                      href={`/crm/vacatures/${k.id}`}
                      className="block truncate font-medium text-ink-900 after:absolute after:inset-0 after:content-['']"
                    >
                      {k.title}
                    </Link>
                    {(kandidaat || k.positions > 1) && (
                      <p className="flex items-center gap-3 truncate text-xs text-ink-500">
                        {kandidaat && (
                          <span className="inline-flex items-center gap-1">
                            <Users2 className="h-3 w-3 text-ink-400" /> {kandidaat}
                          </span>
                        )}
                        {k.positions > 1 && <span>{k.positions} posities</span>}
                      </p>
                    )}
                  </div>
                  <span className="hidden min-w-0 truncate text-ink-600 md:block">
                    {bedrijf || <span className="text-ink-300">—</span>}
                    {k.client?.city && <span className="text-ink-400"> · {k.client.city}</span>}
                  </span>
                  <span className="hidden truncate text-ink-600 md:block">
                    {k.discipline ? labelFor(DISCIPLINES, k.discipline) : <span className="text-ink-300">—</span>}
                  </span>
                  <span className="hidden md:block">
                    {view === "pipeline" ? (
                      <Badge color={(k.stage.color as BadgeColor) ?? "slate"}>{k.stage.name}</Badge>
                    ) : k.expectedCloseDate ? (
                      <span className={cn("tabular-nums", overdue ? "font-semibold text-red-600" : "text-ink-600")} title="Verwachte startdatum">
                        {formatDate(k.expectedCloseDate)}
                      </span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </span>
                  <div className="relative z-10 flex justify-end gap-1.5">
                    {view === "open" ? (
                      <Link href={`/crm/vacatures/${k.id}/match`} title="Zoek match met AI" aria-label={`Zoek match voor ${k.title}`} className={ICOON_KNOP}>
                        <Sparkles className="h-4 w-4" />
                      </Link>
                    ) : (
                      <Link href="/crm" title="Naar de pipeline" aria-label="Naar de pipeline" className={ICOON_KNOP}>
                        <Kanban className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
