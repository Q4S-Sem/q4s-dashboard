import Link from "next/link";
import {
  Coins,
  AlertTriangle,
  Wallet,
  Upload,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Mail,
  Inbox,
  Clock,
  FileQuestion,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { WeekPicker } from "@/components/week-picker";
import { cn, formatCurrency, formatWeekLabel, startOfISOWeek } from "@/lib/utils";
import {
  listReceivedInvoices,
  receivedInvoicesSummary,
  receivedBucket,
} from "@/lib/received-invoices";
import { ReceivedList } from "./ReceivedList";
import { DiscrepancyMailButton } from "./DiscrepancyMailButton";

export const metadata = { title: "Ontvangen facturen" };
export const dynamic = "force-dynamic";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function shiftWeek(monday: Date, delta: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + delta * 7);
  return ymd(d);
}
function daysSince(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
}

export default async function OntvangenFacturenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; week?: string; toon?: string }>;
}) {
  const sp = await searchParams;
  const [rows, summary] = await Promise.all([listReceivedInvoices(), receivedInvoicesSummary()]);

  // Afwijkingen staan APART bovenaan; de hoofdlijst toont de rest.
  const awaiting = rows.filter((r) => receivedBucket(r) === "afwijking");
  const toCheck = rows.filter((r) => receivedBucket(r) === "controleren");
  const rest = rows.filter((r) => receivedBucket(r) !== "afwijking");

  const toon =
    sp.toon === "tebetalen" || sp.toon === "controleren" || sp.toon === "betaald" ? sp.toon : null;

  // Week-filter op factuurdatum ("wat is er die week binnengekomen"); leeg = alle weken.
  const hasWeek = !toon && !!sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week);
  const monday = hasWeek ? new Date(`${sp.week}T00:00:00`) : null;
  const anchor = monday ?? startOfISOWeek(new Date());
  const weekEnd = monday ? new Date(monday.getTime() + 7 * 86_400_000) : null;

  let shown = rest;
  let selectionLabel = "";
  if (toon === "tebetalen") {
    shown = rows.filter((r) => receivedBucket(r) === "tebetalen");
    selectionLabel = "Nog te betalen (klopt)";
  } else if (toon === "controleren") {
    shown = toCheck;
    selectionLabel = "Te controleren (geen periode)";
  } else if (toon === "betaald") {
    shown = rows.filter((r) => receivedBucket(r) === "betaald");
    selectionLabel = "Betaald";
  } else if (monday && weekEnd) {
    shown = rest.filter(
      (r) => r.issueDate && new Date(r.issueDate) >= monday && new Date(r.issueDate) < weekEnd,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ontvangen facturen"
        description="Facturen van geplaatste ZZP'ers. Klopt het met de urenstaat? Dan betaal je op tijd. Wijkt het af? Dan zetten we het apart en wachten we op een aangepaste factuur — zo betaal je nooit te laat of fout."
        actions={
          <Link href="/ontvangen-facturen/importeren" className={buttonVariants()}>
            <Upload className="h-4 w-4" /> Factuur importeren
          </Link>
        }
      />

      {sp.ok && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Factuur geregistreerd en gecontroleerd tegen de timesheet.
        </p>
      )}

      {/* Compacte melding: wacht op correctie. Klik "Zie facturen" → naar de lijst hieronder. */}
      {awaiting.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          <span className="flex min-w-0 items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>{awaiting.length} factu{awaiting.length === 1 ? "ur wacht" : "ren wachten"}</strong> op een
              aangepaste factuur — betaal deze <strong>pas na de correctie</strong>. Ze staan hieronder apart zodat
              je ze nooit vergeet.
            </span>
          </span>
          <Link
            href="#wacht"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0 border-amber-300 bg-white/70 text-amber-900 hover:bg-white",
            )}
          >
            Zie facturen
          </Link>
        </div>
      )}

      {/* Zachtere melding: facturen zonder periode kunnen we (nog) niet controleren */}
      {toCheck.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-ink-300 bg-ink-50 px-4 py-3 text-sm text-ink-700">
          <FileQuestion className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <span>
            <strong>
              {toCheck.length} factu{toCheck.length === 1 ? "ur heeft" : "ren hebben"} geen periode
            </strong>{" "}
            en {toCheck.length === 1 ? "is" : "zijn"} nog niet tegen de urenstaat gecontroleerd —{" "}
            <strong>nog niet betalen</strong>.{" "}
            <Link
              href="/ontvangen-facturen?toon=controleren"
              className="font-medium text-brand-700 hover:underline"
            >
              Vul de periode aan
            </Link>{" "}
            zodat we ook deze veilig kunnen betalen.
          </span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/ontvangen-facturen?toon=tebetalen" className="block">
          <StatCard
            label="Nog te betalen (op tijd)"
            value={formatCurrency(summary.toPayAmount)}
            sub={`${summary.toPayCount} factu${summary.toPayCount === 1 ? "ur" : "ren"} · klopt · bekijk →`}
            accent="amber"
            icon={<Wallet className="h-5 w-5" />}
            className={cn(
              "cursor-pointer transition hover:border-brand-300 hover:shadow-md",
              toon === "tebetalen" && "border-brand-500 ring-1 ring-brand-500",
            )}
          />
        </Link>
        <Link href="#wacht" className="block">
          <StatCard
            label="Wacht op aangepaste factuur"
            value={summary.awaitingCount}
            sub={summary.awaitingCount > 0 ? `${formatCurrency(summary.awaitingAmount)} · bekijk →` : "alles klopt"}
            accent={summary.awaitingCount > 0 ? "red" : "green"}
            icon={<Clock className="h-5 w-5" />}
            className="cursor-pointer transition hover:border-brand-300 hover:shadow-md"
          />
        </Link>
        <Link href="/ontvangen-facturen?toon=betaald" className="block">
          <StatCard
            label="Betaald"
            value={summary.paidCount}
            sub={`${summary.total} totaal · bekijk →`}
            accent="green"
            icon={<Coins className="h-5 w-5" />}
            className={cn(
              "cursor-pointer transition hover:border-brand-300 hover:shadow-md",
              toon === "betaald" && "border-brand-500 ring-1 ring-brand-500",
            )}
          />
        </Link>
      </div>

      {/* Aparte sectie: wacht op een aangepaste factuur */}
      {awaiting.length > 0 && (
        <div
          id="wacht"
          className="scroll-mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50/50 p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-amber-900">
                Wacht op een aangepaste factuur ({awaiting.length})
              </h2>
              <p className="text-sm text-amber-700">
                Deze kloppen niet met ons plaatsingstarief × de uren — vaak omdat de ZZP&apos;er zijn tarief
                heeft gewijzigd. Open de factuur om het tarief te controleren en de plaatsing bij te werken.
                Betaal pas na de correctie.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {awaiting.map((r) => {
              const days = r.mailedAt ? daysSince(r.mailedAt) : null;
              const stale = days != null && days >= 7;
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-amber-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/ontvangen-facturen/${r.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {r.consultantName}
                    </Link>
                    {r.number && <span className="ml-2 text-sm text-ink-400">{r.number}</span>}
                    <div className="text-xs text-ink-500">
                      Gefactureerd {formatCurrency(r.amount)} · verwacht{" "}
                      {r.expected ? formatCurrency(r.expected.total) : "—"} ·{" "}
                      <span className="font-medium text-red-600">
                        verschil {r.diff != null ? `${r.diff > 0 ? "+" : ""}${formatCurrency(r.diff)}` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className={cn("text-xs", stale ? "font-semibold text-red-600" : "text-ink-500")}>
                    {r.mailed
                      ? days === 0
                        ? "Vandaag gemaild"
                        : `${days} dag${days === 1 ? "" : "en"} geleden gemaild${stale ? " — herinner" : ""}`
                      : "Nog niet gemaild"}
                  </div>

                  <div className="flex items-center gap-2">
                    <DiscrepancyMailButton id={r.id} alreadyMailed={false} variant="button" />
                    {r.email && (
                      <a
                        href={`mailto:${r.email}?subject=${encodeURIComponent(
                          `Factuur ${r.number ?? ""} — aangepaste factuur`,
                        )}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                        title="Open het mailverkeer met deze persoon"
                      >
                        <Mail className="h-4 w-4" /> Mailwisseling
                      </a>
                    )}
                    <Link
                      href={`/ontvangen-facturen/${r.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Bekijken
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hoofdlijst (zonder de afwijkingen) */}
      {toon ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-sm bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700">
            {selectionLabel} · {shown.length} factu{shown.length === 1 ? "ur" : "ren"}
          </span>
          <Link href="/ontvangen-facturen" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Toon alles
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href={`/ontvangen-facturen?week=${shiftWeek(anchor, -1)}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ChevronLeft className="h-4 w-4" /> Vorige week
            </Link>
            <WeekPicker value={ymd(anchor)} basePath="/ontvangen-facturen" className="w-64" />
            <Link
              href={`/ontvangen-facturen?week=${shiftWeek(anchor, 1)}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Volgende week <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/ontvangen-facturen"
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                hasWeek
                  ? "border border-ink-200 text-ink-600 hover:bg-ink-50"
                  : "bg-brand-600 text-white shadow-sm",
              )}
            >
              Alle weken
            </Link>
          </div>

          <p className="text-center text-xs text-ink-400">
            {hasWeek ? formatWeekLabel(anchor) : "Alle weken"} · {shown.length} factu
            {shown.length === 1 ? "ur" : "ren"} (afwijkingen staan apart hierboven)
          </p>
        </>
      )}

      {shown.length === 0 ? (
        awaiting.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Inbox className="h-6 w-6" />}
                title={toon ? "Niets in deze selectie" : hasWeek ? "Geen facturen in deze week" : "Nog geen ontvangen facturen"}
                description="Importeer de eerste factuur die een geplaatste ZZP'er je stuurde — die wordt meteen tegen de timesheet gecontroleerd."
                action={
                  <Link href="/ontvangen-facturen/importeren" className={buttonVariants()}>
                    <Upload className="h-4 w-4" /> Factuur importeren
                  </Link>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <p className="rounded-xl border border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-500">
            Geen facturen in deze selectie — alle openstaande facturen wachten op een correctie (zie hierboven).
          </p>
        )
      ) : (
        <ReceivedList rows={shown} />
      )}

      {/* Gated: AI-uit-de-mail (later) */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-ink-300 bg-ink-50/60 px-4 py-3 text-sm text-ink-500">
        <Mail className="h-4 w-4 shrink-0 text-ink-400" />
        <span className="flex-1">
          <strong className="font-medium text-ink-700">Binnenkort:</strong> AI leest inkomende facturen
          automatisch uit je mailbox en zet ze hier klaar — net als de CV-inbox. Tot die tijd importeer je
          ze zelf.
        </span>
        <span className="rounded-sm bg-ink-200 px-2 py-0.5 text-xs font-semibold text-ink-500">
          Gepland
        </span>
      </div>
    </div>
  );
}
