import Link from "next/link";
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  PauseCircle,
  PencilLine,
  Undo2,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn, formatCurrency, formatDate, formatHours } from "@/lib/utils";
import { timesheetGateReview } from "@/lib/timesheet-gate-review";
import { controleLabel, initialen } from "@/lib/weekverwerking";
import { uitWachtkamer } from "../controle/actions";
import { herinnerEen } from "../week/actions";

// ---------------------------------------------------------------------------
// Wachtkamer — de weken die HR bewust geparkeerd heeft.
//
// Een weekstaat die niet klopt haal je hier van het weekoverzicht af, zodat dat
// scherm schoon blijft, en hij wacht tot de freelancer een gecorrigeerde staat of
// factuur stuurt. Stuurt die persoon iets nieuws, dan is dat een nieuw
// inbox-item en dat verschijnt vanzelf weer bij "te controleren" — deze
// geparkeerde week blijft staan tot iemand hem bevestigt, afwijst of hier
// terugzet.
//
// De lijst komt uit dezelfde data-laag als het weekoverzicht
// (timesheetGateReview), gesplitst door de pure helper src/lib/wachtkamer.ts.
// Twee knoppen doen iets: "Terug naar overzicht" (uitWachtkamer) zet alleen de
// wachtkamer-velden leeg, en "Herinner" (herinnerEen, ../week/actions) stuurt
// die ene persoon een herinnering via het bestaande mailpad. Er wordt hier
// niets goedgekeurd, gefactureerd of betaald.
// ---------------------------------------------------------------------------

export const metadata = { title: "Wachtkamer" };
export const dynamic = "force-dynamic";

/** Vanaf hier wacht het te lang en verdient het een herinnering. */
const LANG_WACHTEN_DAGEN = 7;

