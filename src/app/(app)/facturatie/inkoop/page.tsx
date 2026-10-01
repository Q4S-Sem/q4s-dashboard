import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Download,
  FileSearch,
  Info,
  Layers,
  Receipt,
  ReceiptText,
  RotateCcw,
  Send,
  Upload,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterTegels, PaginaKop } from "@/components/ui/filter-tegels";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Dropzone } from "@/components/ui/dropzone";
import { Input, Select } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { ReceivedInvoicePreviewButton } from "@/components/received-invoice-preview-button";
import { weekSlotVanDatum } from "@/lib/week-koppeling";
import { WeekStrip } from "../WeekStrip";
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, RECEIVED_INVOICE_STATUSES } from "@/lib/domain";
import { cn, formatCurrency, formatDate, formatHours, formatWeekLabel, round2 } from "@/lib/utils";
import { parseWeek, ymd } from "@/lib/week-nav";
import { listReceivedInvoices } from "@/lib/received-invoices";
import { ZZP_PAYMENT_TERM_DAYS } from "@/lib/betalingen";
import { getCompanySettings } from "@/lib/settings";
import { isAdminSession } from "@/lib/session";
import {
  VRIJGAVE_KLEUR,
  freelancerReleaseStatus,
  type Uitbetaalverplichting,
  type VerkoopFactuur,
  type VrijgaveRegel,
} from "@/lib/betaalmatching";
import {
  INKOOP_TABS,
  hoortBijInkoopTab,
  inkoopBucket,
  inkoopTellingen,
  isInkoopBetaalbaar,
  inkoopVervaldatum,
  vervalLabel,
  betaalPlanning,
  type BetaalPlanning,
  type InkoopTab,
  type VervalLabel,
} from "@/lib/facturatie-lijsten";
import { BankImport } from "./BankImport";
import { DiscrepancyMailButton } from "./DiscrepancyMailButton";
import { ExpenseStatusSelect } from "./ExpenseStatusSelect";
import { pushReceivedInvoiceToSnelStart, resetWeekVanuitFactuur, setReceivedStatus } from "./actions";
import { isSnelStartConnected, snelStartMessage } from "@/lib/snelstart";
import { createManualExpense, deleteExpense, uploadExpenses } from "./declaraties-actions";

// ---------------------------------------------------------------------------
// INKOOP & BETALINGEN — al het geld dat Q4S UITGEEFT op één scherm.
//
// Drie bronnen, vier tabbladen plus declaraties:
//   • de facturen die ZZP'ers zelf sturen (Optie A: hún factuur is de inkoop —
//     Q4S maakt er nooit zelf een),
//   • het SEPA-bestand voor de bank (download, de bank keurt zelf goed),
//   • het bankafschrift (CAMT.053) om af te boeken wat écht betaald is.
//
// Niets betaalt zichzelf: de SEPA-knop levert een bestand op, en het afschrift
// inlezen boekt pas iets af nadat een mens regels heeft aangevinkt.
// ---------------------------------------------------------------------------

export const metadata = { title: "Inkoop & betalingen" };
const INKOOP_ICOON: Record<InkoopTab, React.ReactNode> = {
  controleren: <FileSearch className="h-3.5 w-3.5" />,
  tebetalen: <Banknote className="h-3.5 w-3.5" />,
  betaald: <CheckCircle2 className="h-3.5 w-3.5" />,
  afwijking: <AlertTriangle className="h-3.5 w-3.5" />,
  alles: <Layers className="h-3.5 w-3.5" />,
  declaraties: <ReceiptText className="h-3.5 w-3.5" />,
};
const INKOOP_TOON: Record<InkoopTab, "slate" | "blue" | "green" | "amber" | "red" | "violet"> = {
  controleren: "amber",
  tebetalen: "blue",
  betaald: "green",
  afwijking: "slate",
  alles: "slate",
  declaraties: "violet",
};

const VERVAL_KLEUR: Record<VervalLabel["toon"], string> = {
  rood: "text-red-700",
  oranje: "text-amber-700",
  grijs: "text-ink-600",
  groen: "text-emerald-700",
};

