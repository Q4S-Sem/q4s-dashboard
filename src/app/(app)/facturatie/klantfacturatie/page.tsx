import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { verkoopRegels } from "@/lib/invoicing";
import { formatCurrency, round2 } from "@/lib/utils";

export const metadata = { title: "Klantfacturatie" };

/** Per persoon factureren: open weken per maand / 4 weken worden 1 verkoopfactuur met 1 nummer. */
export default async function KlantfacturatiePage() {
  // Per persoon: open (goedgekeurd, nog niet gefactureerd) en al gefactureerde weken.
  // ponytail: haalt alle goedgekeurde/gefactureerde weken op; beperk tot recente maanden als dit traag wordt.
  const verkoopWeken = await db.timesheet.findMany({
    where: { status: { in: ["APPROVED", "INVOICED"] } },
    include: {
      entries: true,
      placement: { include: { consultant: true, client: { select: { companyName: true } } } },
      invoiceLine: { select: { id: true } },
    },
  });
  const perPersoon = [
    ...verkoopWeken
      .reduce((m, t) => {
        const c = t.placement.consultant;
        const p = m.get(c.id) ?? { id: c.id, naam: `${c.firstName} ${c.lastName}`.trim(), klanten: new Set<string>(), open: 0, openBedrag: 0, gefactureerd: 0 };
        if (t.placement.client) p.klanten.add(t.placement.client.companyName);
        if (t.invoiceLine) p.gefactureerd++;
        else {
          p.open++;
          p.openBedrag = round2(p.openBedrag + verkoopRegels(t).reduce((s, l) => s + l.amount, 0));
        }
        return m.set(c.id, p);
      }, new Map<string, { id: string; naam: string; klanten: Set<string>; open: number; openBedrag: number; gefactureerd: number }>())
      .values(),
  ].sort((x, y) => y.open - x.open || x.naam.localeCompare(y.naam));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Klantfacturatie"
        description="Kies een persoon: de open weken van een maand of 4 weken worden samen 1 verkoopfactuur met 1 factuurnummer."
      />
      {perPersoon.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-900">Per persoon</div>
          <ul className="divide-y divide-ink-100">
            {perPersoon.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/facturatie/klantfacturatie/${p.id}`}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2.5 text-[13px] hover:bg-ink-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <PersoonVierkant naam={p.naam} />
                    <span className="min-w-0">
                      <span className="block font-medium text-ink-900">{p.naam}</span>
                      <span className="block truncate text-xs text-ink-500">{[...p.klanten].join(", ")}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {p.open > 0 && (
                      <Badge color="amber">
                        {p.open} {p.open === 1 ? "week" : "weken"} open · {formatCurrency(p.openBedrag)}
                      </Badge>
                    )}
                    {p.gefactureerd > 0 && <Badge color="green">{p.gefactureerd} gefactureerd</Badge>}
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {perPersoon.length === 0 && (
        <EmptyState title="Nog niets te factureren" description="Goedgekeurde weken uit Week verwerken verschijnen hier per persoon." />
      )}
    </div>
  );
}
