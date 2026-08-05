import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Percent, TrendingUp, Wallet, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatHours, round2 } from "@/lib/utils";
import { getPlacement, getTimesheets, totalHours } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placement = await getPlacement(id);
  return { title: `Tarieven · ${placement?.title ?? "Plaatsing"}` };
}

export default async function PlaatsingTarievenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [placement, timesheets] = await Promise.all([getPlacement(id), getTimesheets(id)]);
  if (!placement) notFound();

  const ownStaff = placement.consultant.employmentType === "LOONDIENST";
  const marginPerHour = round2(placement.chargeRate - placement.costRate);
  const marginPct = placement.chargeRate > 0 ? (marginPerHour / placement.chargeRate) * 100 : 0;

  const hours = totalHours(timesheets);
  const earned = round2(hours * marginPerHour);

  const surcharges = [
    {
      label: "Weekendtoeslag",
      buy: `${formatHours(placement.weekendSurchargeBuy)}%`,
      sell: `${formatHours(placement.weekendSurchargeSell)}%`,
      set: placement.weekendSurchargeBuy > 0 || placement.weekendSurchargeSell > 0,
    },
    {
      label: "Overurentoeslag",
      buy: `${formatHours(placement.overtimeSurchargeBuy)}%`,
      sell: `${formatHours(placement.overtimeSurchargeSell)}%`,
      set: placement.overtimeSurchargeBuy > 0 || placement.overtimeSurchargeSell > 0,
    },
    {
      label: "Kilometervergoeding",
      buy: `${formatCurrency(placement.kmRateBuy)}/km`,
      sell: `${formatCurrency(placement.kmRateSell)}/km`,
      set: placement.kmRateBuy > 0 || placement.kmRateSell > 0,
    },
  ];
  const anySurcharge = surcharges.some((s) => s.set);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={ownStaff ? "Loonkost" : "Inkoop"}
          value={`${formatCurrency(placement.costRate)}/u`}
          sub={ownStaff ? "interne loonkost (voor de marge)" : "wat we de werknemer betalen"}
          icon={<Wallet className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Verkoop"
          value={`${formatCurrency(placement.chargeRate)}/u`}
          sub="wat we de klant factureren"
          icon={<Coins className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Marge"
          value={`${formatCurrency(marginPerHour)}/u`}
          sub={`${marginPct.toFixed(1)}% van het tarief`}
          icon={<Percent className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Verdiend"
          value={formatCurrency(earned)}
          sub={hours > 0 ? `over ${formatHours(hours)} geregistreerde uren` : "nog geen uren geregistreerd"}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toeslagen &amp; kilometervergoeding</CardTitle>
          <Link
            href={`/plaatsingen/${placement.id}/bewerken`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Pencil className="h-4 w-4" /> Tarieven bewerken
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-500">
            Komt als aparte regel bovenop het uurbedrag op de factuur. Inkoop = wat de werknemer
            krijgt, verkoop = wat de klant betaalt.
          </p>
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Toeslag / vergoeding</th>
                  <th className="px-4 py-2 text-right font-medium">Inkoop</th>
                  <th className="px-4 py-2 text-right font-medium">Verkoop</th>
                </tr>
              </thead>
              <tbody>
                {surcharges.map((s) => (
                  <tr key={s.label} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">{s.label}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${s.set ? "" : "text-slate-300"}`}>
                      {s.buy}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums ${s.set ? "" : "text-slate-300"}`}>
                      {s.sell}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!anySurcharge && (
            <p className="text-xs text-slate-400">
              Er zijn geen toeslagen ingesteld — er wordt alleen op uurtarief gefactureerd.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
