import Link from "next/link";
import { CheckCircle2, ClipboardList, FileText, Mail, Receipt, Send, Users, Wallet } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { naarAdministratie } from "./verkoop/actions";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants, mapTabVariants } from "@/components/ui/button";
import { FilterTegels } from "@/components/ui/filter-tegels";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { getWeekOverview } from "@/lib/facturatie-week";
import { watMist } from "@/lib/facturatie-volgende";
import { INVOICE_STATUSES, RECEIVED_INVOICE_STATUSES } from "@/lib/domain";
import { cn, formatCurrency, formatHours, round2 } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PER PERSOON — dezelfde vaste lijst als Week verwerken (iedereen met een
// actieve plaatsing), maar dan met de facturen van ÉÉN kant: op Inkoop zijn
// inkoopfactuur, op Verkoop onze verkoopfactuur (marge: Kosten & winst). Zelfde opbouw als Week
// verwerken: mapjes → filtertegels → kaart met zoekveld en tabel.
// Gebruikt op Verkoopfacturen en Inkoop.
// ---------------------------------------------------------------------------

export type Weergave = "personen" | "facturen";

/** Zonder keuze: "personen", tenzij de URL al iets van de factuurlijst bevat (tab, actie-melding …). */
export function kiesWeergave(sp: Record<string, string | undefined>): Weergave {
  if (sp.weergave === "personen" || sp.weergave === "facturen") return sp.weergave;
  return Object.keys(sp).some((k) => !["week", "q", "pf", "weergave"].includes(k)) ? "facturen" : "personen";
}

/** De twee mapjes bovenaan, net als Personen | Bestanden op Week verwerken. */
export function WeergaveTabs({
  actief,
  basePath,
  week,
  facturenLabel,
  aantalFacturen,
}: {
  actief: Weergave;
  basePath: string;
  week: string;
  facturenLabel: string;
  aantalFacturen: number;
}) {
  const href = (w: Weergave) => {
    const q = new URLSearchParams({ weergave: w });
    if (week) q.set("week", week);
    return `${basePath}?${q.toString()}`;
  };
  const tabs = [
    { key: "personen" as const, label: "Per persoon", icon: <Users className="h-4 w-4" />, aantal: null },
    { key: "facturen" as const, label: facturenLabel, icon: <Receipt className="h-4 w-4" />, aantal: aantalFacturen },
  ];
  return (
    <nav aria-label="Weergave" className="flex flex-wrap items-end gap-1 border-b border-ink-200">
      {tabs.map((t) => (
        <Link key={t.key} href={href(t.key)} scroll={false} aria-current={actief === t.key ? "page" : undefined} className={mapTabVariants(actief === t.key)}>
          <span className={actief === t.key ? "text-brand-600" : "text-ink-400"}>{t.icon}</span>
          {t.label}
          {t.aantal != null && t.aantal > 0 && (
            <span className="rounded-sm bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-500">{t.aantal}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

// Gescheiden kanten: Inkoop = wat de freelancer instuurt en wij betalen;
// Verkoop = wat wij de klant factureren. Elke pagina toont alleen zijn eigen kant.
const INKOOP_MIST = ["Urenstaat", "Factuur freelancer", "Freelancer betalen"];
const VERKOOP_MIST = ["Akkoord", "Verkoopfactuur", "Versturen", "Betaling klant"];

/** Filtertegels: tegelijk teller én filter, zoals op Week verwerken. */
const FILTERS_INKOOP = [
  { key: "alles", label: "compleet", icon: <Users className="h-3.5 w-3.5" />, toon: "slate" as const, past: () => true },
  { key: "urenstaat", label: "Urenstaat mist", icon: <ClipboardList className="h-3.5 w-3.5" />, toon: "red" as const, past: (m: string[]) => m.includes("Urenstaat") },
  { key: "factuur", label: "Factuur freelancer mist", icon: <FileText className="h-3.5 w-3.5" />, toon: "amber" as const, past: (m: string[]) => m.includes("Factuur freelancer") },
  { key: "betaling", label: "Freelancer betalen", icon: <Wallet className="h-3.5 w-3.5" />, toon: "blue" as const, past: (m: string[]) => m.includes("Freelancer betalen") },
  { key: "compleet", label: "Compleet", icon: <CheckCircle2 className="h-3.5 w-3.5" />, toon: "green" as const, past: (m: string[]) => m.length === 0 },
];
const FILTERS_VERKOOP = [
  { key: "alles", label: "compleet", icon: <Users className="h-3.5 w-3.5" />, toon: "slate" as const, past: () => true },
  { key: "factureren", label: "Nog factureren", icon: <Send className="h-3.5 w-3.5" />, toon: "violet" as const, past: (m: string[]) => m.some((x) => ["Akkoord", "Verkoopfactuur", "Versturen"].includes(x)) },
  { key: "betaling", label: "Betaling klant open", icon: <Wallet className="h-3.5 w-3.5" />, toon: "blue" as const, past: (m: string[]) => m.includes("Betaling klant") },
  { key: "compleet", label: "Compleet", icon: <CheckCircle2 className="h-3.5 w-3.5" />, toon: "green" as const, past: (m: string[]) => m.length === 0 },
];

const stip = (ok: boolean) => cn("h-2 w-2 shrink-0 rounded-full", ok ? "bg-emerald-500" : "bg-red-500");

export async function PersonenPerWeek({
  week,
  basePath,
  q,
  pf,
}: {
  week: string | null;
  basePath: string;
  q?: string;
  pf?: string;
}) {
  // Alleen verkoopfacturen gaan naar de administratie van de klant; inkoop niet.
  const isVerkoop = basePath.endsWith("/verkoop");
  const { week: slot, rows } = await getWeekOverview(week);
  const inkoopIds = rows.map((r) => r.receivedInvoiceId).filter((x): x is string => !!x);
  const verkoopIds = rows.map((r) => r.verkoopFactuurId).filter((x): x is string => !!x);
  const [inkoop, verkoop, regels] = await Promise.all([
    db.receivedInvoice.findMany({
      where: { id: { in: inkoopIds } },
      select: { id: true, number: true, amount: true, vatAmount: true, status: true },
    }),
    db.invoice.findMany({
      where: { id: { in: verkoopIds } },
      select: { id: true, number: true, status: true, client: { select: { companyName: true, email: true, invoiceEmail: true } } },
    }),
    db.invoiceLine.findMany({
      where: { invoiceId: { in: verkoopIds }, weekNumber: slot.isoWeek },
      select: { invoiceId: true, placementId: true, amount: true },
    }),
  ]);
  const ink = new Map(inkoop.map((i) => [i.id, i]));
  const ver = new Map(verkoop.map((i) => [i.id, i]));

  const FILTERS = isVerkoop ? FILTERS_VERKOOP : FILTERS_INKOOP;
  const eigenKant = isVerkoop ? VERKOOP_MIST : INKOOP_MIST;
  // Inkoop: alleen freelancers (in dienst stuurt geen factuur).
  const alle = rows.filter((r) => isVerkoop || !r.factuurNvt).map((r) => {
    const i = r.receivedInvoiceId ? ink.get(r.receivedInvoiceId) : undefined;
    const v = r.verkoopFactuurId ? ver.get(r.verkoopFactuurId) : undefined;
    // Alleen de regels van DEZE persoon in deze week (één factuur kan meer mensen dekken).
    const verkoopEx = v
      ? round2(regels.filter((l) => l.invoiceId === v.id && l.placementId === r.placementId).reduce((s, l) => s + l.amount, 0))
      : null;
    const inkoopEx = i ? round2(i.amount - (i.vatAmount ?? 0)) : null;
    // ponytail: een verzamelfactuur over meerdere weken telt hier volledig mee; per-week-verdeling als dat stoort.
    const mist = watMist({
      timesheetOntvangen: r.timesheetOntvangen,
      factuurOntvangen: r.factuurOntvangen,
      factuurNvt: r.factuurNvt,
      vastgelegd: r.vastgelegd,
      inkoopStatus: i?.status ?? null,
      verkoopStatus: v?.status ?? null,
    }).filter((m) => eigenKant.includes(m));
    return { r, i, v, verkoopEx, inkoopEx, mist };
  });

  const filter = FILTERS.find((f) => f.key === pf) ?? FILTERS[0];
  const compleet = alle.filter((x) => x.mist.length === 0).length;
  const lijst = alle.filter(
    (x) => filter.past(x.mist) && matchtZoek(q, x.r.naam, x.r.klantNaam, x.r.locatie, ...x.mist, x.i?.number, x.v?.number),
  );
  const href = (key: string) => {
    const p = new URLSearchParams({ weergave: "personen" });
    if (week) p.set("week", week);
    if (key !== "alles") p.set("pf", key);
    if (q) p.set("q", q);
    return `${basePath}?${p.toString()}`;
  };

  return (
    <>
      <FilterTegels
        label="Filter op wat er mist"
        items={FILTERS.map((f) => {
          const aantal = alle.filter((x) => f.past(x.mist)).length;
          return {
            key: f.key,
            label: f.label,
            waarde: f.key === "alles" ? `${compleet}/${alle.length}` : aantal,
            icon: f.icon,
            toon: f.toon,
            href: href(f.key),
            actief: filter.key === f.key,
            rood: f.key === "urenstaat" && aantal > 0,
          };
        })}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <div className="min-w-0 flex-1">
            <TabelZoek
              basePath={basePath}
              q={q}
              placeholder="Zoek op naam, klant, factuurnummer of wat er mist…"
              behoud={{ weergave: "personen", week: week ?? undefined, pf: filter.key === "alles" ? undefined : filter.key }}
            />
          </div>
          <span className="text-[13px] tabular-nums text-ink-500">Week {slot.isoWeek}</span>
        </div>
        {lijst.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-400">Niemand in deze selectie.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Persoon</TH>
                  <TH className="text-right">Uren</TH>
                  <TH>{isVerkoop ? "Verkoopfactuur (klant)" : "Inkoopfactuur (freelancer)"}</TH>
                  <TH>Wat mist er</TH>
                  {isVerkoop && <TH className="text-right">Naar administratie</TH>}
                </TR>
              </THead>
              <TBody>
                {lijst.map(({ r, i, v, verkoopEx, inkoopEx, mist }) => (
                  <TR key={r.key}>
                    <TD>
                      <Link
                        href={
                          // Verkoop: naar de verkoopfactuur zelf (bekijken + aanpassen), of naar
                          // alle verkoopfacturen van deze persoon als er voor deze week nog geen is.
                          isVerkoop
                            ? v
                              ? `/facturatie/verkoop/${v.id}`
                              : `/facturatie/verkoop?weergave=facturen&persoon=${r.consultantId}`
                            : (r.href ?? "#")
                        }
                        className="flex items-center gap-3 hover:underline"
                      >
                        <PersoonVierkant naam={r.naam} />
                        <span className="min-w-0">
                          <span className="block font-medium text-ink-900">{r.naam}</span>
                          <span className="block text-xs text-ink-500">{r.klantNaam ?? "—"}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {r.uren != null ? formatHours(r.uren) : <span className="text-ink-300">—</span>}
                    </TD>
                    {!isVerkoop && (
                    <TD>
                      {r.factuurNvt ? (
                        <span className="text-[13px] text-ink-400">— n.v.t. (in dienst)</span>
                      ) : i ? (
                        <span className="flex items-center gap-2 text-[13px]">
                          <span className={stip(true)} />
                          <span className="tabular-nums text-ink-900">{i.number ?? "zonder nr"}</span>
                          <span className="tabular-nums text-ink-500">{formatCurrency(inkoopEx ?? 0)}</span>
                          <StatusBadge options={RECEIVED_INVOICE_STATUSES} value={i.status} />
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-[13px] text-ink-700">
                          <span className={stip(false)} /> ontbreekt
                        </span>
                      )}
                    </TD>
                    )}
                    {isVerkoop && (
                    <TD>
                      {v ? (
                        <Link href={`/facturatie/verkoop/${v.id}`} className="flex items-center gap-2 text-[13px] hover:underline">
                          <span className={stip(true)} />
                          <span className="tabular-nums text-ink-900">{v.number}</span>
                          <span className="tabular-nums text-ink-500">{formatCurrency(verkoopEx ?? 0)}</span>
                          <StatusBadge options={INVOICE_STATUSES} value={v.status} />
                        </Link>
                      ) : r.vastgelegd ? (
                        // Akkoord gegeven, klant factureert per maand/4 weken: de uren wachten op de verzamelfactuur.
                        <span className="flex items-center gap-2 text-[13px] text-amber-800" title="Deze klant krijgt één factuur per periode; die komt zodra alle weken binnen zijn (of via 'Nu factureren').">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" /> verzameld — volgt bij periodefactuur
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-[13px] text-ink-700">
                          <span className={stip(false)} /> nog niet gemaakt
                        </span>
                      )}
                    </TD>
                    )}
                    <TD>
                      {mist.length === 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" /> Compleet
                        </span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {mist.map((m) => (
                            <span key={m} className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                              {m}
                            </span>
                          ))}
                        </span>
                      )}
                    </TD>
                    {isVerkoop && (
                      <TD className="text-right">
                        <NaarAdministratie v={v} />
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}

/**
 * Doorzichtig tot er een geldige verkoopfactuur is (concept of klaar, en de klant
 * heeft een factuur-e-mailadres). Dan: na bevestiging naar de administratie van
 * het bedrijf waar de freelancer werkt.
 */
function NaarAdministratie({
  v,
}: {
  v?: { id: string; number: string; status: string; client: { companyName: string; email: string | null; invoiceEmail: string | null } };
}) {
  const adres = v?.client.invoiceEmail?.trim() || v?.client.email?.trim() || "";
  const reden = !v
    ? "Nog geen verkoopfactuur"
    : v.status === "SENT" || v.status === "PAID"
      ? "Al verstuurd"
      : v.status === "CANCELLED"
        ? "Geannuleerd"
        : !adres
          ? `Geen factuur-e-mailadres bij ${v.client.companyName}`
          : null;
  if (reden || !v) {
    return (
      <span title={reden ?? undefined} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-35")}>
        {v && (v.status === "SENT" || v.status === "PAID") ? <CheckCircle2 /> : <Mail />} {reden === "Al verstuurd" ? "Verstuurd" : "Versturen"}
      </span>
    );
  }
  return (
    <ConfirmSubmit
      action={naarAdministratie}
      hidden={{ id: v.id }}
      trigger="button"
      size="sm"
      variant="primary"
      confirmVariant="primary"
      confirmLabel="Versturen"
      message={`Factuur ${v.number} versturen naar ${v.client.companyName}?`}
      description={`De factuur gaat als PDF naar ${adres}. Daarna staat hij op Verzonden.`}
    >
      <Mail /> Versturen
    </ConfirmSubmit>
  );
}
