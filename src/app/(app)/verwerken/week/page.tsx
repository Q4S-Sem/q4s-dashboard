import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Coins,
  CopyCheck,
  Mail,
  Mailbox,
  PauseCircle,
  PencilLine,
  Repeat2,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Field, Textarea } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { db } from "@/lib/db";
import { cn, formatCurrency, formatHours, formatWeekLabel, startOfISOWeek } from "@/lib/utils";
import { timesheetGateReview, type GateReviewRow } from "@/lib/timesheet-gate-review";
import type { GateFlag } from "@/lib/timesheet-auto-gate";
import {
  detectDuplicates,
  evaluateMargin,
  summarizeRecurringFaults,
  type DetectieFlag,
  type PastFault,
  type PriorInvoiceRef,
} from "@/lib/facturatie-detecties";
import { focusWeekVan, ontbrekendeWeekstaten } from "@/lib/herinnering";
import { controleLabel, initialen, namenLijst, telWeekBedragen } from "@/lib/weekverwerking";
import { ApproveInboxButton } from "../controle/ApproveInboxButton";
import { approveAllAutoApproved, naarWachtkamer, processAllAutoApproved } from "../controle/actions";
import { herinnerOntbrekende } from "./actions";

// ---------------------------------------------------------------------------
// Weekverwerking — de wekelijkse cockpit voor HR.
//
// Eén scherm dat de week samenvat: wie leverde nog niets in (#3), wat wijkt af en
// waarom (auto-gate + margebewaking #2, terugkerende fout #1, dubbele factuur #8),
// en wat er al automatisch is afgehandeld.
//
// ALLEEN LEZEN. Alles wat hier gebeurt is ophalen, doorgeven aan de bestaande
// PURE functies en tonen. De enige knoppen die iets veranderen zijn de al
// bestaande server-actions van de urencontrole (../controle/actions.ts) en de
// bestaande goedkeurknop per weekstaat. Er wordt niets verstuurd of betaald, en
// er wordt hier geen enkel bedrag zelf uitgerekend — dat blijft in toeslag.ts /
// invoicing.ts.
// ---------------------------------------------------------------------------

export const metadata = { title: "Weekverwerking" };
export const dynamic = "force-dynamic";

const CONF_LABEL: Record<string, string> = { high: "hoog", medium: "gemiddeld", low: "laag" };

/** Kort regeltje onder de naam: plaatsing · klant (of duidelijk: nog niet gekoppeld). */
function rolRegel(row: GateReviewRow): string {
  return [row.placementTitle, row.clientName].filter(Boolean).join(" · ") || "— nog niet gekoppeld aan een klant";
}

/**
 * De standaardreden waarmee een week de wachtkamer in gaat: precies de melding
 * die de badge boven de week ook koos (harde fout wint van een waarschuwing), en
 * anders het korte fouttype. Zo staat er in de wachtkamer nooit "geparkeerd"
 * zonder te vertellen waarom.
 */
function wachtkamerReden(row: GateReviewRow, kop: ReturnType<typeof controleLabel>): string {
  const vlag = row.flags.find((f) => f.level === "error") ?? row.flags[0];
  return vlag?.message ?? kop?.label ?? "wacht op een gecorrigeerde weekstaat";
}

/** De bewaarde AI-controlevlaggen (JSON) veilig inlezen. */
function parseFlags(reviewFlags: string | null): GateFlag[] {
  if (!reviewFlags) return [];
  try {
    const parsed = JSON.parse(reviewFlags);
    return Array.isArray(parsed) ? (parsed as GateFlag[]) : [];
  } catch {
    return [];
  }
}

