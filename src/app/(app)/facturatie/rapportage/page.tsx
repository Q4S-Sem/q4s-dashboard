import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  Coins,
  Download,
  Repeat,
  Scale,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { buttonVariants } from "@/components/ui/button";
import { QUARTERS } from "@/lib/domain";
import { cn, formatCurrency, formatDate, formatHours, formatPercent } from "@/lib/utils";
import { btwOverview, periodToRange } from "@/lib/boekhouding";
import { invoicingOverview } from "@/lib/facturatie";
import { buildMargeOverzicht, type MargeRegel } from "@/lib/marge-overzicht";
import { summarizeRecurringFaults, type PastFault } from "@/lib/facturatie-detecties";
import { matchSalesInvoices, steekproefChecklist } from "@/lib/steekproef";
import { FACTURATIE_ENTITY, ACCEPT_KEY } from "@/lib/facturatie-week";

// ---------------------------------------------------------------------------
// RAPPORTAGE — één periode, alle cijfers die de eigenaar wil zien: wat er
// binnenkwam, wat eruit ging, wat eraan verdiend is, wat de btw doet en wie
// steeds dezelfde fout maakt. Daaronder de Kiwa/SNA-steekproef.
//
// ALLEEN-LEZEN. Elke som komt uit een bestaande bron (facturatie.ts,
// boekhouding.ts, marge-overzicht.ts, steekproef.ts); hier wordt geen nieuwe
// factuurwiskunde bedacht en er wordt niets gemuteerd.
// ---------------------------------------------------------------------------

export const metadata = { title: "Rapportage" };
export const dynamic = "force-dynamic";

const START_JAAR = 2024;

type SP = { jaar?: string; kwartaal?: string; q?: string };

/** De fouttypes die we per freelancer tellen — in gewone woorden. */
const FOUT_AFWIJKING = "factuur wijkt af van de urenstaat";
const FOUT_GEEN_PERIODE = "factuur zonder periode";
const FOUT_GEACCEPTEERD = "fout bewust geaccepteerd";

/**
 * N keer dezelfde fout → `summarizeRecurringFaults` maakt er "3e keer …" van.
 * De eerste keer krijgt bewust geen label: dan is er nog geen patroon.
 */
function herhaling(aantal: number, type: string) {
  if (aantal <= 0) return null;
  const eerder: PastFault[] = Array.from({ length: aantal - 1 }, () => ({ type }));
  return summarizeRecurringFaults(eerder, type);
}

