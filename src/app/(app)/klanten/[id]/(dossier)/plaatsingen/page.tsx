import { notFound } from "next/navigation";
import { Briefcase, Activity, Coins, Percent } from "lucide-react";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency, round2 } from "@/lib/utils";
import { PlacementsPanel } from "../../ClientRelations";
import { getClient } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  return { title: `Plaatsingen · ${client?.companyName ?? "Klant"}` };
}

export default async function KlantPlaatsingenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const placements = await db.placement.findMany({
    where: { clientId: id },
    include: { consultant: true },
    orderBy: { startDate: "desc" },
  });

  const active = placements.filter((p) => p.status === "ACTIVE");
  const ended = placements.length - active.length;
  const basis = active.length > 0 ? active : placements;
  const avg = (pick: (p: (typeof placements)[number]) => number) =>
    basis.length === 0 ? 0 : round2(basis.reduce((s, p) => s + pick(p), 0) / basis.length);
  const avgCharge = avg((p) => p.chargeRate);
  const avgMargin = avg((p) => p.chargeRate - p.costRate);
  const marginPct = avgCharge > 0 ? Math.round((avgMargin / avgCharge) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Actief"
          value={active.length}
          sub="lopende plaatsingen"
          icon={<Activity className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Beëindigd"
          value={ended}
          sub={`${placements.length} in totaal`}
          icon={<Briefcase className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Gemiddeld tarief"
          value={`${formatCurrency(avgCharge)}/u`}
          sub={active.length > 0 ? "actieve plaatsingen" : "alle plaatsingen"}
          icon={<Coins className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Gemiddelde marge"
          value={`${formatCurrency(avgMargin)}/u`}
          sub={`${marginPct}% van het tarief`}
          icon={<Percent className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      <PlacementsPanel
        placements={placements.map((p) => ({
          id: p.id,
          title: p.title,
          person: `${p.consultant.firstName} ${p.consultant.lastName}`,
          chargeRate: p.chargeRate,
          status: p.status,
        }))}
      />
    </div>
  );
}
