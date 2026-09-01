import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  Clock,
  HandCoins,
  Info,
  Receipt,
  ShieldAlert,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BETAALMATCHING_LABELS,
  FACTUUR_BUCKET_KLEUR,
  VRIJGAVE_KLEUR,
  buildBetaalmatching,
  type Uitbetaalverplichting,
  type VerkoopFactuur,
} from "@/lib/betaalmatching";

export const metadata = { title: "Betaalmatching" };
export const dynamic = "force-dynamic";

/** Naam van een freelancer zoals elders in de betaalmonitor: bedrijfsnaam als
 *  die er is, anders de persoonsnaam. */
function partyName(c: { firstName: string; lastName: string; companyName: string | null }): string {
  return c.companyName?.trim() || `${c.firstName} ${c.lastName}`;
}

/**
 * Betaalmatching — cashflow-bescherming.
 *
 * ALLEEN-LEZEN. De pagina haalt de verkoopfacturen en de openstaande
 * uitbetalingen op, geeft ze als platte arrays door aan de zuivere functies in
 * src/lib/betaalmatching.ts en toont het advies. Er wordt hier NIETS gemuteerd
 * en er wordt nooit automatisch uitbetaald — de mens beslist.
 *
 * Aanvulling op /betaalmonitor: dáár staat wat er in- en uitgaat en wat te laat
 * is, hier staat de KOPPELING — heeft de klant betaald voor de uren die we aan
 * deze freelancer moeten uitbetalen?
 */