export default async function WachtkamerPage({
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
  const { wachtkamer, needsReview } = await timesheetGateReview();

  const teLang = wachtkamer.filter((w) => w.dagen >= LANG_WACHTEN_DAGEN);
  const langst = wachtkamer[0] ?? null;

  // Uitkomst van een verstuurde herinnering (komt terug via de redirect).
  const herinnerd = sp.verstuurd !== undefined || sp.klaargezet !== undefined;
  const nVerstuurd = Number(sp.verstuurd ?? 0) || 0;
  const nKlaargezet = Number(sp.klaargezet ?? 0) || 0;
  const nOvergeslagen = Number(sp.overgeslagen ?? 0) || 0;
  const nMislukt = Number(sp.mislukt ?? 0) || 0;

  return (
    <div className="space-y-6">
      <BackLink href="/verwerken/week">Terug naar weekverwerking</BackLink>

      <PageHeader
        eyebrow="Facturatie"
        title="Wachtkamer"
        description="Geparkeerde weken — ze wachten op een gecorrigeerde weekstaat of factuur van de medewerker. Stuurt iemand iets nieuws, dan komt dat vanzelf weer bij Te controleren."
        actions={
          <Link href="/verwerken/week" className={buttonVariants({ variant: "outline" })}>
            <CalendarDays className="h-4 w-4" /> Weekverwerking
            {needsReview.length > 0 && ` (${needsReview.length})`}
          </Link>
        }
      />

      {herinnerd && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-md px-4 py-3 text-sm",
            nMislukt > 0 || nOvergeslagen > 0
              ? "bg-amber-50 text-amber-800"
              : "bg-emerald-50 text-emerald-800",
          )}
        >
          <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {nVerstuurd > 0 && "De herinnering is verstuurd."}
            {nKlaargezet > 0 &&
              "De herinnering is klaargezet (klaarzet-modus — geen SMTP ingesteld, dus nog niet echt verzonden)."}
            {nOvergeslagen > 0 &&
              "Er is niets verstuurd: bij deze medewerker staat geen e-mailadres. Vul dat eerst in."}
            {nMislukt > 0 &&
              "Versturen is niet gelukt — controleer de SMTP-instellingen en probeer het opnieuw."}{" "}
            De week blijft gewoon geparkeerd staan.
          </span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="In de wachtkamer"
          value={wachtkamer.length}
          sub={
            wachtkamer.length > 0
              ? `${wachtkamer.length === 1 ? "één week" : `${wachtkamer.length} weken`} van het overzicht gehaald`
              : "niets geparkeerd"
          }
          icon={<PauseCircle className="h-5 w-5" />}
          accent={wachtkamer.length > 0 ? "amber" : "green"}
        />
        <StatCard
          label="Langer dan een week"
          value={teLang.length}
          sub={
            teLang.length > 0
              ? "stuur deze mensen een herinnering"
              : "alles wacht nog geen week"
          }
          icon={<BellRing className="h-5 w-5" />}
          accent={teLang.length > 0 ? "amber" : "slate"}
        />
        <StatCard
          label="Langst wachtend"
          value={langst ? langst.wachtLabel : "—"}
          sub={langst ? langst.row.name : "geen geparkeerde weken"}
          icon={<Clock3 className="h-5 w-5" />}
          accent="slate"
        />
      </div>

      {wachtkamer.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="De wachtkamer is leeg"
          description="Er staat geen enkele week geparkeerd. Klopt een weekstaat niet, dan zet je hem bij Weekverwerking op 'Naar wachtkamer' — hij verdwijnt dan van het overzicht tot de medewerker corrigeert."
          action={
            <Link href="/verwerken/week" className={buttonVariants({ variant: "outline" })}>
              <CalendarDays className="h-4 w-4" /> Naar weekverwerking
            </Link>
          }
        />
      ) : (
        <section className="space-y-3">
          <h2 className="flex items-baseline gap-2 text-[15px] font-semibold text-ink-900">
            <PauseCircle className="h-4 w-4 shrink-0 translate-y-0.5 text-amber-600" /> Wacht op
            correctie
            <span className="text-sm font-normal text-ink-500">
              — langst wachtende bovenaan ({wachtkamer.length})
            </span>
          </h2>

          {wachtkamer.map(({ row, since, reason, dagen, wachtLabel }) => {
            const kop = controleLabel(row.flags);
            const lang = dagen >= LANG_WACHTEN_DAGEN;
            return (
              <Card
                key={row.id}
                className={cn(
                  "overflow-hidden border-l-[3px]",
                  lang ? "border-l-red-500" : "border-l-amber-500",
                )}
              >
                <CardContent className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 py-3.5 sm:grid-cols-[40px_minmax(0,1fr)_112px_112px_auto]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-[13px] font-bold text-ink-500">
                    {initialen(row.name)}
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink-900">
                      {row.name}
                    </span>
                    <span className="block truncate text-xs text-ink-400">
                      {[row.weekLabel, row.placementTitle, row.clientName]
                        .filter(Boolean)
                        .join(" · ") || "— nog niet gekoppeld aan een klant"}
                    </span>
                    <span className="mt-1 block text-sm text-ink-600">
                      <strong className="font-semibold text-ink-700">Reden:</strong>{" "}
                      {reason ?? kop?.label ?? "geen reden vastgelegd"}
                    </span>
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

                  <span className="col-span-3 flex flex-wrap items-center justify-end gap-2 sm:col-span-1">
                    <Badge color={lang ? "red" : "amber"} className="gap-1">
                      <Clock3 className="h-3 w-3" /> {wachtLabel}
                    </Badge>
                    <span
                      className="hidden text-xs text-ink-400 lg:inline"
                      title={`Geparkeerd op ${formatDate(since)}`}
                    >
                      sinds {formatDate(since)}
                    </span>
                    <Link
                      href={`/inbox/${row.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <PencilLine className="h-4 w-4" /> Bekijk
                    </Link>
                    {/* Eén herinnering aan deze persoon — dezelfde tekst en
                        hetzelfde mailpad als de knop op het weekoverzicht. */}
                    <ConfirmSubmit
                      action={herinnerEen}
                      variant="outline"
                      size="sm"
                      trigger="button"
                      hidden={{ id: row.id }}
                      message={`Herinnering sturen aan ${row.name}?`}
                      description="Deze medewerker krijgt een vriendelijke herinnering om zijn timesheet én factuur te sturen. De week blijft geparkeerd staan; er wordt niets goedgekeurd, gefactureerd of betaald. Nog een keer sturen mag."
                      confirmLabel="Herinnering sturen"
                      confirmVariant="success"
                    >
                      <BellRing className="h-4 w-4" /> Herinner
                    </ConfirmSubmit>
                    <form action={uitWachtkamer}>
                      <input type="hidden" name="id" value={row.id} />
                      <SubmitButton variant="outline" size="sm" pendingLabel="Terugzetten…">
                        <Undo2 className="h-4 w-4" /> Terug naar overzicht
                      </SubmitButton>
                    </form>
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <p className="flex items-start gap-2 rounded-md bg-ink-50 px-4 py-3 text-xs leading-relaxed text-ink-600">
        <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <span>
          <strong>Parkeren verandert niets aan de weekstaat.</strong> Hij blijft gewoon uitgelezen
          staan: er wordt niets goedgekeurd, gefactureerd of verstuurd. Zodra je hem bevestigt of
          afwijst in de{" "}
          <Link href="/inbox" className="font-medium underline">
            inbox
          </Link>
          , verdwijnt hij hier vanzelf.
        </span>
      </p>
    </div>
  );
}