/** Vlaggen als opsomming; rood bij een harde fout, amber bij een waarschuwing. */
function FlagList({ flags }: { flags: DetectieFlag[] }) {
  return (
    <ul className="mt-1.5 space-y-1 text-sm">
      {flags.map((flag, i) => (
        <li
          key={i}
          className={cn(
            "flex items-start gap-1.5",
            flag.level === "error" ? "text-red-700" : "text-amber-800",
          )}
        >
          <span aria-hidden>•</span>
          <span>{flag.message}</span>
        </li>
      ))}
    </ul>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}

export default async function WeekverwerkingPage({
  searchParams,
}: {
  searchParams: Promise<{
    verstuurd?: string;
    klaargezet?: string;
    overgeslagen?: string;
    mislukt?: string;
  }>;
}) {
  const sp = await searchParams;
  const review = await timesheetGateReview();
  const { needsReview, autoApprove, wachtkamer, totals, notExtracted } = review;

  // De week waar dit scherm over gaat: de nieuwste week die nog openstaat, en
  // anders gewoon de lopende week. Zo klopt de "ontbreekt nog"-strip ook in een
  // demo-database waarin de laatste weekstaten van vorige maand zijn. De
  // herinnerknop rekent met exact dezelfde functie, zodat hij nooit een andere
  // week (of een ander lijstje) te pakken heeft dan wat hier staat.
  const focusWeek = focusWeekVan(review, new Date());

  const consultantIds = [
    ...new Set(needsReview.map((r) => r.consultantId).filter((id): id is string => !!id)),
  ];

  const [ontbrekend, eerdereItems, ontvangen, concepten] = await Promise.all([
    // #3 Wie moet er nog inleveren? Zelfde data-laag als de herinnerknop.
    ontbrekendeWeekstaten(focusWeek),
    // Voor #1: de bewaarde controlevlaggen van eerdere weekstaten van dezelfde mensen.
    consultantIds.length > 0
      ? db.timesheetInbox.findMany({
          where: { consultantId: { in: consultantIds }, reviewFlags: { not: null } },
          select: {
            id: true,
            consultantId: true,
            reviewFlags: true,
            extractedWeekStart: true,
          },
        })
      : Promise.resolve([]),
    // Voor #8: de facturen die deze mensen zelf stuurden.
    consultantIds.length > 0
      ? db.receivedInvoice.findMany({
          where: { consultantId: { in: consultantIds } },
          select: {
            id: true,
            consultantId: true,
            number: true,
            amount: true,
            periodStart: true,
          },
          orderBy: [{ createdAt: "asc" }],
        })
      : Promise.resolve([]),
    db.invoice.count({ where: { status: "DRAFT" } }),
  ]);

  // --- #3 Wie moet er nog inleveren? --------------------------------------
  const { ontbreekt } = ontbrekend;

  // Uitkomst van een eerdere herinnerronde (komt terug via de redirect).
  const herinnerd = sp.verstuurd !== undefined || sp.klaargezet !== undefined;
  const nVerstuurd = Number(sp.verstuurd ?? 0) || 0;
  const nKlaargezet = Number(sp.klaargezet ?? 0) || 0;
  const nOvergeslagen = Number(sp.overgeslagen ?? 0) || 0;
  const nMislukt = Number(sp.mislukt ?? 0) || 0;

  // --- Kopcijfers ----------------------------------------------------------
  const week = telWeekBedragen([totals.needsReview, totals.autoApprove]);

  // Wat er nú in één klik door kan: alleen groene staten die compleet genoeg zijn.
  const batch = autoApprove.filter((r) => r.canApprove);
  const batchBedragen = telWeekBedragen(
    batch.map((r) => ({ hours: r.totalHours ?? 0, charge: r.charge, cost: r.cost, margin: r.margin })),
  );

  // --- Per te controleren week de drie extra detecties ---------------------
  const weekOf = (d: Date | null) => (d ? startOfISOWeek(d) : null);

  const controleRijen = needsReview.map((row) => {
    const kop = controleLabel(row.flags);

    // #2 Margebewaking. Zonder uren/bedrag op de factuur valt evaluateMargin terug
    // op het afgesproken inkooptarief en zegt dat er zelf bij — er wordt hier dus
    // niets aan de factuur gerekend wat er niet staat.
    const marge = evaluateMargin({
      hoursOnInvoice: null,
      invoiceAmount: null,
      costRate: row.costRate,
      chargeRate: row.chargeRate,
      expectedMarginPerHour: null,
    });

    // #1 Terugkerende fout — geteld over de BEWAARDE vlaggen van eerdere weken.
    const huidigType = controleLabel(row.aiFlags)?.label ?? "";
    const eerder: PastFault[] = eerdereItems
      .filter(
        (i) =>
          i.consultantId === row.consultantId &&
          i.id !== row.id &&
          !!i.extractedWeekStart &&
          !!row.weekStart &&
          i.extractedWeekStart.getTime() < row.weekStart.getTime(),
      )
      .flatMap((i) => {
        const type = controleLabel(parseFlags(i.reviewFlags))?.label;
        return type ? [{ type }] : [];
      });
    const herhaling = summarizeRecurringFaults(eerder, huidigType);

    // #8 Dubbele factuur — de factuur die deze week beslaat, tegen alle eerdere.
    const vanPersoon = ontvangen.filter((inv) => inv.consultantId === row.consultantId);
    const huidigeFactuur = row.weekStart
      ? (vanPersoon.find((inv) => weekOf(inv.periodStart)?.getTime() === row.weekStart!.getTime()) ??
        null)
      : null;
    const eerdereFacturen: PriorInvoiceRef[] = huidigeFactuur
      ? vanPersoon
          .filter((inv) => inv.id !== huidigeFactuur.id)
          .map((inv) => ({
            number: inv.number,
            amount: inv.amount,
            weekStart: weekOf(inv.periodStart),
          }))
      : [];
    const dubbel = huidigeFactuur
      ? detectDuplicates({
          invoiceNumber: huidigeFactuur.number,
          invoiceAmount: huidigeFactuur.amount,
          weekStart: row.weekStart,
          priorInvoices: eerdereFacturen,
        })
      : { flags: [] as DetectieFlag[] };

    return { row, kop, marge, herhaling, dubbel, factuurNummer: huidigeFactuur?.number ?? null };
  });

  return (
    <div className="space-y-6">
      <BackLink href="/verwerken">Terug naar facturatie</BackLink>

      <PageHeader
        eyebrow="Facturatie"
        title="Weekverwerking"
        description={`${formatWeekLabel(focusWeek)} — controleer de afwijkingen, de rest is al automatisch afgehandeld.`}
        actions={
          <>
            <Link href="/verwerken/wachtkamer" className={buttonVariants({ variant: "outline" })}>
              <PauseCircle className="h-4 w-4" /> Wachtkamer
              {wachtkamer.length > 0 && ` (${wachtkamer.length})`}
            </Link>
            <Link href="/verzenden" className={buttonVariants({ variant: "outline" })}>
              <Send className="h-4 w-4" /> Verzendmap
            </Link>
          </>
        }
      />

      {notExtracted > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {notExtracted} binnengekomen bestand{notExtracted === 1 ? "" : "en"} moet nog uitgelezen
            worden — die staan pas op deze lijst zodra de AI ze heeft gelezen. Dat doe je in de{" "}
            <Link href="/inbox" className="font-medium underline">
              inbox
            </Link>
            .
          </span>
        </p>
      )}

      {/* --- 1) De vier cijfers van de week --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Freelancers deze week"
          value={ontbreekt.total}
          sub={`${ontbreekt.submitted} van ${ontbreekt.total} leverde uren in`}
          icon={<Users className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Automatisch afgehandeld"
          value={autoApprove.length}
          sub={`${formatHours(totals.autoApprove.hours)} u schoon uitgelezen`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Te controleren"
          value={needsReview.length}
          sub={
            needsReview.length > 0
              ? `${formatHours(totals.needsReview.hours)} u wacht op een mens`
              : "niets blijft hangen"
          }
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={needsReview.length > 0 ? "amber" : "green"}
        />
        <StatCard
          label="Verkoop deze week"
          value={formatCurrency(week.charge)}
          sub={`marge ${formatCurrency(week.margin)} · inkoop ${formatCurrency(week.cost)}`}
          icon={<Coins className="h-5 w-5" />}
          accent="slate"
        />
      </div>

      {/* --- 2) Ontbreekt nog (#3) --- */}
      <Card
        className={cn(
          "border-l-[3px]",
          ontbreekt.missing.length > 0 ? "border-l-brand-600" : "border-l-emerald-500",
        )}
      >
        <CardContent className="flex flex-wrap items-center gap-3 py-3.5">
          <Mailbox
            className={cn(
              "h-4 w-4 shrink-0",
              ontbreekt.missing.length > 0 ? "text-brand-600" : "text-emerald-600",
            )}
          />
          {ontbreekt.missing.length > 0 ? (
            <p className="min-w-0 flex-1 text-sm text-ink-600">
              <strong className="text-ink-900">
                {ontbreekt.missing.length} van {ontbreekt.total} nog niet binnen
              </strong>{" "}
              — {namenLijst(ontbreekt.missing.map((m) => m.consultantName))}{" "}
              {ontbreekt.missing.length === 1 ? "heeft" : "hebben"} voor{" "}
              {formatWeekLabel(focusWeek).toLowerCase()} nog geen uren gestuurd.
            </p>
          ) : (
            <p className="min-w-0 flex-1 text-sm text-ink-600">
              <strong className="text-ink-900">Alles binnen</strong> — alle {ontbreekt.total}{" "}
              medewerkers met een actieve plaatsing leverden uren in voor{" "}
              {formatWeekLabel(focusWeek).toLowerCase()}.
            </p>
          )}
          <Link
            href="/inbox/status"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Timesheet-status
          </Link>
          {ontbreekt.missing.length > 0 && (
            <ConfirmSubmit
              action={herinnerOntbrekende}
              variant="outline"
              size="sm"
              trigger="button"
              message={`Herinner alle ${ontbreekt.missing.length} ${
                ontbreekt.missing.length === 1 ? "freelancer" : "freelancers"
              }?`}
              description="Iedereen die voor deze week nog geen timesheet instuurde krijgt een eigen, vriendelijke herinnering om zijn timesheet én factuur te sturen. Wie geen e-mailadres heeft wordt overgeslagen. Er wordt niets goedgekeurd, gefactureerd of betaald — en je mag dit gerust nog eens doen."
              confirmLabel="Herinnering sturen"
              confirmVariant="success"
            >
              <BellRing className="h-4 w-4" /> Herinner alle {ontbreekt.missing.length}
            </ConfirmSubmit>
          )}
        </CardContent>
      </Card>

      {herinnerd && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-md px-4 py-3 text-sm",
            nMislukt > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800",
          )}
        >
          <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {nVerstuurd > 0 && (
              <>
                <strong>{nVerstuurd}</strong> herinnering{nVerstuurd === 1 ? "" : "en"} verstuurd
              </>
            )}
            {nVerstuurd > 0 && nKlaargezet > 0 && " · "}
            {nKlaargezet > 0 && (
              <>
                <strong>{nKlaargezet}</strong> herinnering{nKlaargezet === 1 ? "" : "en"} klaargezet
                (klaarzet-modus — geen SMTP ingesteld, dus nog niet echt verzonden)
              </>
            )}
            {nVerstuurd === 0 && nKlaargezet === 0 && "Er is niemand gemaild"}
            {nOvergeslagen > 0 && (
              <> · {nOvergeslagen} overgeslagen zonder e-mailadres bij de medewerker</>
            )}
            {nMislukt > 0 && (
              <>
                {" "}
                · <strong>{nMislukt}</strong> niet gelukt — controleer de SMTP-instellingen
              </>
            )}
            . Er is alleen herinnerd: niets goedgekeurd, gefactureerd of betaald.
          </span>
        </p>
      )}

      {/* --- 3) Te controleren --- */}
      <section className="space-y-3">
        <h2 className="flex items-baseline gap-2 text-[15px] font-semibold text-ink-900">
          <AlertTriangle className="h-4 w-4 shrink-0 translate-y-0.5 text-amber-600" /> Te
          controleren
          <span className="text-sm font-normal text-ink-500">
            {needsReview.length > 0 ? `— alleen deze wijken af (${needsReview.length})` : ""}
          </span>
        </h2>

        {controleRijen.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Niets om na te kijken"
            description="Alle uitgelezen weekstaten kwamen schoon door de controles. Ze staan hieronder samengevat."
          />
        ) : (
          controleRijen.map(({ row, kop, marge, herhaling, dubbel, factuurNummer }) => {
            const hardeFout = row.flags.some((f) => f.level === "error");
            return (
              <Card
                key={row.id}
                className={cn(
                  "overflow-hidden border-l-[3px]",
                  hardeFout ? "border-l-red-500" : "border-l-amber-500",
                )}
              >
                <details open>
                  <summary className="grid cursor-pointer list-none grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 hover:bg-ink-50/60 sm:grid-cols-[40px_minmax(0,1fr)_88px_112px_170px]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-[13px] font-bold text-ink-500">
                      {initialen(row.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink-900">
                        {row.name}
                      </span>
                      <span className="block truncate text-xs text-ink-400">{rolRegel(row)}</span>
                      {herhaling.label && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-sm bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-inset ring-red-200">
                          <Repeat2 className="h-3 w-3" /> {herhaling.label}
                        </span>
                      )}
                    </span>
                    <span className="hidden text-right sm:block">
                      <span className="block text-sm font-bold tabular-nums text-ink-900">
                        {row.totalHours != null ? `${formatHours(row.totalHours)} u` : "—"}
                      </span>
                      <span className="block text-[11px] text-ink-400">weekstaat</span>
                    </span>
                    <span className="hidden text-right sm:block">
                      <span className="block text-sm font-bold tabular-nums text-ink-900">
                        {row.placementId ? formatCurrency(row.charge) : "—"}
                      </span>
                      <span className="block text-[11px] text-ink-400">
                        {row.placementId ? "verkoop" : "geen tarief"}
                      </span>
                    </span>
                    <span className="flex justify-end">
                      {kop && (
                        <Badge color={kop.level === "error" ? "red" : "amber"}>{kop.label}</Badge>
                      )}
                    </span>
                  </summary>

                  <CardContent className="space-y-3 border-t border-ink-100 bg-ink-50/40">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <DetailItem label="Week">{row.weekLabel ?? "—"}</DetailItem>
                      <DetailItem label="Eigen gemiddelde">
                        {row.recentAvgHours != null ? `${formatHours(row.recentAvgHours)} u` : "geen historie"}
                        {row.recentWeeks > 0 && (
                          <span className="ml-1 text-xs text-ink-400">
                            (laatste {row.recentWeeks} {row.recentWeeks === 1 ? "week" : "weken"})
                          </span>
                        )}
                      </DetailItem>
                      <DetailItem label="Tarieven (verkoop / inkoop)">
                        {row.chargeRate != null && row.costRate != null
                          ? `${formatCurrency(row.chargeRate)} / ${formatCurrency(row.costRate)} p/u`
                          : "onbekend"}
                      </DetailItem>
                      <DetailItem label="Marge (week)">
                        {row.placementId ? formatCurrency(row.margin) : "—"}
                      </DetailItem>
                    </dl>

                    {/* Waarom deze week niet automatisch doorgaat (auto-gate). */}
                    <div
                      className={cn(
                        "rounded-md border p-3",
                        hardeFout ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50",
                      )}
                    >
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          hardeFout ? "text-red-800" : "text-amber-900",
                        )}
                      >
                        Waarom dit niet automatisch doorgaat
                      </p>
                      <FlagList flags={row.flags} />
                    </div>

                    {/* #2 Margebewaking — wat houden we hier per uur aan over? */}
                    <div
                      className={cn(
                        "flex items-start gap-2 rounded-md border p-3 text-sm",
                        marge.belowNorm
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-ink-200 bg-white text-ink-600",
                      )}
                    >
                      <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <strong>Marge per uur.</strong>{" "}
                        {marge.marginPerHour != null ? (
                          <>
                            <span className="tabular-nums">
                              {formatCurrency(marge.marginPerHour)}
                            </span>{" "}
                            per gewerkt uur op deze plaatsing
                            {marge.reason ? ` — ${marge.reason}` : "."}
                          </>
                        ) : (
                          (marge.reason ?? "niet te bepalen.")
                        )}
                      </span>
                    </div>

                    {/* #8 Dubbele factuur van de medewerker zelf. */}
                    {dubbel.flags.length > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                          <CopyCheck className="h-4 w-4" /> Mogelijk dubbele factuur
                          {factuurNummer && (
                            <span className="font-normal text-amber-700">({factuurNummer})</span>
                          )}
                        </p>
                        <FlagList flags={dubbel.flags} />
                      </div>
                    )}

                    {/* Wat de AI zelf al opviel bij het uitlezen. */}
                    {row.aiFlags.length > 0 && (
                      <div className="rounded-md border border-ink-200 bg-white p-3">
                        <p className="text-sm font-semibold text-ink-700">
                          Opmerkingen bij het uitlezen
                        </p>
                        <ul className="mt-1.5 space-y-1 text-sm text-ink-600">
                          {row.aiFlags.map((flag, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span aria-hidden>•</span>
                              <span>{flag.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Eigen bevinding + mail. Bewust een GET-formulier: de knop
                        brengt je naar de controlestap met het volledige
                        mailvoorbeeld — er gaat hier nog niets weg. */}
                    <form
                      method="get"
                      action={`/verwerken/week/${row.id}/mail`}
                      className="rounded-md border border-ink-200 bg-white p-3"
                    >
                      <Field
                        label="Eigen bevinding"
                        hint="Wat wil je de freelancer er zelf bij zeggen? Dit komt als citaat in de mail. Je ziet de hele mail eerst in een voorbeeld."
                      >
                        <Textarea
                          name="notitie"
                          rows={3}
                          maxLength={2000}
                          placeholder="Bijv.: je hebt zaterdag 8 uur geschreven, maar er stond geen weekenddienst gepland."
                        />
                      </Field>
                      <div className="mt-2 flex justify-end">
                        <SubmitButton
                          variant="outline"
                          size="sm"
                          pendingLabel="Openen…"
                          title="Stel de mail aan de freelancer op — je ziet 'm eerst in een voorbeeld."
                        >
                          <Mail className="h-4 w-4" /> Mail freelancer
                        </SubmitButton>
                      </div>
                    </form>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {row.confidence && (
                        <Badge
                          color={
                            row.confidence === "high"
                              ? "green"
                              : row.confidence === "low"
                                ? "red"
                                : "amber"
                          }
                        >
                          zekerheid {CONF_LABEL[row.confidence] ?? row.confidence}
                        </Badge>
                      )}
                      <span className="flex-1" />
                      <Link
                        href={`/inbox/${row.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <PencilLine className="h-4 w-4" /> Bekijk &amp; corrigeer
                      </Link>
                      {/* Parkeren tot de medewerker een gecorrigeerde staat stuurt.
                          De controlereden gaat als standaardreden mee. */}
                      <form action={naarWachtkamer} className="contents">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="reason" value={wachtkamerReden(row, kop)} />
                        <SubmitButton
                          variant="outline"
                          size="sm"
                          pendingLabel="Parkeren…"
                          title="Parkeer deze week tot de medewerker een gecorrigeerde staat of factuur stuurt."
                        >
                          <PauseCircle className="h-4 w-4" /> Naar wachtkamer
                        </SubmitButton>
                      </form>
                      {row.canApprove ? (
                        <ApproveInboxButton row={row} confirmFirst />
                      ) : (
                        <span className="text-xs text-ink-400">
                          Eerst corrigeren — plaatsing, week of dag-uren ontbreken.
                        </span>
                      )}
                    </div>
                  </CardContent>
                </details>
              </Card>
            );
          })
        )}
      </section>

      {/* --- 4) Automatisch afgehandeld — ingeklapt, met de twee bestaande acties --- */}
      <Card className="overflow-hidden border-emerald-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[15px] font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {autoApprove.length} freelancer{autoApprove.length === 1 ? "" : "s"} — automatisch
              afgehandeld
            </p>
            <p className="mt-1 max-w-2xl text-sm text-ink-600">
              Weekstaat én tarieven klopten, dus deze weken kunnen in één keer door:{" "}
              <span className="tabular-nums">{formatHours(batchBedragen.hours)} u</span> ·{" "}
              <span className="tabular-nums">{formatCurrency(batchBedragen.charge)}</span> te
              factureren. Kies of je alleen goedkeurt, of meteen doorzet naar de{" "}
              <strong>verkoopfactuur als concept</strong>. De inkoop is de factuur die de
              ZZP&apos;er zelf stuurt — die controleer je bij{" "}
              <Link href="/ontvangen-facturen" className="font-medium text-brand-700 hover:underline">
                Ontvangen facturen
              </Link>
              .
            </p>
          </div>
          {batch.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmSubmit
                action={approveAllAutoApproved}
                variant="outline"
                trigger="button"
                message={`Alle ${batch.length} groene weeksta${batch.length === 1 ? "at" : "ten"} goedkeuren?`}
                description="Er worden urenstaten aangemaakt voor alles wat de controles schoon doorkwam. Wat nagekeken moet worden blijft staan. Er gaat niets de deur uit en er wordt geen factuur gemaakt. De uitkomst zie je op de urencontrole."
                confirmLabel="Alles goedkeuren"
                confirmVariant="success"
              >
                <CheckCircle2 className="h-4 w-4" /> Alleen goedkeuren ({batch.length})
              </ConfirmSubmit>
              <ConfirmSubmit
                action={processAllAutoApproved}
                variant="success"
                trigger="button"
                message={`Alle ${batch.length} groene weeksta${batch.length === 1 ? "at" : "ten"} verwerken tot een conceptfactuur?`}
                description="Uren geaccepteerd + verkoopfactuur als concept (per klant). De inkoop is de factuur die de ZZP'er zelf stuurt (Ontvangen facturen) — die controleer/match je daar; er wordt hier géén inkoopfactuur gemaakt. De verkoopfactuur blijft CONCEPT: er gaat niets de deur uit en er wordt niets betaald. Versturen doe je zelf bij Verzenden. De uitkomst zie je op de urencontrole."
                confirmLabel="Verwerken tot concept"
                confirmVariant="success"
              >
                <Sparkles className="h-4 w-4" /> Verwerk alles groen → verkoopfactuur concept
              </ConfirmSubmit>
            </div>
          )}
        </div>

        <details>
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50/40">
            <span>Toon de {autoApprove.length} afgehandelde weken</span>
            <span className="font-normal text-ink-500 tabular-nums">
              {formatHours(totals.autoApprove.hours)} u · {formatCurrency(totals.autoApprove.charge)}{" "}
              te factureren
            </span>
          </summary>

          {autoApprove.length === 0 ? (
            <CardContent className="border-t border-ink-100">
              <p className="py-3 text-center text-sm text-ink-400">
                Geen weekstaten die vanzelf door mogen.
              </p>
            </CardContent>
          ) : (
            <div className="border-t border-ink-100">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Medewerker</TH>
                    <TH>Week</TH>
                    <TH>Klant</TH>
                    <TH className="text-right">Uren</TH>
                    <TH className="text-right">Te factureren</TH>
                    <TH className="text-right">Marge</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {autoApprove.map((row) => (
                    <TR key={row.id}>
                      <TD>
                        <Link
                          href={`/inbox/${row.id}`}
                          className="font-medium text-ink-900 hover:text-brand-700"
                        >
                          {row.name}
                        </Link>
                      </TD>
                      <TD className="text-ink-500">{row.weekLabel ?? "—"}</TD>
                      <TD className="text-ink-500">{row.clientName ?? "— geen bedrijf"}</TD>
                      <TD className="text-right tabular-nums">
                        {row.totalHours != null ? formatHours(row.totalHours) : "—"}
                      </TD>
                      <TD className="text-right tabular-nums">{formatCurrency(row.charge)}</TD>
                      <TD className="text-right tabular-nums">{formatCurrency(row.margin)}</TD>
                      <TD className="text-right">
                        {row.canApprove ? (
                          <div className="flex justify-end">
                            <ApproveInboxButton row={row} />
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </details>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
        <Link href="/verzenden" className={buttonVariants()}>
          <Send className="h-4 w-4" /> Ga naar verzendmap
          {concepten > 0 && ` (${concepten} concept${concepten === 1 ? "" : "en"})`}
        </Link>
        <p className="flex items-start gap-2 rounded-md bg-ink-50 px-4 py-3 text-xs leading-relaxed text-ink-600 sm:max-w-xl">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <span>
            <strong>Alleen groene weken lopen automatisch door</strong> — uren goedgekeurd en de
            verkoopfactuur als concept. Er wordt <strong>geen inkoopfactuur gemaakt</strong>: de
            inkoop is de factuur die de ZZP&apos;er zelf stuurt, die controleer je bij Ontvangen
            facturen. Er wordt <strong>niets automatisch verzonden</strong> en{" "}
            <strong>niets betaald</strong>: dat doe je zelf bij Verzenden en Betalingen.
          </span>
        </p>
      </div>
    </div>
  );
}
