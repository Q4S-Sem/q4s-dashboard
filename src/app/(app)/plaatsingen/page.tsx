import Link from "next/link";
import { Briefcase, Plus, Users, CheckCircle2, Coins, FileText, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatCurrency, formatDate, round2 } from "@/lib/utils";
import { PlaatsingenList } from "./PlaatsingenList";
import { deletePlacementDraft } from "./actions";

export const metadata = { title: "Plaatsingen" };

export default async function PlaatsingenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; client?: string; concept?: string }>;
}) {
  const { error, client: clientId, concept } = await searchParams;
  const filterClient = clientId
    ? await db.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      })
    : null;
  const placements = await db.placement.findMany({
    where: filterClient ? { clientId: filterClient.id } : {},
    orderBy: { startDate: "desc" },
    include: { consultant: true, client: true },
  });
  // Concepten (half ingevulde plaatsingen) — bovenaan, om af te maken.
  const drafts = filterClient
    ? []
    : await db.placementDraft.findMany({ orderBy: { updatedAt: "desc" } });

  const mensen = new Set(placements.map((p) => p.consultantId)).size;
  const actief = placements.filter((p) => p.status === "ACTIVE").length;
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
          <Link href="/plaatsingen/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe plaatsing
          </Link>
        }
      />

      {concept && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Concept opgeslagen — je vindt 'm hieronder terug om later af te maken.
        </p>
      )}

      {drafts.length > 0 && (
        <Card className="border-amber-200 ring-1 ring-amber-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-900">
              <FileText className="h-4 w-4 text-amber-600" /> Concepten — nog af te maken
            </CardTitle>
            <span className="text-sm text-ink-500">{drafts.length}</span>
          </CardHeader>
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
                  size="icon"
                >
                  <Trash2 className="h-4 w-4" />
                </ConfirmSubmit>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {filterClient && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm">
          <span className="text-brand-900">
            Plaatsingen bij <strong>{filterClient.companyName}</strong>
          </span>
          <Link
            href="/plaatsingen"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Alle plaatsingen ✕
          </Link>
        </div>
      )}

      {placements.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Mensen" value={mensen} sub="unieke werknemers" icon={<Users className="h-5 w-5" />} accent="brand" />
          <StatCard label="Plaatsingen" value={placements.length} icon={<Briefcase className="h-5 w-5" />} accent="violet" />
          <StatCard label="Actief" value={actief} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
          <StatCard label="Gem. marge" value={`${formatCurrency(avgMarge)}/u`} icon={<Coins className="h-5 w-5" />} accent="amber" />
        </div>
      )}

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze plaatsing kan niet verwijderd worden zolang er urenstaten aan
          gekoppeld zijn.
        </p>
      )}

      {placements.length === 0 ? (
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
          placements={placements.map((p) => ({
            id: p.id,
            person: `${p.consultant.firstName} ${p.consultant.lastName}`,
            clientName: p.client?.companyName ?? "— geen bedrijf",
            title: p.title,
            costRate: p.costRate,
            chargeRate: p.chargeRate,
            status: p.status,
          }))}
        />
      )}
    </div>
  );
}
