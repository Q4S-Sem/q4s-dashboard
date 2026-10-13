import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { verkoopRegels } from "@/lib/invoicing";
import { VerkoopTabs } from "../VerkoopTabs";
import { formatCurrency, round2 } from "@/lib/utils";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { Select } from "@/components/ui/field";

export const metadata = { title: "Verkoopfacturen · per persoon" };

/** Per persoon factureren: open weken per maand / 4 weken worden 1 verkoopfactuur met 1 nummer. */
export default async function KlantfacturatiePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; klant?: string; status?: string }>;
}) {
  const sp = await searchParams;
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
  const klanten = [...new Set(perPersoon.flatMap((p) => [...p.klanten]))].sort((a, b) => a.localeCompare(b));
  const zichtbaar = perPersoon.filter(
    (p) =>
      matchtZoek(sp.q, p.naam, ...p.klanten) &&
      (!sp.klant || p.klanten.has(sp.klant)) &&
      (sp.status === "open" ? p.open > 0 : sp.status === "gefactureerd" ? p.gefactureerd > 0 : true),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verkoopfacturen"
        description="Kies een persoon: de open weken van een maand of 4 weken worden samen 1 verkoopfactuur met 1 factuurnummer."
      />
      <VerkoopTabs actief="personen" />
      {perPersoon.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 p-4">
            <TabelZoek
              basePath="/facturatie/verkoop/personen"
              q={sp.q}
              placeholder="Zoek op persoon of klant…"
            >
              <Select name="klant" defaultValue={sp.klant ?? ""} aria-label="Filter op klant" className="sm:w-56">
                <option value="">Alle klanten</option>
                {klanten.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
              <Select name="status" defaultValue={sp.status ?? ""} aria-label="Filter op status" className="sm:w-48">
                <option value="">Alle personen</option>
                <option value="open">Met open weken</option>
                <option value="gefactureerd">Al gefactureerd</option>
              </Select>
            </TabelZoek>
          </div>
          {zichtbaar.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-500">Niemand gevonden met deze filters.</p>
          )}
          <ul className="divide-y divide-ink-100">
            {zichtbaar.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/facturatie/verkoop/personen/${p.id}`}
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