export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  tab?: string;
  week?: string;
  reset?: string;
  verwijderd?: string;
  afgeboekt?: string;
  overgeslagen?: string;
  fout?: string;
  snelstart?: string;
};

export default async function InkoopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const tab = (INKOOP_TABS.find((t) => t.key === sp.tab)?.key ?? "controleren") as InkoopTab;

  // Week-filter op FACTUURDATUM (bon-datum bij declaraties). Standaard "alle
  // weken": een openstaande betaling mag je niet missen doordat er een week
  // aan stond.
  const monday = parseWeek(sp.week);
  const weekParam = monday ? ymd(monday) : "";
  const volgendeMaandag = monday ? new Date(monday) : null;
  volgendeMaandag?.setDate(volgendeMaandag.getDate() + 7);
  const inWeek = (d: Date | null): boolean =>
    !monday || !volgendeMaandag || (d !== null && d >= monday && d < volgendeMaandag);

  const [alleFacturen, settings, isAdmin] = await Promise.all([
    listReceivedInvoices(),
    getCompanySettings(),
    isAdminSession(),
  ]);

  const facturen = alleFacturen.filter((r) => inWeek(r.issueDate));
  // Betaaltermijn ZZP-facturen: dezelfde als SnelStart-boeking en SEPA gebruiken.
  const termijn = ZZP_PAYMENT_TERM_DAYS;
  const tellingen = inkoopTellingen(facturen);
  const rows = facturen.filter(
    (r) => hoortBijInkoopTab(r, tab) && matchtZoek(sp.q, r.consultantName, r.number),
  );

  // Cashflow-bescherming: heeft de klant al betaald voor de uren die we aan deze
  // freelancer moeten uitbetalen? Alleen-lezen signaal — het blokkeert niets,
  // maar het staat wél in beeld vóór je een SEPA-bestand downloadt.
  const jaarStart = new Date(now.getFullYear(), 0, 1);
  const verkoop = await db.invoice.findMany({
    where: {
      status: { not: "CANCELLED" },
      OR: [{ issueDate: { gte: jaarStart } }, { status: { not: "PAID" } }],
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
  });
  const uniek = (ids: (string | null | undefined)[]) =>
    [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const salesInvoices: VerkoopFactuur[] = verkoop.map((inv) => ({
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
  const verplichtingen: Uitbetaalverplichting[] = alleFacturen
    .filter((r) => r.status !== "PAID")
    .map((r) => ({
      id: r.id,
      soort: "ontvangen-factuur" as const,
      number: r.number,
      consultantId: r.consultantId,
      consultantName: r.consultantName,
      placementIds: [],
      amount: r.amount,
      betaald: false,
    }));
  const vrijgave = new Map<string, VrijgaveRegel>(
    freelancerReleaseStatus({ salesInvoices, purchaseObligations: verplichtingen, now }).map((v) => [
      v.id,
      v,
    ]),
  );

  // SEPA gaat ALTIJD over alles wat betaalbaar is — niet over wat de week-balk
  // toont. Zelfde grens als `buildSepaForPayables`: goedgekeurd, geen afwijking.
  const betaalbaar = alleFacturen.filter(isInkoopBetaalbaar);
  const heeftEigenIban = Boolean(settings.iban?.trim());

  // Planning over ALLE weken: een openstaande betaling mag nooit wegvallen.
  const planning = betaalPlanning(alleFacturen, termijn, now);
  const snelstartAan = isSnelStartConnected();
  const betaaldBedrag = round2(
    facturen.filter((r) => inkoopBucket(r) === "betaald").reduce((s, r) => s + r.amount, 0),
  );

  // Declaraties (bonnetjes) — het derde tabblad, uit een andere tabel.
  const toonDeclaraties = tab === "declaraties";
  const [declaraties, personen] = toonDeclaraties
    ? await Promise.all([
        db.expense.findMany({
          where:
            monday && volgendeMaandag ? { date: { gte: monday, lt: volgendeMaandag } } : {},
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          include: { consultant: { select: { firstName: true, lastName: true } } },
        }),
        db.consultant.findMany({
          where: { active: true },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: { id: true, firstName: true, lastName: true },
        }),
      ])
    : [[], []];
  const declaratiesOpen = round2(
    declaraties
      .filter((e) => e.status === "NEW" || e.status === "APPROVED")
      .reduce((s, e) => s + e.amount, 0),
  );

  const tabHref = (key: InkoopTab) => {
    const p = new URLSearchParams({ tab: key });
    if (weekParam) p.set("week", weekParam);
    if (sp.q) p.set("q", sp.q);
    return `/facturatie/inkoop?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <PaginaKop
        titel="Inkoop & betalingen"
        sub={`${monday ? formatWeekLabel(monday) : "Alle weken"} · wat we aan ZZP'ers moeten betalen, en wanneer`}
      >
        <WeekStrip
          basePath="/facturatie/inkoop"
          huidig={weekSlotVanDatum(weekParam)?.key ?? null}
          vandaag={ymd(now)}
          alleWeken
          extra={{ tab: tab === "controleren" ? undefined : tab, q: sp.q }}
        />
        <a
          href="/api/betalingen/sepa"
          className={buttonVariants({
            variant: betaalbaar.length > 0 && heeftEigenIban ? "primary" : "outline",
            size: "sm",
          })}
          aria-disabled={betaalbaar.length === 0 || !heeftEigenIban}
          title="Download een pain.001-bestand met alle goedgekeurde betalingen"
        >
          <Download className="h-4 w-4" /> SEPA ({betaalbaar.length})
        </a>
      </PaginaKop>

      {sp.reset === "ok" && (
        <p className="flex items-start gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            De week is teruggezet: de factuur, de urenstaat en een eventueel concept zijn weg. De
            weekstaat staat weer klaar in{" "}
            <Link href="/facturatie" className="font-semibold underline underline-offset-2">
              Week verwerken
            </Link>
            .
          </span>
        </p>
      )}
      {sp.reset === "vergrendeld" && (
        <p className="flex items-start gap-2 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Deze week is <strong>niet</strong> teruggezet: er hangt een al klaargezette, verstuurde of
          betaalde verkoopfactuur aan. Crediteer die eerst — administratie wordt nooit automatisch
          verwijderd.
        </p>
      )}
      {sp.snelstart && (() => {
        const m = snelStartMessage(sp.snelstart);
        return m ? (
          <p
            className={cn(
              "rounded-sm border px-3 py-2 text-[13px]",
              m.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {m.text}
          </p>
        ) : null;
      })()}
      {sp.verwijderd && (
        <p className="rounded-sm border border-ink-200 bg-ink-50 px-3 py-2 text-[13px] text-ink-600">
          De ontvangen factuur is verwijderd.
        </p>
      )}
      {sp.afgeboekt && (
        <p className="flex items-start gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {sp.afgeboekt === "0"
              ? "Niets afgeboekt — er was niets aangevinkt of de facturen stonden al op betaald."
              : `${sp.afgeboekt} factu${sp.afgeboekt === "1" ? "ur" : "ren"} op betaald gezet vanuit het bankafschrift.`}
            {sp.overgeslagen ? ` ${sp.overgeslagen} overgeslagen (al betaald, geannuleerd of met een afwijking).` : ""}
          </span>
        </p>
      )}
      {sp.fout === "geen-rechten" && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          Geen toegang: alleen een beheerder kan facturen afboeken.
        </p>
      )}
      {sp.fout === "upload" && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          Kies één of meer bonnetjes (afbeelding, PDF of een ZIP).
        </p>
      )}
      {sp.fout === "groot" && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          De bestanden zijn te groot (max. 15 MB per bestand).
        </p>
      )}
      {sp.fout === "bedrag" && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          Vul een bedrag groter dan € 0 in om een bon handmatig toe te voegen.
        </p>
      )}
      {!heeftEigenIban && (
        <p className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Er staat nog geen Q4S-IBAN bij{" "}
            <Link href="/facturatie/instellingen" className="font-semibold underline underline-offset-2">
              Instellingen &amp; regels
            </Link>
            . Die is nodig als tegenrekening voor het SEPA-bestand.
          </span>
        </p>
      )}

      {/* In één oogopslag: wat moet er wanneer betaald worden. */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <BetaalTegel label="Te laat" sub="vervaldatum voorbij" vak={planning.teLaat} toon="rood" />
        <BetaalTegel label="Binnen 7 dagen" sub="nu inplannen" vak={planning.dezeWeek} toon="oranje" />
        <BetaalTegel label="Later" sub="nog ruim de tijd" vak={planning.later} toon="grijs" />
        <BetaalTegel
          label="Betaald"
          sub={`${tellingen.betaald} factu${tellingen.betaald === 1 ? "ur" : "ren"}`}
          vak={{ aantal: tellingen.betaald, bedrag: betaaldBedrag }}
          toon="groen"
        />
      </div>

      <FilterTegels
        label="Filter op status"
        items={INKOOP_TABS.map((t) => {
          const aantal = t.key === "declaraties" ? declaraties.length : tellingen[t.key as keyof typeof tellingen];
          return {
            key: t.key,
            label: t.label,
            waarde: t.key === "declaraties" && !toonDeclaraties ? "—" : aantal,
            icon: INKOOP_ICOON[t.key],
            toon: INKOOP_TOON[t.key],
            rood: t.key === "afwijking" && tellingen.afwijking > 0,
            href: tabHref(t.key),
            actief: tab === t.key,
          };
        })}
      />

      {toonDeclaraties ? (
        <DeclaratiesTab
          declaraties={declaraties}
          personen={personen}
          openBedrag={declaratiesOpen}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 p-4">
            <TabelZoek
              basePath="/facturatie/inkoop"
              q={sp.q}
              placeholder="Zoek op freelancer of factuurnummer…"
              behoud={{ tab: tab === "controleren" ? undefined : tab, week: weekParam || undefined }}
            />
          </div>
          {rows.length === 0 ? (
            <EmptyState
              className="border-0"
              icon={<Receipt className="h-6 w-6" />}
              title={
                tellingen.alles === 0
                  ? "Nog geen ontvangen facturen"
                  : "Geen facturen in dit tabblad"
              }
              description={
                tellingen.alles === 0
                  ? "Zodra je in Week verwerken de factuur van een freelancer toevoegt, staat hij hier."
                  : "Kies een ander tabblad — of een andere week."
              }
              action={
                <Link href="/facturatie" className={buttonVariants({ variant: "outline" })}>
                  Naar Week verwerken
                </Link>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Freelancer</TH>
                  <TH>Factuur · periode</TH>
                  <TH>Betalen vóór / betaald</TH>
                  <TH className="text-right">Gefactureerd</TH>
                  <TH className="text-right">Verwacht</TH>
                  <TH>Controle</TH>
                  <TH>Uitbetalen?</TH>
                  <TH>Status</TH>
                  <TH>SnelStart</TH>
                  <TH className="text-right">Acties</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const v = vrijgave.get(r.id);
                  return (
                    <TR key={r.id}>
                      <TD>
                        <span className="flex items-center gap-3">
                          <PersoonVierkant naam={r.consultantName} />
                          <span className="min-w-0">
                            <Link
                              href={`/facturatie/inkoop/${r.id}`}
                              className="font-medium text-ink-900 hover:text-brand-600"
                            >
                              {r.consultantName}
                            </Link>
                            <span className="block truncate text-xs text-ink-400">
                              {r.issueDate ? `binnen ${formatDate(r.issueDate)}` : "geen factuurdatum"}
                            </span>
                          </span>
                        </span>
                      </TD>
                      <TD>
                        <span className="block text-[13px] text-ink-700">{r.number ?? "— zonder nummer"}</span>
                        <span className="block text-xs text-ink-400">
                          {r.periodStart && r.periodEnd
                            ? `${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}`
                            : "geen periode"}
                        </span>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {(() => {
                          if (r.status === "PAID") {
                            return (
                              <span className="text-[13px] font-medium text-emerald-700">
                                betaald {r.paidDate ? formatDate(r.paidDate) : ""}
                              </span>
                            );
                          }
                          const due = inkoopVervaldatum(r.issueDate, termijn);
                          const l = vervalLabel(due, false, now);
                          return (
                            <>
                              <span className={cn("text-[13px] font-medium", VERVAL_KLEUR[l.toon])}>{l.tekst}</span>
                              {due && <span className="block text-xs text-ink-400">{formatDate(due)}</span>}
                            </>
                          );
                        })()}
                      </TD>
                      <TD className="text-right tabular-nums text-ink-900">
                        {formatCurrency(r.amount)}
                      </TD>
                      <TD className="text-right">
                        {r.expected ? (
                          <>
                            <span className="tabular-nums text-ink-700">
                              {formatCurrency(r.expected.total)}
                            </span>
                            <span className="block text-xs text-ink-400">
                              {r.expected.weeks} wk · {formatHours(r.expected.hours)} u
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-ink-400">geen periode</span>
                        )}
                      </TD>
                      <TD>
                        {r.matched == null ? (
                          <span className="text-xs text-ink-400">nog niet vergeleken</span>
                        ) : r.matched ? (
                          <Badge color="green">Klopt</Badge>
                        ) : (
                          <Badge color="red">
                            {(r.diff ?? 0) > 0 ? "+" : ""}
                            {formatCurrency(r.diff ?? 0)}
                          </Badge>
                        )}
                      </TD>
                      <TD>
                        {v ? (
                          <>
                            <Badge color={VRIJGAVE_KLEUR[v.bucket]}>{v.label}</Badge>
                            <span className="mt-1 block max-w-[20rem] text-xs text-ink-400">
                              {v.toelichting}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                      </TD>
                      <TD>
                        <StatusBadge options={RECEIVED_INVOICE_STATUSES} value={r.status} />
                      </TD>
                      <TD>
                        {r.snelstartId ? (
                          <Badge color="green">Geboekt</Badge>
                        ) : r.status === "APPROVED" || r.status === "PAID" ? (
                          snelstartAan && isAdmin ? (
                            <form action={pushReceivedInvoiceToSnelStart}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="terug" value="lijst" />
                              <SubmitButton variant="outline" size="sm" pendingLabel="Boeken…">
                                <Send className="h-3.5 w-3.5" /> Boeken
                              </SubmitButton>
                            </form>
                          ) : (
                            <span className="text-xs text-ink-400">nog niet geboekt</span>
                          )
                        ) : (
                          <span className="text-xs text-ink-300">—</span>
                        )}
                      </TD>
                      <TD>
                        <div className="flex items-center justify-end gap-1">
                          {r.matched === false && r.status !== "PAID" && (
                            <DiscrepancyMailButton id={r.id} alreadyMailed={r.mailed} />
                          )}
                          {r.status !== "APPROVED" && r.status !== "PAID" && (
                            <form action={setReceivedStatus}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value="APPROVED" />
                              <SubmitButton variant="outline" size="sm" pendingLabel="…">
                                Goedkeuren
                              </SubmitButton>
                            </form>
                          )}
                          <ReceivedInvoicePreviewButton
                            id={r.id}
                            name={r.consultantName}
                            hasFile={r.hasFile}
                          />
                          {r.status !== "PAID" && (
                            <ConfirmSubmit
                              action={resetWeekVanuitFactuur}
                              id={r.id}
                              trigger="icon"
                              icon={<RotateCcw className="h-4 w-4" />}
                              message="Deze week verwijderen en resetten?"
                              description="Dit verwijdert deze factuur, de urenstaat van deze week én een eventuele concept-verkoopfactuur, en zet de weekstaat terug in Week verwerken. Verstuurde of betaalde verkoopfacturen blijven beschermd."
                              confirmLabel="Verwijderen & resetten"
                            >
                              Verwijderen &amp; resetten
                            </ConfirmSubmit>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      {/* Bankafschrift — alleen een beheerder mag geld afboeken. De server-actions
          weigeren het ook, dit verbergt alleen het blok. */}
      {!toonDeclaraties && isAdmin && <BankImport />}

      {!toonDeclaraties && (
        <div className="flex items-start gap-2 rounded-sm border border-ink-200 bg-ink-50 px-4 py-3 text-[13px] text-ink-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <p>
            <strong className="font-semibold text-ink-700">Zo loopt het geld eruit.</strong> Keur een
            factuur goed zodra hij klopt → hij valt onder <em>Te betalen</em> → download het{" "}
            <strong>SEPA-bestand</strong> en keur de batch in je bank zelf goed → lees daarna het{" "}
            <strong>bankafschrift</strong> in en vink aan wat echt betaald is. De app zet nooit zelf
            geld weg. De kolom <em>Uitbetalen?</em> waarschuwt wanneer de klant de bijbehorende
            verkoopfactuur nog niet betaald heeft.
          </p>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Declaraties-tabblad
// ===========================================================================

type DeclaratieRij = {
  id: string;
  date: Date | null;
  vendor: string | null;
  originalName: string | null;
  category: string;
  amount: number;
  status: string;
  consultant: { firstName: string; lastName: string } | null;
};

function DeclaratiesTab({
  declaraties,
  personen,
  openBedrag,
}: {
  declaraties: DeclaratieRij[];
  personen: { id: string; firstName: string; lastName: string }[];
  openBedrag: number;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-ink-400" /> Bonnetjes toevoegen
          </CardTitle>
          <span className="text-xs text-ink-400">
            {declaraties.length} bon{declaraties.length === 1 ? "" : "nen"} ·{" "}
            {formatCurrency(openBedrag)} openstaand
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={uploadExpenses} className="space-y-3">
            <Dropzone
              name="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.zip,application/pdf,image/*,application/zip,application/x-zip-compressed"
              multiple
              label="Sleep de bonnetjes hierheen of klik om te kiezen"
              hint="Foto, scan, PDF of ZIP · meerdere tegelijk mag"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-500">
                Elk bonnetje wordt automatisch uitgelezen (datum, leverancier, bedrag, btw). Je kijkt
                het daarna zelf na — er wordt niets uitbetaald.
              </p>
              <SubmitButton pendingLabel="Uploaden…">
                <Upload className="h-4 w-4" /> Upload &amp; uitlezen
              </SubmitButton>
            </div>
          </form>

          <details className="rounded-sm border border-ink-200 bg-ink-50/60">
            <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-ink-700 hover:text-ink-900">
              + Bon handmatig invoeren (zonder foto)
            </summary>
            <form action={createManualExpense} className="space-y-4 border-t border-ink-200 p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="m-date" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                    Datum
                  </label>
                  <Input id="m-date" name="date" type="date" />
                </div>
                <div>
                  <label htmlFor="m-vendor" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                    Leverancier
                  </label>
                  <Input id="m-vendor" name="vendor" placeholder="Bijv. Shell, Gamma…" />
                </div>
                <div>
                  <label htmlFor="m-category" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                    Categorie
                  </label>
                  <Select id="m-category" name="category" defaultValue="OVERIG">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label htmlFor="m-consultant" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                    Persoon
                  </label>
                  <Select id="m-consultant" name="consultantId" defaultValue="">
                    <option value="">— niet toegewezen —</option>
                    {personen.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="m-amount" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                    Bedrag (incl. btw) <span className="text-red-500">*</span>
                  </label>
                  <Input id="m-amount" name="amount" type="number" step="0.01" placeholder="0,00" required />
                </div>
                <div>
                  <label htmlFor="m-vatRate" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                    Btw-tarief
                  </label>
                  <Select id="m-vatRate" name="vatRate" defaultValue="21">
                    <option value="">— onbekend —</option>
                    <option value="21">21%</option>
                    <option value="9">9%</option>
                    <option value="0">0% / geen</option>
                  </Select>
                </div>
                <div>
                  <label htmlFor="m-vatAmount" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                    Waarvan btw
                  </label>
                  <Input id="m-vatAmount" name="vatAmount" type="number" step="0.01" placeholder="uit tarief" />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-700">
                <input
                  type="checkbox"
                  name="vatDeductible"
                  defaultChecked
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
                />
                Btw aftrekbaar (uit bij eten/horeca)
              </label>
              <div className="flex justify-end">
                <SubmitButton pendingLabel="Toevoegen…">
                  <Receipt className="h-4 w-4" /> Bon toevoegen
                </SubmitButton>
              </div>
            </form>
          </details>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {declaraties.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={<Receipt className="h-6 w-6" />}
            title="Nog geen declaraties"
            description="Upload hierboven het eerste bonnetje, of blader naar een andere week."
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Datum</TH>
                <TH>Persoon</TH>
                <TH>Leverancier</TH>
                <TH>Categorie</TH>
                <TH className="text-right">Bedrag</TH>
                <TH>Status</TH>
                <TH className="text-right">Acties</TH>
              </TR>
            </THead>
            <TBody>
              {declaraties.map((e) => (
                <TR key={e.id}>
                  <TD className="whitespace-nowrap">
                    {e.date ? formatDate(e.date) : <span className="text-ink-300">—</span>}
                  </TD>
                  <TD>
                    {e.consultant ? (
                      <span className="flex items-center gap-2.5">
                        <PersoonVierkant naam={`${e.consultant.firstName} ${e.consultant.lastName}`} />
                        <span>
                          {e.consultant.firstName} {e.consultant.lastName}
                        </span>
                      </span>
                    ) : (
                      <span className="text-ink-300">niet toegewezen</span>
                    )}
                  </TD>
                  <TD className="text-ink-700">{e.vendor ?? e.originalName ?? "—"}</TD>
                  <TD>
                    <StatusBadge options={EXPENSE_CATEGORIES} value={e.category} />
                  </TD>
                  <TD className="text-right font-medium tabular-nums text-ink-900">
                    {e.amount > 0 ? formatCurrency(e.amount) : "—"}
                  </TD>
                  <TD>
                    <ExpenseStatusSelect id={e.id} value={e.status} />
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/facturatie/inkoop/declaraties/${e.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Controleren
                      </Link>
                      <ConfirmSubmit
                        action={deleteExpense}
                        id={e.id}
                        trigger="icon"
                        message="Deze declaratie verwijderen?"
                        description="De bon verdwijnt uit de administratie. Dit kun je niet terugdraaien."
                      >
                        Verwijderen
                      </ConfirmSubmit>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <p className="text-xs text-ink-400">
        Een declaratie wordt nooit automatisch uitbetaald: zet hem zelf op{" "}
        <strong className="font-semibold text-ink-600">
          {EXPENSE_STATUSES.find((s) => s.value === "PAID")?.label ?? "Betaald"}
        </strong>{" "}
        zodra het geld eruit is.
      </p>
    </div>
  );
}

const BETAAL_TOON = {
  rood: { rand: "border-red-200", tekst: "text-red-700" },
  oranje: { rand: "border-amber-200", tekst: "text-amber-700" },
  grijs: { rand: "border-ink-200", tekst: "text-ink-900" },
  groen: { rand: "border-emerald-200", tekst: "text-emerald-700" },
};

function BetaalTegel({
  label,
  sub,
  vak,
  toon,
}: {
  label: string;
  sub: string;
  vak: BetaalPlanning["teLaat"];
  toon: keyof typeof BETAAL_TOON;
}) {
  const t = BETAAL_TOON[toon];
  const leeg = vak.aantal === 0;
  return (
    <div className={cn("rounded-lg border bg-white px-3 py-2", leeg ? "border-ink-200" : t.rand)}>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</span>
      <span className={cn("block text-lg font-semibold tabular-nums", leeg ? "text-ink-300" : t.tekst)}>
        {formatCurrency(vak.bedrag)}
      </span>
      <span className="block text-xs text-ink-400">
        {vak.aantal} factu{vak.aantal === 1 ? "ur" : "ren"} · {sub}
      </span>
    </div>
  );
}