export default async function RapportagePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const maxJaar = now.getFullYear();

  const jaar = Math.min(
    Math.max(sp.jaar && /^\d{4}$/.test(sp.jaar) ? Number(sp.jaar) : maxJaar, START_JAAR),
    maxJaar,
  );
  // Standaard het LOPENDE KWARTAAL — dat is waar de eigenaar op stuurt.
  const kwartaal =
    sp.kwartaal === "jaar"
      ? null
      : sp.kwartaal && /^[1-4]$/.test(sp.kwartaal)
        ? Number(sp.kwartaal)
        : Math.floor(now.getMonth() / 3) + 1;
  const periode = { year: jaar, quarter: kwartaal };
  const range = periodToRange(periode);

  // Nummers uit de Kiwa-opvraagmail (komma/spatie/nieuwe regel gescheiden).
  const termen = (sp.q ?? "")
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

  const [inv, btw, margeRegels, ontvangen, accepteerNotities] = await Promise.all([
    invoicingOverview(range),
    btwOverview(periode),
    // Gefactureerde UREN-regels in deze periode, met het tarievenpaar van hun
    // plaatsing — de basis voor de marge per klant/freelancer.
    db.invoiceLine.findMany({
      where: {
        invoice: {
          status: { not: "CANCELLED" },
          issueDate: { gte: range.start, lt: range.end },
        },
        placementId: { not: null },
        // Alleen uren; toeslag- en kilometerregels kennen geen uurtarief.
        OR: [{ lineKind: "HOURS" }, { lineKind: null }],
      },
      select: {
        quantity: true,
        invoice: { select: { clientId: true, client: { select: { companyName: true } } } },
        placement: {
          select: {
            costRate: true,
            chargeRate: true,
            consultant: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
    // Alle ontvangen ZZP-facturen (alle tijd) — de bron voor "wie maakt steeds
    // dezelfde fout". Een patroon zie je niet binnen één kwartaal.
    db.receivedInvoice.findMany({
      select: {
        id: true,
        consultantId: true,
        periodStart: true,
        periodEnd: true,
        discrepancyMailedAt: true,
        status: true,
        consultant: { select: { firstName: true, lastName: true } },
      },
    }),
    db.activity.findMany({
      where: { entityType: FACTURATIE_ENTITY, sourceKey: ACCEPT_KEY },
      select: { entityId: true },
    }),
  ]);

  const regels: MargeRegel[] = margeRegels.flatMap((l) =>
    l.placement
      ? [
          {
            clientId: l.invoice.clientId,
            clientName: l.invoice.client.companyName,
            consultantId: l.placement.consultant.id,
            consultantName: `${l.placement.consultant.firstName} ${l.placement.consultant.lastName}`,
            hours: l.quantity,
            costRate: l.placement.costRate,
            chargeRate: l.placement.chargeRate,
          },
        ]
      : [],
  );
  const marge = buildMargeOverzicht({ rows: regels });

  // --- Terugkerende fouten per freelancer -----------------------------------
  // Bron 1+2: de ontvangen facturen zelf (afwijking gemaild / geen periode).
  // Bron 3: weken waarvan een mens de fouten BEWUST accepteerde (met reden).
  const plaatsingIds = [
    ...new Set(accepteerNotities.map((a) => a.entityId.split(":")[0]).filter(Boolean)),
  ];
  const plaatsingen = plaatsingIds.length
    ? await db.placement.findMany({
        where: { id: { in: plaatsingIds } },
        select: { id: true, consultantId: true },
      })
    : [];
  const consultantVanPlaatsing = new Map(plaatsingen.map((p) => [p.id, p.consultantId]));

  type FoutenPerPersoon = {
    consultantId: string;
    naam: string;
    afwijking: number;
    geenPeriode: number;
    geaccepteerd: number;
  };
  const fouten = new Map<string, FoutenPerPersoon>();
  const zorg = (id: string, naam: string): FoutenPerPersoon => {
    let r = fouten.get(id);
    if (!r) {
      r = { consultantId: id, naam, afwijking: 0, geenPeriode: 0, geaccepteerd: 0 };
      fouten.set(id, r);
    }
    return r;
  };
  for (const r of ontvangen) {
    const naam = `${r.consultant.firstName} ${r.consultant.lastName}`;
    // Gemaild over een verschil = een geconstateerde, gecommuniceerde fout.
    if (r.discrepancyMailedAt) zorg(r.consultantId, naam).afwijking += 1;
    if (!r.periodStart || !r.periodEnd) zorg(r.consultantId, naam).geenPeriode += 1;
  }
  for (const a of accepteerNotities) {
    const consultantId = consultantVanPlaatsing.get(a.entityId.split(":")[0]);
    if (!consultantId) continue;
    const bestaand = fouten.get(consultantId);
    if (bestaand) bestaand.geaccepteerd += 1;
    else {
      const c = ontvangen.find((o) => o.consultantId === consultantId);
      zorg(
        consultantId,
        c ? `${c.consultant.firstName} ${c.consultant.lastName}` : "Onbekende freelancer",
      ).geaccepteerd += 1;
    }
  }
  const herhaalde = [...fouten.values()]
    .map((f) => ({
      ...f,
      labels: [
        herhaling(f.afwijking, FOUT_AFWIJKING),
        herhaling(f.geenPeriode, FOUT_GEEN_PERIODE),
        herhaling(f.geaccepteerd, FOUT_GEACCEPTEERD),
      ].filter((x): x is NonNullable<typeof x> => Boolean(x?.label)),
      totaal: f.afwijking + f.geenPeriode + f.geaccepteerd,
    }))
    .filter((f) => f.labels.length > 0)
    .sort((a, b) => b.totaal - a.totaal || a.naam.localeCompare(b.naam, "nl"))
    .slice(0, 12);

  // --- Kiwa/SNA-steekproef ---------------------------------------------------
  type SteekproefRij = {
    id: string;
    number: string | null;
    issueDate: Date | null;
    amount: number;
    naam: string;
    consultantId: string;
    checklist: ReturnType<typeof steekproefChecklist>;
    verkoopNummers: string[];
  };
  const steekproef: SteekproefRij[] = [];
  if (termen.length > 0) {
    const gevonden = await db.receivedInvoice.findMany({
      where: { OR: termen.map((t) => ({ number: { contains: t, mode: "insensitive" as const } })) },
      include: {
        consultant: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
      },
      orderBy: { issueDate: "desc" },
      take: 40,
    });
    for (const f of gevonden) {
      const [docs, sales] = await Promise.all([
        db.document.groupBy({
          by: ["category"],
          where: { consultantId: f.consultantId },
          _count: { _all: true },
        }),
        db.invoice.findMany({
          where: { lines: { some: { timesheet: { placement: { consultantId: f.consultantId } } } } },
          include: { lines: { include: { timesheet: { select: { weekStart: true } } } } },
        }),
      ]);
      const docCount = new Map(docs.map((d) => [d.category, d._count._all]));
      const treffers = matchSalesInvoices(
        { id: f.id, issueDate: f.issueDate, periodStart: f.periodStart, periodEnd: f.periodEnd },
        sales.map((s) => ({
          id: s.id,
          number: s.number,
          issueDate: s.issueDate,
          weekStarts: s.lines
            .map((l) => l.timesheet?.weekStart)
            .filter((w): w is Date => Boolean(w)),
        })),
      );
      steekproef.push({
        id: f.id,
        number: f.number,
        issueDate: f.issueDate,
        amount: f.amount,
        consultantId: f.consultant.id,
        naam:
          f.consultant.companyName?.trim() ||
          `${f.consultant.firstName} ${f.consultant.lastName}`,
        checklist: steekproefChecklist({
          contractDocs: docCount.get("CONTRACT") ?? 0,
          kvkDocs: docCount.get("KVK") ?? 0,
          idDocs: docCount.get("ID") ?? 0,
          purchaseFile: Boolean(f.fileName),
          paymentDocs: docCount.get("BETAALBEWIJS") ?? 0,
          salesMatches: treffers.length,
        }),
        verkoopNummers: treffers.map((s) => s.number),
      });
    }
  }

  const jaren = Array.from({ length: maxJaar - START_JAAR + 1 }, (_, i) => START_JAAR + i);
  const btwTeBetalen = btw.saldo >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facturatie"
        title="Rapportage"
        description={`Omzet, inkoop, marge en btw over ${range.label.toLowerCase()} — plus wie telkens dezelfde fout maakt.`}
        actions={
          <form method="get" className="flex flex-wrap items-end gap-2">
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">
                Jaar
              </span>
              <Select name="jaar" defaultValue={String(jaar)} aria-label="Jaar" className="w-28">
                {jaren.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">
                Periode
              </span>
              <Select
                name="kwartaal"
                defaultValue={kwartaal ? String(kwartaal) : "jaar"}
                aria-label="Periode"
                className="w-40"
              >
                {QUARTERS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
                <option value="jaar">Heel jaar</option>
              </Select>
            </div>
            <button type="submit" className={buttonVariants({ variant: "secondary" })}>
              Toon
            </button>
          </form>
        }
      />

      {/* Van omzet naar marge */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Omzet (ex btw)"
          value={formatCurrency(inv.omzet)}
          sub={range.label}
          icon={<ArrowDownCircle className="h-4 w-4" />}
          accent="green"
        />
        <StatCard
          label="Inkoop (ex btw)"
          value={formatCurrency(inv.inkoop)}
          sub="facturen van freelancers"
          icon={<ArrowUpCircle className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Brutomarge"
          value={formatCurrency(inv.marge)}
          sub={`${formatPercent(inv.margePct)} van de omzet`}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="violet"
        />
        <StatCard
          label="Nog te ontvangen"
          value={formatCurrency(inv.openstaand)}
          sub={
            inv.overdue > 0
              ? `${formatCurrency(inv.overdue)} te laat · ${inv.openstaandCount} facturen`
              : `${inv.openstaandCount} facturen, alles op tijd`
          }
          icon={<Coins className="h-4 w-4" />}
          accent={inv.overdue > 0 ? "red" : "slate"}
        />
        <StatCard
          label="Nog te betalen"
          value={formatCurrency(inv.teBetalen)}
          sub={`${inv.teBetalenCount} goedgekeurde freelancerfacturen`}
          icon={<Coins className="h-4 w-4" />}
          accent="slate"
        />
      </div>

      {/* Btw-indicatie */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-ink-400" /> Btw — {range.label}
          </CardTitle>
          <span className="text-xs text-ink-400">
            Een management-indicatie ter voorbereiding, geen officiële aangifte.
          </span>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Verschuldigde btw"
            value={formatCurrency(btw.verschuldigd)}
            sub={`over ${formatCurrency(btw.verkoop.net)} omzet · ${btw.verkoop.count} facturen`}
            accent="amber"
          />
          <StatCard
            label="Voorbelasting (terug)"
            value={formatCurrency(btw.voorbelasting)}
            sub={`uit ${btw.voorbelastingBronnen.length} ${btw.voorbelastingBronnen.length === 1 ? "bron" : "bronnen"}`}
            accent="green"
          />
          <StatCard
            label={btwTeBetalen ? "Te betalen aan Belastingdienst" : "Terug te vorderen"}
            value={formatCurrency(Math.abs(btw.saldo))}
            sub={btwTeBetalen ? "verschuldigd − voorbelasting" : "voorbelasting − verschuldigd"}
            accent={btwTeBetalen ? "red" : "green"}
          />
        </CardContent>
        {(btw.concepten.salesCount > 0 ||
          btw.onbekendeBtw.count > 0 ||
          btw.nietAftrekbaar.count > 0) && (
          <CardContent className="space-y-2 pt-0">
            {btw.concepten.salesCount > 0 && (
              <p className="rounded-sm border border-ink-200 bg-ink-50 px-3 py-2 text-[13px] text-ink-600">
                <strong>
                  {btw.concepten.salesCount} concept-
                  {btw.concepten.salesCount === 1 ? "verkoopfactuur" : "verkoopfacturen"}
                </strong>{" "}
                ({formatCurrency(btw.concepten.salesVat)} btw) tellen nog niet mee — pas als je ze
                verstuurt.
              </p>
            )}
            {btw.onbekendeBtw.count > 0 && (
              <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                <strong>
                  {btw.onbekendeBtw.count} {btw.onbekendeBtw.count === 1 ? "post" : "posten"} zonder
                  btw-bedrag
                </strong>{" "}
                ({formatCurrency(btw.onbekendeBtw.grossTotal)} incl.) — vul de btw aan, anders mis je
                die voorbelasting.
              </p>
            )}
            {btw.nietAftrekbaar.count > 0 && (
              <p className="rounded-sm border border-ink-200 bg-ink-50 px-3 py-2 text-[13px] text-ink-600">
                {btw.nietAftrekbaar.count} niet-aftrekbare{" "}
                {btw.nietAftrekbaar.count === 1 ? "bon" : "bonnen"} — hun btw (
                {formatCurrency(btw.nietAftrekbaar.vatExcluded)}) telt bewust <em>niet</em> mee.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Marge per klant / per freelancer */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-ink-400" /> Per klant
            </CardTitle>
            <span className="text-xs text-ink-400">
              marge per uur, gewogen over de gefactureerde uren
            </span>
          </CardHeader>
          {marge.perClient.length === 0 ? (
            <CardContent>
              <EmptyState
                className="border-0"
                icon={<Building2 className="h-6 w-6" />}
                title="Geen gefactureerde uren in deze periode"
                description="Zodra er uren op een verkoopfactuur staan, staat hier de marge per klant."
              />
            </CardContent>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Klant</TH>
                  <TH className="text-right">Uren</TH>
                  <TH className="text-right">Marge/u</TH>
                  <TH className="text-right">Marge totaal</TH>
                </TR>
              </THead>
              <TBody>
                {marge.perClient.slice(0, 12).map((c) => (
                  <TR key={c.clientId} className={c.belowNorm ? "bg-red-50/40" : undefined}>
                    <TD>
                      <Link
                        href={`/klanten/${c.clientId}`}
                        className="font-medium text-ink-900 hover:text-brand-600"
                      >
                        {c.clientName}
                      </Link>
                      <span className="block text-xs text-ink-400">
                        {c.freelancers} freelancer{c.freelancers === 1 ? "" : "s"}
                      </span>
                    </TD>
                    <TD className="text-right tabular-nums">{formatHours(c.hours)}</TD>
                    <TD
                      className={cn(
                        "text-right font-medium tabular-nums",
                        c.belowNorm ? "text-red-700" : "text-emerald-700",
                      )}
                    >
                      {formatCurrency(c.marginPerHour)}/u
                    </TD>
                    <TD className="text-right tabular-nums">{formatCurrency(c.totalMargin)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-ink-400" /> Per freelancer
            </CardTitle>
            <span className="text-xs text-ink-400">
              {marge.summary.freelancers} personen · {formatHours(marge.summary.hours)} uur
            </span>
          </CardHeader>
          {marge.perFreelancer.length === 0 ? (
            <CardContent>
              <EmptyState
                className="border-0"
                icon={<Users className="h-6 w-6" />}
                title="Geen gefactureerde uren in deze periode"
                description="Zodra er uren op een verkoopfactuur staan, staat hier de marge per persoon."
              />
            </CardContent>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Freelancer</TH>
                  <TH className="text-right">Uren</TH>
                  <TH className="text-right">Marge/u</TH>
                  <TH className="text-right">Marge totaal</TH>
                </TR>
              </THead>
              <TBody>
                {marge.perFreelancer.slice(0, 12).map((f) => (
                  <TR key={f.consultantId}>
                    <TD>
                      <span className="flex items-center gap-2.5">
                        <PersoonVierkant naam={f.consultantName} />
                        <span className="min-w-0">
                          <Link
                            href={`/werknemers/${f.consultantId}`}
                            className="font-medium text-ink-900 hover:text-brand-600"
                          >
                            {f.consultantName}
                          </Link>
                          <span className="block text-xs text-ink-400">
                            {f.clients} klant{f.clients === 1 ? "" : "en"}
                          </span>
                        </span>
                      </span>
                    </TD>
                    <TD className="text-right tabular-nums">{formatHours(f.hours)}</TD>
                    <TD
                      className={cn(
                        "text-right font-medium tabular-nums",
                        f.marginPerHour <= 0 ? "text-red-700" : "text-emerald-700",
                      )}
                    >
                      {formatCurrency(f.marginPerHour)}/u
                    </TD>
                    <TD className="text-right tabular-nums">{formatCurrency(f.totalMargin)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Terugkerende fouten — wie maakt steeds dezelfde fout? */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-ink-400" /> Terugkerende fouten per freelancer
          </CardTitle>
          <span className="text-xs text-ink-400">
            over alle weken — pas vanaf de tweede keer een patroon
          </span>
        </CardHeader>
        {herhaalde.length === 0 ? (
          <CardContent>
            <EmptyState
              className="border-0"
              icon={<Repeat className="h-6 w-6" />}
              title="Geen patronen gevonden"
              description="Niemand maakt dezelfde fout twee keer. Een eerste misser telt hier bewust niet mee."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Freelancer</TH>
                <TH>Wat keert terug</TH>
                <TH className="text-right">Totaal</TH>
              </TR>
            </THead>
            <TBody>
              {herhaalde.map((f) => (
                <TR key={f.consultantId}>
                  <TD>
                    <span className="flex items-center gap-2.5">
                      <PersoonVierkant naam={f.naam} />
                      <Link
                        href={`/werknemers/${f.consultantId}`}
                        className="font-medium text-ink-900 hover:text-brand-600"
                      >
                        {f.naam}
                      </Link>
                    </span>
                  </TD>
                  <TD>
                    <span className="flex flex-wrap gap-1.5">
                      {f.labels.map((l) => (
                        <Badge key={l.label} color={l.count >= 3 ? "red" : "amber"}>
                          {l.label}
                        </Badge>
                      ))}
                    </span>
                  </TD>
                  <TD className="text-right tabular-nums text-ink-600">{f.totaal}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Kiwa/SNA-steekproef */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-ink-400" /> Steekproef (Kiwa / SNA)
          </CardTitle>
          <span className="text-xs text-ink-400">
            plak de factuurnummers uit de opvraagmail en download alles als ZIP
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            {/* De gekozen periode blijft staan als je hier zoekt. */}
            <input type="hidden" name="jaar" value={String(jaar)} />
            <input type="hidden" name="kwartaal" value={kwartaal ? String(kwartaal) : "jaar"} />
            <div className="min-w-72 flex-1">
              <label htmlFor="q" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                Factuurnummers uit de mail
              </label>
              <input
                id="q"
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Bijv. 11-2026, 2025251, 2026003"
                className="h-10 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
              <p className="mt-1 text-xs text-ink-400">
                Meerdere nummers mag: gescheiden door komma, spatie of een nieuwe regel.
              </p>
            </div>
            <button type="submit" className={buttonVariants({})}>
              Zoeken
            </button>
          </form>

          {termen.length > 0 && steekproef.length === 0 && (
            <p className="rounded-sm border border-ink-200 bg-ink-50 px-3 py-2 text-[13px] text-ink-600">
              Geen ontvangen facturen met deze nummers gevonden. Controleer of ze exact overeenkomen
              met wat er onder{" "}
              <Link href="/facturatie/inkoop" className="font-medium underline underline-offset-2">
                Inkoop &amp; betalingen
              </Link>{" "}
              staat.
            </p>
          )}

          {steekproef.map((r) => {
            const compleet = r.checklist.every((c) => c.ok);
            return (
              <div key={r.id} className="rounded-sm border border-ink-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-900">
                      <ShieldCheck
                        className={cn("h-4 w-4", compleet ? "text-emerald-600" : "text-amber-500")}
                      />
                      {r.naam}
                      <span className="font-normal text-ink-400">
                        factuur {r.number ?? "zonder nummer"}
                        {r.issueDate && ` · ${formatDate(r.issueDate)}`}
                        {r.amount > 0 && ` · ${formatCurrency(r.amount)}`}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge color={compleet ? "green" : "amber"}>
                      {r.checklist.filter((c) => c.ok).length} van {r.checklist.length} stukken
                    </Badge>
                    <a
                      href={`/api/steekproef/${r.id}`}
                      className={buttonVariants({ variant: "primary", size: "sm" })}
                      title="Alle beschikbare stukken van deze regel als ZIP downloaden"
                    >
                      <Download className="h-4 w-4" /> Download ZIP
                    </a>
                  </div>
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {r.checklist.map((c) => (
                    <li key={c.key} className="flex items-center gap-2 text-[13px]">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          c.ok ? "bg-emerald-600" : "bg-amber-500",
                        )}
                      />
                      <span className={c.ok ? "text-ink-700" : "font-medium text-amber-800"}>
                        {c.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {r.verkoopNummers.length > 0 && (
                    <span className="text-ink-400">
                      Gekoppelde verkoopfactu{r.verkoopNummers.length === 1 ? "ur" : "ren"}:{" "}
                      {r.verkoopNummers.join(", ")}
                    </span>
                  )}
                  <Link
                    href={`/medewerkers/${r.consultantId}/documenten`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Ontbrekende stukken uploaden
                  </Link>
                  <Link
                    href={`/facturatie/inkoop/${r.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Open de factuur
                  </Link>
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs text-ink-400">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Dit is een management-overzicht ter controle, geen officiële btw-aangifte. Verlegde btw,
        buitenlandse leveranciers, intracommunautaire leveringen en privégebruik vallen erbuiten.
      </p>
    </div>
  );
}
