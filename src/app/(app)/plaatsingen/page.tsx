import Link from "next/link";
import { Archive, Briefcase, Plus, Users, CheckCircle2, Coins, FileText, Hourglass, Trash2, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { buttonVariants, mapTabVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatCurrency, formatDate, round2 } from "@/lib/utils";
import { PlaatsingenList } from "./PlaatsingenList";
import { ontbrekendVoorActief } from "@/lib/ontbrekende-gegevens";
import { deletePlacementDraft } from "./actions";

export const metadata = { title: "Plaatsingen" };

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
    const bak = p.status === "ENDED" ? "beeindigd" : p.status === "ACTIVE" && ontbreekt.length === 0 ? "actief" : "voorbereiding";
    return { p, ontbreekt, bak };
  });
  const tel = (b: string) => rijen.filter((r) => r.bak === b).length;
  const MAPPEN = [
    { key: "actief", label: "Actief", icon: <CheckCircle2 className="h-4 w-4" />, aantal: tel("actief"), hint: "Alles compleet en getekend — loopt mee in de facturatie." },
    { key: "voorbereiding", label: "In voorbereiding", icon: <Hourglass className="h-4 w-4" />, aantal: tel("voorbereiding"), hint: "Wacht nog op gegevens of een getekend contract. Is alles er, dan gaat de plaatsing vanzelf naar Actief." },
    { key: "concepten", label: "Concepten", icon: <FileText className="h-4 w-4" />, aantal: drafts.length, hint: "Half ingevulde plaatsingen — maak ze af wanneer je alles hebt." },
    ...(tel("beeindigd") ? [{ key: "beeindigd", label: "Beëindigd", icon: <CircleSlash className="h-4 w-4" />, aantal: tel("beeindigd"), hint: "Afgelopen plaatsingen." }] : []),
  ];
  const actiefMap = MAPPEN.find((m) => m.key === (map ?? (concept ? "concepten" : undefined))) ?? MAPPEN[0];
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

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-200">
        <nav aria-label="Plaatsingen" className="flex flex-wrap items-end gap-1">
          {MAPPEN.map((m) => {
            const on = m.key === actiefMap.key;
            return (
              <Link key={m.key} href={mapHref(m.key)} scroll={false} aria-current={on ? "page" : undefined} className={mapTabVariants(on)}>
                <span className={on ? "text-brand-600" : "text-ink-400"}>{m.icon}</span>
                {m.label}
                <span
                  className={cn(
                    "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                    m.key === "voorbereiding" && m.aantal > 0 ? "bg-amber-100 text-amber-800" : "bg-ink-100 text-ink-500",
                  )}
                >
                  {m.aantal}
                </span>
              </Link>
            );
          })}
        </nav>
        <p className="mb-2 text-[13px] text-ink-500">{actiefMap.hint}</p>
      </div>

      {actiefMap.key === "concepten" && (
        <Card>
          {drafts.length === 0 && (
            <p className="px-5 py-10 text-center text-[13px] text-ink-400">Geen concepten. Een half ingevulde plaatsing kun je opslaan als concept.</p>
          )}
          <ul className="divide-y divide-ink-100">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <FileText className="h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {d.label || "Concept-plaatsing"}
                  </p>
                  <p className="text-xs text-ink-400">Laatst bewerkt {formatDate(d.updatedAt)}</p>
                </div>
                <Link
                  href={`/plaatsingen/nieuw?draft=${d.id}`}
                  className={buttonVariants({ variant: "primary", size: "sm" })}
                >
                  Verder gaan
                </Link>
                <ConfirmSubmit
                  action={deletePlacementDraft}
                  id={d.id}
                  message="Dit concept verwijderen?"
                  variant="ghost"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4" />
                </ConfirmSubmit>
              </li>
            ))}
          </ul>
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
          }))}
        />
      )}
    </div>
  );
}
