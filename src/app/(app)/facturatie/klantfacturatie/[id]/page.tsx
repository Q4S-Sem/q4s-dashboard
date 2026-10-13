import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Receipt } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { verkoopRegels } from "@/lib/invoicing";
import { periodeVan } from "@/lib/factuur-periode";
import { weekKeyVan } from "@/lib/facturatie-week";
import { formatCurrency, getISOWeek, round2 } from "@/lib/utils";
import { factureerPeriodeNu } from "../../verkoop/actions";

export const metadata = { title: "Verkoop per persoon" };

/** Alle weken van één persoon, per factuurperiode (maand / 4 weken): open of al gefactureerd. */
export default async function VerkoopPersoonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const persoon = await db.consultant.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true } });
  if (!persoon) notFound();
  const naam = `${persoon.firstName} ${persoon.lastName}`.trim();

  const weken = await db.timesheet.findMany({
    where: { placement: { consultantId: id } },
    orderBy: { weekStart: "desc" },
    include: {
      entries: true,
      placement: { include: { consultant: true, client: { select: { id: true, companyName: true, billingCycle: true } } } },
      invoiceLine: { select: { invoice: { select: { id: true, number: true } } } },
    },
  });

  // Groepeer per klant + periode, nieuwste eerst (weken staan al aflopend).
  const groepen = new Map<string, { clientId: string; klant: string; periodeKey: string; label: string; weken: typeof weken }>();
  for (const t of weken) {
    const c = t.placement.client;
    if (!c) continue;
    const p = periodeVan(t.weekStart, c.billingCycle);
    const key = `${c.id}|${p.key}`;
    const g = groepen.get(key) ?? { clientId: c.id, klant: c.companyName, periodeKey: p.key, label: p.label, weken: [] };
    g.weken.push(t);
    groepen.set(key, g);
  }
  const bedrag = (t: (typeof weken)[number]) => round2(verkoopRegels(t).reduce((s, l) => s + l.amount, 0));
  const uren = (t: (typeof weken)[number]) => round2(t.entries.reduce((s, e) => s + e.hours, 0));
  const isOpen = (t: (typeof weken)[number]) => t.status === "APPROVED" && !t.invoiceLine;
  const openTotaal = round2(weken.filter(isOpen).reduce((s, t) => s + bedrag(t), 0));

  return (
    <div className="space-y-6">
      <BackLink href="/facturatie/klantfacturatie">Terug naar klantfacturatie</BackLink>
      <PageHeader
        title={naam}
        description={`${weken.filter(isOpen).length} ${weken.filter(isOpen).length === 1 ? "week" : "weken"} klaar om te factureren · ${formatCurrency(openTotaal)}`}
        leading={<PersoonVierkant naam={naam} />}
      />

      {groepen.size === 0 && <p className="text-sm text-ink-500">Nog geen weken voor {persoon.firstName}.</p>}

      {[...groepen.values()].map((g) => {
        const open = g.weken.filter(isOpen);
        return (
          <Card key={g.clientId + g.periodeKey} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-ink-900">{g.label}</div>
                <div className="text-xs text-ink-500">{g.klant}</div>
              </div>
              {open.length > 0 && (
                <ConfirmSubmit
                  action={factureerPeriodeNu}
                  hidden={{ clientId: g.clientId, periode: g.periodeKey, persoon: persoon.id }}
                  message={`Verkoopfactuur maken voor ${naam} (${g.label})?`}
                  description={`De ${open.length} goedgekeurde ${open.length === 1 ? "week" : "weken"} komen op 1 conceptfactuur. Weken die later binnenkomen gaan op een volgende factuur.`}
                  confirmLabel="Factuur maken"
                  variant="primary"
                >
                  <Receipt className="h-4 w-4" /> Factuur maken · {formatCurrency(round2(open.reduce((s, t) => s + bedrag(t), 0)))}
                </ConfirmSubmit>
              )}
            </div>
            <ul className="divide-y divide-ink-100">
              {g.weken.map((t) => {
                const inv = t.invoiceLine?.invoice;
                const wk = weekKeyVan(t.weekStart);
                return (
                  <li key={t.id} className="grid grid-cols-[6rem_1fr_auto_auto] items-center gap-4 px-4 py-2.5 text-[13px]">
                    <span className="font-medium text-ink-900">Week {getISOWeek(t.weekStart)}</span>
                    <span className="text-ink-500">{uren(t)} uur</span>
                    <span className="tabular-nums text-ink-900">{formatCurrency(bedrag(t))}</span>
                    <span className="flex w-56 items-center justify-end gap-2">
                      {inv ? (
                        <Link href={`/facturatie/verkoop/${inv.id}`} className="hover:underline">
                          <Badge color="green">Factuur {inv.number}</Badge>
                        </Link>
                      ) : isOpen(t) ? (
                        <Badge color="amber">Klaar om te factureren</Badge>
                      ) : (
                        <Badge color="slate">Nog niet goedgekeurd</Badge>
                      )}
                      {wk && (
                        <Link
                          href={`/facturatie/${t.placementId}/${wk}`}
                          title="Open de week"
                          aria-label={`Open week ${getISOWeek(t.weekStart)}`}
                          className="text-ink-400 hover:text-ink-900"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
