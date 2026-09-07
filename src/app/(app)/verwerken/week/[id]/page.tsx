import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Clock3,
  Coins,
  CopyCheck,
  Mail,
  PauseCircle,
  PencilLine,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Field, Textarea } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { db } from "@/lib/db";
import { cn, formatCurrency, formatDate, formatHours } from "@/lib/utils";
import { timesheetGateReview, type GateReviewRow } from "@/lib/timesheet-gate-review";
import { weekControleDetails } from "@/lib/week-controle";
import { magScanVerwijderen } from "@/lib/week-detail";
import { controleLabel, initialen } from "@/lib/weekverwerking";
import type { DetectieFlag } from "@/lib/facturatie-detecties";
import { DocumentViewer } from "../../nieuw/DocumentViewer";
import { ApproveInboxButton } from "../../controle/ApproveInboxButton";
import { naarWachtkamer } from "../../controle/actions";
import { verwijderScan } from "../actions";

// ---------------------------------------------------------------------------
// Eén week van één persoon nakijken — de detailpagina achter een regel van de
// lijst "Te controleren" (/verwerken/week).
//
// Alles wat je nodig hebt om te oordelen staat hier bij elkaar: de binnengekomen
// scan naast de uitgelezen dag-uren, de tarieven en de marge, waarom de week niet
// automatisch doorging, en de twijfelgevallen (dubbele weekstaat, dubbele factuur,
// terugkerende fout).
//
// ALLEEN LEZEN. De pagina haalt op en toont; élke knop is een BESTAANDE
// server-action:
//   - goedkeuren      → confirmInbox (inbox/actions.ts), via ApproveInboxButton;
//   - naar wachtkamer → naarWachtkamer (../../controle/actions.ts);
//   - mail freelancer → het bestaande voorbeeldscherm (./mail), niets gaat hier weg;
//   - scan verwijderen→ verwijderScan (../actions.ts), die de guard draait en het
//     opruimen aan deleteInbox overlaat.
// Er wordt hier geen enkel bedrag uitgerekend — dat komt uit computeTimesheetMoney.
// ---------------------------------------------------------------------------

export const metadata = { title: "Week nakijken" };
export const dynamic = "force-dynamic";

const DAG_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

const CONF_LABEL: Record<string, string> = { high: "hoog", medium: "gemiddeld", low: "laag" };