export default async function BetaalmatchingPage() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [invoices, purchases, received] = await Promise.all([
    // Verkoopfacturen van dit jaar + alles wat nog openstaat (ook ouder), zodat
    // een oude onbetaalde factuur de bijbehorende uitbetaling blijft blokkeren.
    db.invoice.findMany({
      where: {
        status: { not: "CANCELLED" },
        OR: [{ issueDate: { gte: yearStart } }, { status: { not: "PAID" } }],
      },
      select: {
        id: true,
        number: true,
        clientId: true,
        status: true,
        total: true,
        issueDate: true,
        dueDate: true,
        paidDate: true,
        client: { select: { companyName: true } },
        lines: { select: { placementId: true, placement: { select: { consultantId: true } } } },
      },
    }),
    // Openstaande uitbetalingen: de self-billing inkoopfacturen …
    db.purchaseInvoice.findMany({
      where: { status: { in: ["DRAFT", "APPROVED"] } },
      select: {
        id: true,
        number: true,
        total: true,
        consultantId: true,
        consultant: { select: { firstName: true, lastName: true, companyName: true } },
        lines: { select: { placementId: true } },
      },
    }),
    // … én de facturen die ZZP'ers zelf stuurden (die hebben geen regels, dus
    // die koppelen op de freelancer).
    db.receivedInvoice.findMany({
      where: { status: { not: "PAID" } },
      select: {
        id: true,
        number: true,
        amount: true,
        consultantId: true,
        consultant: { select: { firstName: true, lastName: true, companyName: true } },
      },
    }),
  ]);

  const uniek = (ids: (string | null | undefined)[]) =>
    [...new Set(ids.filter((id): id is string => Boolean(id)))];

  const salesInvoices: VerkoopFactuur[] = invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    clientId: inv.clientId,
    clientName: inv.client.companyName,
    status: inv.status,
    total: inv.total,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    paidDate: inv.paidDate,
    placementIds: uniek(inv.lines.map((l) => l.placementId)),
    consultantIds: uniek(inv.lines.map((l) => l.placement?.consultantId)),
  }));

  const purchaseObligations: Uitbetaalverplichting[] = [
    ...purchases.map<Uitbetaalverplichting>((p) => ({
      id: p.id,
      soort: "inkoopfactuur",
      number: p.number,
      consultantId: p.consultantId,
      consultantName: partyName(p.consultant),
      placementIds: uniek(p.lines.map((l) => l.placementId)),
      amount: p.total,
      betaald: false,
    })),
    ...received.map<Uitbetaalverplichting>((r) => ({
      id: r.id,
      soort: "ontvangen-factuur",
      number: r.number,
      consultantId: r.consultantId,
      consultantName: partyName(r.consultant),
      placementIds: [],
      amount: r.amount,
      betaald: false,
    })),
  ];

  const { facturen, vrijgave, samenvatting } = buildBetaalmatching({
    salesInvoices,
    purchaseObligations,
    now,
  });
  const L = BETAALMATCHING_LABELS;

  const detailHref = (soort: Uitbetaalverplichting["soort"], id: string) =>
    soort === "inkoopfactuur" ? `/inkoopfacturen/${id}` : `/ontvangen-facturen/${id}`;

  return (
    <div className="space-y-6">
      <BackLink href="/betaalmonitor">Terug naar betaalmonitor</BackLink>

      <PageHeader
        title="Betaalmatching"
        description="Welke klantbetaling hoort bij welke uitbetaling — en mag Q4S deze freelancer dus al betalen? Alleen-lezen signalering; er wordt hier nooit automatisch uitbetaald."
      />

      {/* Kerncijfers: wat is er binnen, wat staat er open, wat is te laat */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`${L.betaald} door de klant`}
          value={formatCurrency(samenvatting.facturen.betaald.total)}
          sub={`${samenvatting.facturen.betaald.count} van ${samenvatting.facturen.totaal.count} verkoopfacturen`}
          icon={<BadgeCheck className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label={L.open}
          value={formatCurrency(samenvatting.facturen.open.total)}
          sub={`${samenvatting.facturen.open.count} facturen · vervaldatum nog niet verstreken`}
          icon={<Clock className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label={`${L.teLaat} bij de klant`}
          value={formatCurrency(samenvatting.facturen.teLaat.total)}
          sub={`${samenvatting.facturen.teLaat.count} facturen over de vervaldatum`}
          icon={<ShieldAlert className="h-5 w-5" />}
          accent={samenvatting.facturen.teLaat.count > 0 ? "red" : "slate"}
        />
        <StatCard
          label="Vrij te geven"
          value={formatCurrency(samenvatting.verplichtingen.vrijgeven.total)}
          sub={`${samenvatting.verplichtingen.vrijgeven.count} van ${samenvatting.verplichtingen.totaal.count} uitbetalingen · klant heeft betaald`}
          icon={<HandCoins className="h-5 w-5" />}
          accent="brand"
        />
      </div>

      {/* Freelancer uitbetalen? — de kern van deze pagina */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-ink-400" />
            Freelancer uitbetalen?
          </CardTitle>
          <span className="text-sm text-ink-400">
            {samenvatting.verplichtingen.klantTeLaat.count + samenvatting.verplichtingen.wachtOpKlant.count}{" "}
            uitbetaling(en) wachten op de klant
          </span>
        </CardHeader>
        {vrijgave.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<Banknote className="h-6 w-6" />}
              title="Geen openstaande uitbetalingen"
              description="Er staat op dit moment geen inkoopfactuur of ontvangen freelancer-factuur open."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>{L.freelancer}</TH>
                <TH>{L.obligation}</TH>
                <TH className="text-right">{L.amount}</TH>
                <TH>{L.linkedInvoices}</TH>
                <TH>{L.release}</TH>
              </TR>
            </THead>
            <TBody>
              {vrijgave.map((r) => (
                <TR
                  key={`${r.soort}-${r.id}`}
                  className={r.bucket === "klantTeLaat" ? "bg-red-50/40" : undefined}
                >
                  <TD>
                    <Link
                      href={`/werknemers/${r.consultantId}`}
                      className="font-medium text-ink-900 hover:text-brand-600"
                    >
                      {r.consultantName}
                    </Link>
                  </TD>
                  <TD className="text-ink-600">
                    <Link href={detailHref(r.soort, r.id)} className="hover:text-brand-600">
                      {r.number ?? "— zonder nummer"}
                    </Link>
                    <span className="block text-xs text-ink-400">{r.soortLabel}</span>
                  </TD>
                  <TD className="text-right tabular-nums">{formatCurrency(r.amount)}</TD>
                  <TD className="text-ink-600">
                    {r.facturen.length === 0 ? (
                      <span className="text-ink-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {r.facturen.map((f) => (
                          <Link
                            key={f.id}
                            href={`/facturen/${f.id}`}
                            className="tabular-nums hover:text-brand-600"
                          >
                            {f.number}
                            <span className="text-xs text-ink-400"> ({f.label.toLowerCase()})</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </TD>
                  <TD>
                    <Badge color={VRIJGAVE_KLEUR[r.bucket]}>{r.label}</Badge>
                    <span className="mt-1 block max-w-md text-xs text-ink-500">{r.toelichting}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* De klantkant: welke verkoopfactuur is binnen, welke niet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-ink-400" />
            Verkoopfacturen — heeft de klant betaald?
          </CardTitle>
          <span className="text-sm text-ink-400">te laat bovenaan</span>
        </CardHeader>
        {facturen.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="Nog geen verkoopfacturen"
              description="Zodra er facturen naar klanten gaan, staat hier per factuur of het geld binnen is."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>{L.invoice}</TH>
                <TH>{L.client}</TH>
                <TH className="text-right">{L.amount}</TH>
                <TH>{L.status}</TH>
                <TH className="text-right">{L.days}</TH>
              </TR>
            </THead>
            <TBody>
              {facturen.map((f) => (
                <TR key={f.id} className={f.bucket === "teLaat" ? "bg-red-50/40" : undefined}>
                  <TD>
                    <Link
                      href={`/facturen/${f.id}`}
                      className="font-medium text-ink-900 tabular-nums hover:text-brand-600"
                    >
                      {f.number}
                    </Link>
                  </TD>
                  <TD className="text-ink-700">
                    <Link href={`/klanten/${f.clientId}`} className="hover:text-brand-600">
                      {f.clientName}
                    </Link>
                  </TD>
                  <TD className="text-right tabular-nums">{formatCurrency(f.total)}</TD>
                  <TD>
                    <Badge color={FACTUUR_BUCKET_KLEUR[f.bucket]}>{f.label}</Badge>
                    <span className="mt-1 block text-xs text-ink-400">
                      {f.betaald
                        ? `betaald op ${formatDate(f.paidDate)}`
                        : `vervalt ${formatDate(f.dueDate)}`}
                    </span>
                  </TD>
                  <TD className="text-right tabular-nums">
                    <span className={f.dagenTeLaat > 0 && !f.betaald ? "font-semibold text-red-600" : ""}>
                      {f.dagenOpen} d
                    </span>
                    {f.dagenTeLaat > 0 && (
                      <span className="block text-xs text-ink-400">{f.dagenTeLaat} d te laat</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <p>
          {L.cashflowNote} Een uitbetaling wordt gekoppeld via de plaatsing op de factuurregels, en
          anders via de freelancer zelf. Staat er &quot;{L.nietGekoppeld.toLowerCase()}&quot;, controleer
          dan eerst handmatig of de uren al doorbelast zijn. Deze pagina signaleert alleen — betalen doe je
          bewust via{" "}
          <Link href="/betalingen" className="underline hover:text-ink-700">
            Betalingen (SEPA)
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
