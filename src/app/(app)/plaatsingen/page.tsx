import Link from "next/link";
import { FileSpreadsheet, Archive, Briefcase, Plus, Users, CheckCircle2, Coins, FileText, Hourglass, Trash2, CircleSlash, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { buttonVariants, mapTabVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatCurrency, formatDate, round2 } from "@/lib/utils";
import { PlaatsingenList } from "./PlaatsingenList";
import { ontbrekendVoorActief } from "@/lib/ontbrekende-gegevens";
import { deletePlacementDraft } from "./actions";
import { eindeStatus, eindeTekst } from "@/lib/plaatsing-einde";
import { isAdminSession } from "@/lib/session";

export const metadata = { title: "Plaatsingen" };

/** Groen = actief, oranje = in voorbereiding, rood = concept. */
const KLEUR: Record<string, { icoon: string; teller: string }> = {
  actief: { icoon: "text-emerald-600", teller: "bg-emerald-100 text-emerald-800" },
  voorbereiding: { icoon: "text-orange-500", teller: "bg-orange-100 text-orange-800" },
  concepten: { icoon: "text-red-600", teller: "bg-red-100 text-red-700" },
  beeindigd: { icoon: "text-ink-400", teller: "bg-ink-100 text-ink-500" },
};

export default async function PlaatsingenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; client?: string; concept?: string; gearchiveerd?: string; map?: string }>;
}) {
  const { error, client: clientId, concept, gearchiveerd, map } = await searchParams;
  const filterClient = clientId
    ? await db.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      })
    : null;
  const placements = await db.placement.findMany({
    where: { status: { not: "ARCHIVED" }, ...(filterClient ? { clientId: filterClient.id } : {}) },
    orderBy: { startDate: "desc" },
    include: { consultant: true, client: true },
  });
  const gearchiveerdAantal = await db.placement.count({ where: { status: "ARCHIVED" } });
  // Concepten (half ingevulde plaatsingen) — bovenaan, om af te maken.
  const drafts = filterClient
    ? []
    : await db.placementDraft.findMany({ orderBy: { updatedAt: "desc" } });

  // Getekend contract per persoon (of per plaatsing): pas dan is iemand echt "gereed".
  const getekend = await db.contract.findMany({
    where: { status: "SIGNED", OR: [{ consultantId: { in: placements.map((p) => p.consultantId) } }, { placementId: { in: placements.map((p) => p.id) } }] },
    select: { consultantId: true, placementId: true },
  });
  const heeftContract = (p: { id: string; consultantId: string }) =>
    getekend.some((c) => c.placementId === p.id || c.consultantId === p.consultantId);
  // ponytail: het contract telt hier mee voor "gereed", maar blokkeert de facturatie (nog) niet.
  const rijen = placements.map((p) => {
    const ontbreekt = [
      ...ontbrekendVoorActief({ heeftKlant: Boolean(p.clientId), ...p }, p.consultant),
      ...(heeftContract(p) ? [] : ["Getekend contract"]),
    ];
    const bak = p.status === "ENDED" ? "beeindigd" : p.status === "ACTIVE" && (ontbreekt.length === 0 || p.forceActive) ? "actief" : "voorbereiding";
    return { p, ontbreekt, bak };
  });
  const conceptKlanten = new Map(
    (await db.client.findMany({ select: { id: true, companyName: true } })).map((c) => [c.id, c.companyName]),
  );
  const tel = (b: string) => rijen.filter((r) => r.bak === b).length;
  const MAPPEN = [
    { key: "actief", label: "Actief", icon: <CheckCircle2 className="h-4 w-4" />, aantal: tel("actief"), hint: "Alles compleet en getekend — loopt mee in de facturatie." },
    { key: "voorbereiding", label: "In voorbereiding", icon: <Hourglass className="h-4 w-4" />, aantal: tel("voorbereiding"), hint: "Wacht nog op gegevens of een getekend contract. Is alles er, dan gaat de plaatsing vanzelf naar Actief." },
    { key: "concepten", label: "Concepten", icon: <FileText className="h-4 w-4" />, aantal: drafts.length, hint: "Half ingevulde plaatsingen — maak ze af wanneer je alles hebt." },
    ...(tel("beeindigd") ? [{ key: "beeindigd", label: "Beëindigd", icon: <CircleSlash className="h-4 w-4" />, aantal: tel("beeindigd"), hint: "Afgelopen plaatsingen." }] : []),
  ];
  // Standaard de eerste map waar iets in staat (een lege "Actief" is geen startpunt).
  const actiefMap =
    MAPPEN.find((m) => m.key === (map ?? (concept ? "concepten" : undefined))) ?? MAPPEN.find((m) => m.aantal > 0) ?? MAPPEN[0];
  const zichtbaar = rijen.filter((r) => r.bak === actiefMap.key);
  const mapHref = (k: string) => {
    const q = new URLSearchParams({ map: k });
    if (filterClient) q.set("client", filterClient.id);
    return `/plaatsingen?${q.toString()}`;
  };

  const mensen = new Set(placements.map((p) => p.consultantId)).size;
  const actief = tel("actief");
  const avgMarge =
    placements.length > 0
      ? round2(
          placements.reduce((s, p) => s + (p.chargeRate - p.costRate), 0) /
            placements.length,
        )
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plaatsingen"
        description="Werknemers gekoppeld aan klanten, met de marges die we hanteren."
        actions={
          <>
            {(await isAdminSession()) && (
              // Gewone <a>: een download, geen pagina-navigatie.
              <a href="/api/plaatsingen/excel" className={buttonVariants({ variant: "outline" })}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </a>
            )}
            <Link href="/archief?type=uit-dienst" className={buttonVariants({ variant: "outline" })}>
              <Archive className="h-4 w-4" /> Archief{gearchiveerdAantal > 0 ? ` (${gearchiveerdAantal})` : ""}
            </Link>
            <Link href="/plaatsingen/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe plaatsing
            </Link>
          </>
        }
      />

      {gearchiveerd && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Plaatsing gearchiveerd. Je vindt hem onder <Link href="/archief?type=uit-dienst" className="font-semibold underline">Archief</Link> — met één klik terug te zetten.
        </p>
      )}

      {concept && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Concept opgeslagen — je vindt hem onder Concepten om later af te maken.
        </p>
      )}


      {filterClient && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm">
          <span className="text-brand-900">
            Plaatsingen bij <strong>{filterClient.companyName}</strong>
          </span>
          <Link
            href="/plaatsingen"
            className="font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2"
          >
            Alle plaatsingen ✕
          </Link>
        </div>
      )}

      {placements.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Mensen" value={mensen} sub="unieke werknemers" icon={<Users className="h-5 w-5" />} accent="brand" />
          <StatCard label="Plaatsingen" value={placements.length} icon={<Briefcase className="h-5 w-5" />} accent="violet" />
          <StatCard label="Actief" value={actief} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
          <StatCard label="Gem. marge" value={`${formatCurrency(avgMarge)}/u`} icon={<Coins className="h-5 w-5" />} accent="amber" />
        </div>
      )}

      {(() => {
        const aflopend = rijen
          .filter((r) => r.bak !== "beeindigd")
          .map((r) => ({ ...r, e: eindeStatus(r.p.endDate) }))
          .filter((r) => r.e)
          .sort((a, b) => a.e!.dagen - b.e!.dagen);
        if (aflopend.length === 0) return null;
        return (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-900">
            <p className="mb-1.5 flex items-center gap-2 font-semibold">
              <CalendarClock className="h-4 w-4" /> Contract loopt af — verlengen of afronden
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {aflopend.map(({ p, e }) => (
                <li key={p.id}>
                  <Link href={`/plaatsingen/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                    {p.consultant.firstName} {p.consultant.lastName}
                  </Link>{" "}
                  <span className={e!.status === "verlopen" ? "text-red-700" : "text-violet-700"}>
                    · {eindeTekst(e!)} ({formatDate(p.endDate!)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-200">
        <nav aria-label="Plaatsingen" className="flex flex-wrap items-end gap-1">
          {MAPPEN.map((m) => {
            const on = m.key === actiefMap.key;
            return (
              <Link key={m.key} href={mapHref(m.key)} scroll={false} aria-current={on ? "page" : undefined} className={mapTabVariants(on)}>
                <span className={KLEUR[m.key].icoon}>{m.icon}</span>
                {m.label}
                <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", KLEUR[m.key].teller)}>
                  {m.aantal}
                </span>
              </Link>
            );
          })}
        </nav>
        <p className="mb-2 text-[13px] text-ink-500">{actiefMap.hint}</p>
      </div>

      {actiefMap.key === "concepten" && (
        <Card className="overflow-hidden">
          {drafts.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-ink-400">Geen concepten. Een half ingevulde plaatsing kun je opslaan als concept.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Werknemer</TH>
                    <TH>Klant</TH>
                    <TH>Functie</TH>
                    <TH className="text-right">Inkoop</TH>
                    <TH className="text-right">Verkoop</TH>
                    <TH className="text-right">Marge</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Acties</TH>
                  </TR>
                </THead>
                <TBody>
                  {drafts.map((d) => {
                    // Het concept bewaart de formuliervelden als JSON.
                    let v: Record<string, string> = {};
                    try {
                      v = JSON.parse(d.data) as Record<string, string>;
                    } catch {}
                    const [kop, functie] = (d.label ?? "").split(" — ");
                    const naam = kop?.split(" · ")[0] || "Nieuwe werknemer";
                    const klant = conceptKlanten.get(v.clientId ?? "") ?? (kop?.split(" · ")[1] || "—");
                    const inkoop = Number(String(v.costRate ?? "").replace(",", ".")) || 0;
                    const verkoop = Number(String(v.chargeRate ?? "").replace(",", ".")) || 0;
                    const geld = (n: number) => (n > 0 ? `${formatCurrency(n)}/u` : <span className="text-ink-300">—</span>);
                    return (
                      <TR key={d.id}>
                        <TD>
                          <Link href={`/plaatsingen/nieuw?draft=${d.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                            {naam}
                          </Link>
                          <span className="block text-xs text-ink-400">Laatst bewerkt {formatDate(d.updatedAt)}</span>
                        </TD>
                        <TD>{klant}</TD>
                        <TD>{v.title || functie || "—"}</TD>
                        <TD className="text-right tabular-nums">{geld(inkoop)}</TD>
                        <TD className="text-right tabular-nums">{geld(verkoop)}</TD>
                        <TD className="text-right font-semibold tabular-nums text-emerald-700">
                          {inkoop > 0 && verkoop > 0 ? `${formatCurrency(round2(verkoop - inkoop))}/u` : <span className="font-normal text-ink-300">—</span>}
                        </TD>
                        <TD>
                          <span className="rounded-sm bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">Concept</span>
                        </TD>
                        <TD>
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/plaatsingen/nieuw?draft=${d.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                              Verder gaan
                            </Link>
                            <ConfirmSubmit action={deletePlacementDraft} id={d.id} message="Dit concept verwijderen?" variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </ConfirmSubmit>
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze plaatsing kan niet verwijderd worden zolang er urenstaten aan
          gekoppeld zijn.
        </p>
      )}

      {actiefMap.key === "concepten" ? null : placements.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="Nog geen plaatsingen"
          description="Koppel een werknemer aan een klant om de marge vast te leggen en uren te kunnen registreren."
          action={
            <Link href="/plaatsingen/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe plaatsing
            </Link>
          }
        />
      ) : (
        <PlaatsingenList
          placements={zichtbaar.map(({ p, ontbreekt }) => ({
            id: p.id,
            person: `${p.consultant.firstName} ${p.consultant.lastName}`,
            clientName: p.client?.companyName ?? "— geen bedrijf",
            title: p.title,
            costRate: p.costRate,
            chargeRate: p.chargeRate,
            rateUnit: p.rateUnit,
            overtimeCostRate: p.overtimeCostRate,
            overtimeChargeRate: p.overtimeChargeRate,
            // Alles wat nog ontbreekt (incl. getekend contract) → "Nog niet actief".
            status: p.status === "ACTIVE" && ontbreekt.length > 0 ? "INCOMPLETE" : p.status,
            ontbreekt,
            einde: ((e) => (e ? { tekst: eindeTekst(e), verlopen: e.status === "verlopen" } : null))(
              p.status === "ENDED" ? null : eindeStatus(p.endDate),
            ),
          }))}
        />
      )}
    </div>
  );
}