/** Kort regeltje onder de naam: plaatsing · klant (of duidelijk: nog niet gekoppeld). */
function rolRegel(row: GateReviewRow): string {
  return (
    [row.placementTitle, row.clientName].filter(Boolean).join(" · ") ||
    "nog niet gekoppeld aan een klant"
  );
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

/** Vlaggen als opsomming; rood bij een harde fout, amber bij een waarschuwing. */
function FlagList({ flags }: { flags: DetectieFlag[] }) {
  return (
    <ul className="space-y-1 text-sm">
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
      <dd className="mt-0.5 text-sm text-ink-900">{children}</dd>
    </div>
  );
}

export default async function WeekDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fout?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  // Dezelfde beoordeling als de lijst — nooit een tweede waarheid over deze week.
  // Ook een geparkeerde of automatisch goedgekeurde week is hier op te vragen.
  const review = await timesheetGateReview();
  const row =
    review.needsReview.find((r) => r.id === id) ??
    review.wachtkamer.find((w) => w.row.id === id)?.row ??
    review.autoApprove.find((r) => r.id === id) ??
    null;
  if (!row) notFound();

  const [details, item] = await Promise.all([
    weekControleDetails([row]),
    db.timesheetInbox.findUnique({
      where: { id },
      select: {
        status: true,
        timesheetId: true,
        mimeType: true,
        originalName: true,
        source: true,
        senderEmail: true,
        receivedAt: true,
        createdAt: true,
        timesheet: { select: { status: true } },
      },
    }),
  ]);
  if (!item) notFound();

  const detail = details[0];
  const kop = detail?.kop ?? controleLabel(row.flags);
  const marge = detail?.marge ?? null;
  const herhaling = detail?.herhaling ?? null;
  const dubbeleFactuur = detail?.dubbel.flags ?? [];
  const factuurNummer = detail?.factuurNummer ?? null;

  const hardeFout = row.flags.some((f) => f.level === "error");

  // Mag de ruwe scan weg? Dezelfde guard die verwijderScan op de server draait —
  // de knop is dus nooit zichtbaar bij een geboekte of gefactureerde week.
  const oordeel = magScanVerwijderen({
    status: item.status,
    timesheetId: item.timesheetId,
    timesheetStatus: item.timesheet?.status ?? null,
  });

  return (
    <div className="space-y-6">
      <BackLink href="/verwerken/week">Terug naar weekverwerking</BackLink>

      <PageHeader
        eyebrow="Weekverwerking"
        title={row.name}
        description={`${row.weekLabel ?? "week onbekend"} · ${rolRegel(row)} — kijk de week na en kies hieronder wat ermee gebeurt.`}
        leading={
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-bold text-ink-500">
            {initialen(row.name)}
          </span>
        }
        actions={
          <>
            {kop && <Badge color={kop.level === "error" ? "red" : "amber"}>{kop.label}</Badge>}
            <Link href={`/inbox/${id}`} className={buttonVariants({ variant: "outline" })}>
              <PencilLine className="h-4 w-4" /> Bekijk &amp; corrigeer
            </Link>
          </>
        }
      />

      {sp.fout === "vast" && (
        <p className="flex items-start gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Deze scan is niet verwijderd: {oordeel.reden}. Een geboekte urenstaat of factuur wordt
            hier nooit weggegooid — corrigeer die bij de urenstaat zelf.
          </span>
        </p>
      )}

      {row.wachtkamerSince && (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Deze week staat sinds {formatDate(row.wachtkamerSince)} in de{" "}
            <Link href="/verwerken/wachtkamer" className="font-medium underline">
              wachtkamer
            </Link>
            {row.wachtkamerReason ? ` — ${row.wachtkamerReason}` : ""}.
          </span>
        </p>
      )}

      {/* --- 1) De cijfers van deze week --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Uren deze week"
          value={row.totalHours != null ? `${formatHours(row.totalHours)} u` : "—"}
          sub={
            row.recentAvgHours != null
              ? `eigen gemiddelde ${formatHours(row.recentAvgHours)} u (laatste ${row.recentWeeks} ${
                  row.recentWeeks === 1 ? "week" : "weken"
                })`
              : "geen historie om mee te vergelijken"
          }
          icon={<Clock3 className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Verkoop deze week"
          value={row.placementId ? formatCurrency(row.charge) : "—"}
          sub={row.placementId ? `inkoop ${formatCurrency(row.cost)}` : "geen plaatsing gekoppeld"}
          icon={<Coins className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Marge deze week"
          value={row.placementId ? formatCurrency(row.margin) : "—"}
          sub={
            marge?.marginPerHour != null
              ? `${formatCurrency(marge.marginPerHour)} per gewerkt uur`
              : "marge per uur niet te bepalen"
          }
          icon={<TrendingDown className="h-5 w-5" />}
          accent={marge?.belowNorm ? "amber" : "green"}
        />
        <StatCard
          label="Verkooptarief"
          value={row.chargeRate != null ? `${formatCurrency(row.chargeRate)}` : "—"}
          sub={
            row.costRate != null
              ? `per uur · inkoop ${formatCurrency(row.costRate)} p/u`
              : "inkooptarief onbekend"
          }
          icon={<Coins className="h-5 w-5" />}
          accent="slate"
        />
      </div>

      {/* --- 2) De scan naast wat de AI eruit las --- */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DocumentViewer
          src={`/api/inbox/${id}`}
          mimeType={item.mimeType}
          originalName={item.originalName}
          titel="Binnengekomen weekstaat"
          hoogte="h-[420px] lg:h-[560px]"
        />

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Uitgelezen uren</CardTitle>
            {row.confidence && (
              <Badge
                color={
                  row.confidence === "high" ? "green" : row.confidence === "low" ? "red" : "amber"
                }
              >
                zekerheid {CONF_LABEL[row.confidence] ?? row.confidence}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="grid grid-cols-7 gap-1 text-center">
              {DAG_LABELS.map((label, i) => {
                const uren = row.dayHours[i];
                const gewerkt = typeof uren === "number" && uren > 0;
                return (
                  <div
                    key={label}
                    className={cn(
                      "rounded-sm border px-1 py-2",
                      gewerkt
                        ? "border-ink-200 bg-white"
                        : "border-dashed border-ink-100 bg-ink-50/60",
                    )}
                  >
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-400">
                      {label}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-sm font-bold tabular-nums",
                        gewerkt ? "text-ink-900" : "text-ink-300",
                      )}
                    >
                      {gewerkt ? formatHours(uren) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Weektotaal">
                {row.totalHours != null ? `${formatHours(row.totalHours)} u` : "niet uitgelezen"}
              </DetailItem>
              <DetailItem label="Overuren">
                {row.overtimeHours != null ? `${formatHours(row.overtimeHours)} u` : "geen"}
              </DetailItem>
              <DetailItem label="Kilometers">
                {row.kilometers != null ? `${formatHours(row.kilometers)} km` : "geen"}
              </DetailItem>
              <DetailItem label="Week">{row.weekLabel ?? "niet uitgelezen"}</DetailItem>
              <DetailItem label="Plaatsing">{rolRegel(row)}</DetailItem>
              <DetailItem label="Binnengekomen">
                {item.source === "EMAIL"
                  ? `per e-mail${item.senderEmail ? ` van ${item.senderEmail}` : ""} op ${formatDate(
                      item.receivedAt ?? item.createdAt,
                    )}`
                  : `geüpload op ${formatDate(item.createdAt)}`}
              </DetailItem>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* --- 3) Waarom het blijft hangen, en wat we eraan overhouden --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={cn(hardeFout ? "border-red-200" : "border-amber-200")}>
          <CardHeader className={cn(hardeFout ? "bg-red-50/70" : "bg-amber-50/70")}>
            <CardTitle className={hardeFout ? "text-red-800" : "text-amber-900"}>
              Waarom dit niet automatisch doorgaat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {row.flags.length > 0 ? (
              <FlagList flags={row.flags} />
            ) : (
              <p className="text-sm text-ink-500">
                Geen controlemelding — deze week wacht alleen nog op een mens.
              </p>
            )}

            {row.duplicateExists && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="flex items-center gap-2 font-semibold text-red-800">
                  <CopyCheck className="h-4 w-4" /> Dubbele weekstaat
                </p>
                <p className="mt-1">
                  Voor deze plaatsing en week bestaat al een urenstaat. Is dit dezelfde weekstaat
                  die per ongeluk twee keer binnenkwam, verwijder dan hieronder de scan; klopt de
                  bestaande urenstaat niet, corrigeer die dan bij de urenstaat zelf.
                </p>
              </div>
            )}

            {dubbeleFactuur.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <CopyCheck className="h-4 w-4" /> Mogelijk dubbele factuur
                  {factuurNummer && (
                    <span className="font-normal text-amber-700">({factuurNummer})</span>
                  )}
                </p>
                <div className="mt-1.5">
                  <FlagList flags={dubbeleFactuur} />
                </div>
              </div>
            )}

            {herhaling?.label && (
              <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <Repeat2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>{herhaling.label}</strong> — dezelfde melding kwam bij deze medewerker al
                  eerder voorbij.
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marge en opmerkingen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border p-3 text-sm",
                marge?.belowNorm
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-ink-200 bg-white text-ink-600",
              )}
            >
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Marge per uur.</strong>{" "}
                {marge?.marginPerHour != null ? (
                  <>
                    <span className="tabular-nums">{formatCurrency(marge.marginPerHour)}</span> per
                    gewerkt uur op deze plaatsing
                    {marge.reason ? ` — ${marge.reason}` : "."}
                  </>
                ) : (
                  (marge?.reason ?? "niet te bepalen.")
                )}
              </span>
            </div>

            {row.aiFlags.length > 0 && (
              <div className="rounded-md border border-ink-200 bg-white p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-700">
                  <Sparkles className="h-4 w-4 text-ink-400" /> Opmerkingen bij het uitlezen
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

            {row.aiNotes && (
              <p className="rounded-md border border-ink-200 bg-white p-3 text-sm text-ink-600">
                <strong className="text-ink-700">Notitie van de uitlezing.</strong> {row.aiNotes}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- 4) Wat doe je ermee? --- */}
      <Card>
        <CardHeader>
          <CardTitle>Wat doe je met deze week?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Eigen bevinding + mail. Bewust een GET-formulier: de knop brengt je
              naar de controlestap met het volledige mailvoorbeeld — er gaat hier
              nog niets weg. */}
          <form
            method="get"
            action={`/verwerken/week/${id}/mail`}
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

          <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
            <p className="mr-auto flex max-w-md items-start gap-1.5 text-xs leading-relaxed text-ink-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
              <span>
                Goedkeuren maakt alleen een urenstaat. Er gaat niets de deur uit, er wordt niets
                gefactureerd en er wordt niets betaald.
              </span>
            </p>
            {/* Parkeren tot de medewerker een gecorrigeerde staat stuurt.
                De controlereden gaat als standaardreden mee. */}
            <form action={naarWachtkamer} className="contents">
              <input type="hidden" name="id" value={id} />
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
      </Card>

      {/* --- 5) De scan zelf weggooien (dubbel of verkeerd bestand) --- */}
      <Card className="border-red-100">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex max-w-2xl items-start gap-2 text-sm text-ink-600">
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            <span>
              <strong className="text-ink-900">Verkeerde of dubbele scan?</strong> Hiermee verdwijnt
              alleen het binnengekomen bestand uit de inbox — een urenstaat of factuur wordt nooit
              verwijderd. {oordeel.mag ? "" : `Kan nu niet: ${oordeel.reden}.`}
            </span>
          </p>
          {oordeel.mag ? (
            <ConfirmSubmit
              action={verwijderScan}
              id={id}
              variant="danger"
              size="sm"
              trigger="button"
              message={`Scan van ${row.name} verwijderen?`}
              description={`De binnengekomen weekstaat (${item.originalName}) en het bestand worden verwijderd. Er wordt geen urenstaat en geen factuur verwijderd. Dit kun je hierna niet meer terugdraaien.`}
              confirmLabel="Scan verwijderen"
              confirmVariant="danger"
            >
              <Trash2 className="h-4 w-4" /> Scan verwijderen
            </ConfirmSubmit>
          ) : (
            <Link
              href={`/inbox/${id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <PencilLine className="h-4 w-4" /> Bekijk in de inbox
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
