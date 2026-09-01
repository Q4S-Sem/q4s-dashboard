import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Coins,
  Percent,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatCurrency, formatHours, parseDecimal } from "@/lib/utils";
import { buildMargeOverzicht, type MargeRegel } from "@/lib/marge-overzicht";

export const metadata = { title: "Marges" };
export const dynamic = "force-dynamic";

const MONTH_FMT = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

/**
 * Marge-overzicht: waar verdienen we, en waar staat de marge onder druk.
 *
 * ALLEEN-LEZEN. De pagina haalt de gefactureerde uren-regels op, geeft ze als
 * platte arrays door aan de zuivere rekenfuncties in src/lib/marge-overzicht.ts
 * en toont het resultaat. Er wordt hier niets gemuteerd.
 *
 * Rekenbasis: uren-regels van niet-geannuleerde verkoopfacturen uit dit
 * kalenderjaar, gekoppeld aan hun plaatsing. Marge = uren × (chargeRate −
 * costRate) — hetzelfde tarievenpaar als op /dashboard/plaatsingen, maar dáár
 * per contract-tarief en hier over de ÉCHT gefactureerde uren. Toeslag- en
 * kilometerregels horen niet bij het uurtarief en blijven buiten beeld.
 */
export default async function MargesPage({
  searchParams,
}: {
  searchParams: Promise<{ norm?: string }>;
}) {
  const sp = await searchParams;
  // De marge-norm komt van de gebruiker, niet uit de code: leeg = geen norm, en
  // dan geldt alleen "er blijft per uur niets over" (≤ 0) als onder druk.
  const normRaw = (sp.norm ?? "").trim();
  const norm = normRaw === "" ? null : parseDecimal(normRaw);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const lines = await db.invoiceLine.findMany({
    where: {
      invoice: {
        status: { not: "CANCELLED" },
        issueDate: { gte: yearStart, lt: nextYearStart },
      },
      placementId: { not: null },
      // Alleen uren; toeslag- en kilometerregels rekenen niet met een uurtarief.
      // Oudere regels zonder lineKind zijn nog gewone uren-regels.
      OR: [{ lineKind: "HOURS" }, { lineKind: null }],
    },
    select: {
      quantity: true,
      invoice: {
        select: {
          issueDate: true,
          clientId: true,
          client: { select: { companyName: true } },
        },
      },
      placement: {
        select: {
          costRate: true,
          chargeRate: true,
          consultant: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  const toRow = (l: (typeof lines)[number]): MargeRegel | null => {
    if (!l.placement) return null;
    return {
      clientId: l.invoice.clientId,
      clientName: l.invoice.client.companyName,
      consultantId: l.placement.consultant.id,
      consultantName: `${l.placement.consultant.firstName} ${l.placement.consultant.lastName}`,
      hours: l.quantity,
      costRate: l.placement.costRate,
      chargeRate: l.placement.chargeRate,
    };
  };

  const yearRows = lines.map(toRow).filter((r): r is MargeRegel => r !== null);
  const monthRows = lines
    .filter((l) => new Date(l.invoice.issueDate) >= monthStart)
    .map(toRow)
    .filter((r): r is MargeRegel => r !== null);

  const { perClient, perFreelancer, summary } = buildMargeOverzicht({ rows: yearRows, norm });
  const maand = buildMargeOverzicht({ rows: monthRows, norm }).summary;

  const normLabel = norm === null ? "geen norm ingesteld" : `norm ${formatCurrency(norm)}/u`;

  return (
    <div className="space-y-6">
      <BackLink href="/verwerken">Terug naar verwerken</BackLink>

      <PageHeader
        title="Marges"
        description={`Waar verdient Q4S, en waar staat de marge onder druk. Berekend over de gefactureerde uren van ${now.getFullYear()}: uren × (verkooptarief − inkooptarief) van de plaatsing.`}
        actions={
          <form method="get" className="flex items-end gap-2">
            <div>
              <label htmlFor="norm" className="mb-1.5 block text-[13px] font-medium text-ink-600">
                Marge-norm per uur
              </label>
              <Input
                id="norm"
                name="norm"
                type="text"
                inputMode="decimal"
                placeholder="bijv. 12,50"
                defaultValue={normRaw}
                className="w-36"
              />
            </div>
            <Button type="submit" variant="outline">
              Toepassen
            </Button>
          </form>
        }
      />

      {/* Kerncijfers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Marge deze maand"
          value={formatCurrency(maand.totalMargin)}
          sub={`${MONTH_FMT.format(monthStart)} · ${formatHours(maand.hours)} uur`}
          icon={<Coins className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label={`Marge ${now.getFullYear()}`}
          value={formatCurrency(summary.totalMargin)}
          sub={`${formatHours(summary.hours)} uur · gemiddeld ${formatCurrency(summary.avgMarginPerHour)}/u`}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Beste klant"
          value={summary.bestClient?.clientName ?? "—"}
          sub={
            summary.bestClient
              ? `${formatCurrency(summary.bestClient.marginPerHour)}/u · ${formatCurrency(summary.bestClient.totalMargin)} marge`
              : "nog geen gefactureerde uren"
          }
          icon={<Trophy className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Onder druk"
          value={summary.belowNormCount}
          sub={
            summary.worstClient
              ? `${normLabel} · laagste: ${summary.worstClient.clientName} (${formatCurrency(summary.worstClient.marginPerHour)}/u)`
              : normLabel
          }
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={summary.belowNormCount > 0 ? "red" : "slate"}
        />
      </div>

      {/* Marge per klant */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-ink-400" />
            Marge per klant
          </CardTitle>
          <span className="text-sm text-ink-400">
            {norm === null
              ? "onder druk = geen marge per uur over"
              : `onder druk = minder dan ${formatCurrency(norm)}/u`}
          </span>
        </CardHeader>
        {perClient.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<Percent className="h-6 w-6" />}
              title="Nog geen gefactureerde uren"
              description={`Er staan dit jaar nog geen uren-regels op een verkoopfactuur, dus valt er nog geen marge te berekenen.`}
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Klant</TH>
                <TH className="text-right">Freelancers</TH>
                <TH className="text-right">Uren</TH>
                <TH className="text-right">Marge/u</TH>
                <TH className="text-right">Marge totaal</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {perClient.map((c) => (
                <TR key={c.clientId} className={c.belowNorm ? "bg-red-50/40" : undefined}>
                  <TD>
                    <Link
                      href={`/klanten/${c.clientId}`}
                      className="font-medium text-ink-900 hover:text-brand-600"
                    >
                      {c.clientName}
                    </Link>
                  </TD>
                  <TD className="text-right tabular-nums">{c.freelancers}</TD>
                  <TD className="text-right tabular-nums">{formatHours(c.hours)}</TD>
                  <TD
                    className={`text-right font-medium tabular-nums ${
                      c.belowNorm ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {formatCurrency(c.marginPerHour)}/u
                  </TD>
                  <TD className="text-right tabular-nums">{formatCurrency(c.totalMargin)}</TD>
                  <TD>
                    {c.belowNorm ? (
                      <Badge color="red">Onder druk</Badge>
                    ) : (
                      <Badge color="green">Op norm</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Marge per freelancer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-400" />
            Marge per freelancer
          </CardTitle>
          <span className="text-sm text-ink-400">gewogen over de gefactureerde uren</span>
        </CardHeader>
        {perFreelancer.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Nog geen gefactureerde uren"
              description="Zodra er uren op een verkoopfactuur staan, verschijnt hier de marge per persoon."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Freelancer</TH>
                <TH className="text-right">Klanten</TH>
                <TH className="text-right">Uren</TH>
                <TH className="text-right">Marge/u</TH>
                <TH className="text-right">Marge totaal</TH>
              </TR>
            </THead>
            <TBody>
              {perFreelancer.map((f) => (
                <TR key={f.consultantId}>
                  <TD>
                    <Link
                      href={`/werknemers/${f.consultantId}`}
                      className="font-medium text-ink-900 hover:text-brand-600"
                    >
                      {f.consultantName}
                    </Link>
                  </TD>
                  <TD className="text-right tabular-nums">{f.clients}</TD>
                  <TD className="text-right tabular-nums">{formatHours(f.hours)}</TD>
                  <TD
                    className={`text-right font-medium tabular-nums ${
                      f.marginPerHour <= 0 ? "text-red-700" : "text-emerald-700"
                    }`}
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

      <p className="text-xs text-ink-400">
        Marge per uur is gewogen over de uren, niet het gemiddelde van de losse regels. Toeslagen en
        kilometers blijven buiten deze cijfers. Contract-tarieven per plaatsing staan op{" "}
        <Link href="/dashboard/plaatsingen" className="underline hover:text-ink-700">
          Plaatsingen &amp; marges
        </Link>
        .
      </p>
    </div>
  );
}
