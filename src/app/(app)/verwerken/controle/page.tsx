import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Inbox as InboxIcon,
  PencilLine,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { INBOX_SOURCES } from "@/lib/domain";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { cn, formatCurrency, formatHours, round2 } from "@/lib/utils";
import { timesheetGateReview, type GateReviewRow } from "@/lib/timesheet-gate-review";
import { ApproveInboxButton } from "./ApproveInboxButton";
import { approveAllAutoApproved, processAllAutoApproved } from "./actions";

export const metadata = { title: "Urencontrole" };
export const dynamic = "force-dynamic";

const CONF_LABEL: Record<string, string> = { high: "hoog", medium: "gemiddeld", low: "laag" };

/** Kort regeltje onder de naam: week · plaatsing · klant. */
function subtitle(row: GateReviewRow): string {
  return [row.weekLabel, row.placementTitle, row.clientName].filter(Boolean).join(" · ") || "—";
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="text-ink-900">{children}</dd>
    </div>
  );
}

export default async function UrencontrolePage({
  searchParams,
}: {
  searchParams: Promise<{
    goedgekeurd?: string;
    facturen?: string;
    overgeslagen?: string;
    mislukt?: string;
  }>;
}) {
  const sp = await searchParams;
  const review = await timesheetGateReview();
  const { needsReview, autoApprove, totals, notExtracted } = review;

  // Wat er nú in één klik door kan: alleen groene staten die compleet genoeg zijn.
  const batch = autoApprove.filter((r) => r.canApprove);
  const batchHours = round2(batch.reduce((s, r) => s + (r.totalHours ?? 0), 0));
  const batchCharge = round2(batch.reduce((s, r) => s + r.charge, 0));

  // Uitkomst van een eerdere batch (komt terug via de redirect van de actie).
  const ranBatch = sp.goedgekeurd !== undefined;
  const approvedCount = Number(sp.goedgekeurd ?? 0) || 0;
  const skippedCount = Number(sp.overgeslagen ?? 0) || 0;
  const failedCount = Number(sp.mislukt ?? 0) || 0;
  // Alleen gevuld door "Verwerk alles groen" (goedkeuren + conceptfacturen):
  // uitsluitend de VERKOOP per klant. De inkoop maken we niet zelf — dat is de
  // factuur die de ZZP'er zelf stuurt (Ontvangen facturen).
  const invoiceCount = Number(sp.facturen ?? 0) || 0;

  return (
    <div className="space-y-6">
      <BackLink href="/verwerken">Terug naar verwerken</BackLink>

      <PageHeader
        title="Urencontrole"
        description="Elke uitgelezen weekstaat gaat langs dezelfde zes controles. Wat schoon is mag automatisch door; alles waar iets aan opvalt komt hier bovenaan te staan, mét de reden erbij."
        actions={
          <>
            <Link href="/inbox" className={buttonVariants({ variant: "outline" })}>
              <InboxIcon className="h-4 w-4" /> Timesheet-inbox
            </Link>
            <Link href="/inbox/status" className={buttonVariants({ variant: "outline" })}>
              <ClipboardCheck className="h-4 w-4" /> Timesheet-status
            </Link>
          </>
        }
      />

      <p className="flex items-start gap-2 rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <span>
          Hier wordt <strong>niets verstuurd</strong>. Je keurt weekstaten goed; kies je ervoor om ze
          meteen door te zetten, dan staan de uren geaccepteerd en komt de{" "}
          <strong>verkoopfactuur als concept</strong> klaar te staan (per klant). De{" "}
          <strong>inkoop is de factuur die de ZZP&apos;er zelf stuurt</strong> — die controleer en
          match je bij{" "}
          <Link href="/ontvangen-facturen" className="font-medium text-brand-700 hover:underline">
            Ontvangen facturen
          </Link>
          . Versturen doe je later bij{" "}
          <Link href="/verzenden" className="font-medium text-brand-700 hover:underline">
            Verzenden
          </Link>
          .
        </span>
      </p>

      {ranBatch && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-lg px-4 py-3 text-sm",
            failedCount > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800",
          )}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{approvedCount}</strong> weeksta{approvedCount === 1 ? "at" : "ten"} goedgekeurd
            {invoiceCount > 0 && (
              <>
                {" "}
                · <strong>{invoiceCount}</strong> verkoopfactu{invoiceCount === 1 ? "ur" : "ren"} als
                concept aangemaakt
              </>
            )}
            {skippedCount > 0 && (
              <> · {skippedCount} overgeslagen (al verwerkt of niet compleet)</>
            )}
            {failedCount > 0 && (
              <>
                {" "}
                · <strong>{failedCount}</strong> niet gelukt — die staan hieronder nog
              </>
            )}
            . Er is niets verstuurd
            {invoiceCount > 0
              ? " — de verkoopfactu" + (invoiceCount === 1 ? "ur staat" : "ren staan") + " als concept klaar."
              : " en er zijn geen facturen gemaakt."}{" "}
            Er is <strong>geen inkoopfactuur</strong> gemaakt: de inkoop is de factuur die de
            ZZP&apos;er zelf stuurt — die controleer en match je bij{" "}
            <Link href="/ontvangen-facturen" className="font-medium underline">
              Ontvangen facturen
            </Link>
            .
          </span>
        </p>
      )}

      {notExtracted > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {notExtracted} binnengekomen bestand{notExtracted === 1 ? "" : "en"} moet nog uitgelezen worden — die
            staan pas op deze lijst zodra de AI ze heeft gelezen. Dat doe je in de{" "}
            <Link href="/inbox" className="font-medium underline">
              inbox
            </Link>
            .
          </span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Nakijken"
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
          label="Automatisch akkoord"
          value={autoApprove.length}
          sub={`${formatHours(totals.autoApprove.hours)} u schoon uitgelezen`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Te factureren (automatisch)"
          value={formatCurrency(totals.autoApprove.charge)}
          sub="verkoop ex BTW, incl. toeslagen"
          icon={<Users className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Marge (automatisch)"
          value={formatCurrency(totals.autoApprove.margin)}
          sub={`inkoop ${formatCurrency(totals.autoApprove.cost)}`}
          icon={<Sparkles className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      {/* --- Nakijken: bovenaan, met de concrete redenen erbij --- */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> Even nakijken
          {needsReview.length > 0 && (
            <span className="text-sm font-normal text-ink-500">({needsReview.length})</span>
          )}
        </h2>

        {needsReview.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Niets om na te kijken"
            description="Alle uitgelezen weekstaten kwamen schoon door de controles. Ze staan hieronder samengevat."
          />
        ) : (
          needsReview.map((row) => {
            const hasError = row.flags.some((f) => f.level === "error");
            return (
              <Card
                key={row.id}
                className={cn(hasError ? "border-red-200" : "border-amber-200")}
              >
                <CardHeader className="flex-wrap">
                  <div className="min-w-0">
                    <CardTitle>{row.name}</CardTitle>
                    <p className="mt-0.5 text-sm text-ink-500">{subtitle(row)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.confidence && (
                      <Badge color={row.confidence === "high" ? "green" : row.confidence === "low" ? "red" : "amber"}>
                        zekerheid {CONF_LABEL[row.confidence] ?? row.confidence}
                      </Badge>
                    )}
                    <StatusBadge options={INBOX_SOURCES} value={row.source} />
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <DetailItem label="Uren (week)">
                      {row.totalHours != null ? `${formatHours(row.totalHours)} u` : "—"}
                      {row.overtimeHours != null && row.overtimeHours > 0 && (
                        <span className="ml-1 text-xs text-ink-400">
                          + {formatHours(row.overtimeHours)} u overuren
                        </span>
                      )}
                    </DetailItem>
                    <DetailItem label="Eigen gemiddelde">
                      {row.recentAvgHours != null
                        ? `${formatHours(row.recentAvgHours)} u`
                        : "geen historie"}
                      {row.recentWeeks > 0 && (
                        <span className="ml-1 text-xs text-ink-400">
                          (laatste {row.recentWeeks} {row.recentWeeks === 1 ? "week" : "weken"})
                        </span>
                      )}
                    </DetailItem>
                    <DetailItem label="Tarieven">
                      {row.chargeRate != null && row.costRate != null
                        ? `${formatCurrency(row.chargeRate)} / ${formatCurrency(row.costRate)} p/u`
                        : "onbekend"}
                    </DetailItem>
                    <DetailItem label="Marge (week)">
                      {row.placementId ? formatCurrency(row.margin) : "—"}
                    </DetailItem>
                  </dl>

                  <div
                    className={cn(
                      "rounded-lg border p-3",
                      hasError ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50",
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        hasError ? "text-red-800" : "text-amber-900",
                      )}
                    >
                      Waarom dit niet automatisch doorgaat
                    </p>
                    <ul className="mt-1.5 space-y-1 text-sm">
                      {row.flags.map((flag, i) => (
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
                  </div>

                  {row.aiFlags.length > 0 && (
                    <div className="rounded-lg border border-ink-200 bg-white p-3">
                      <p className="text-sm font-semibold text-ink-700">Opmerkingen bij het uitlezen</p>
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

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/inbox/${row.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <PencilLine className="h-4 w-4" /> Corrigeren
                    </Link>
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
            );
          })
        )}
      </section>

      {/* --- Automatisch akkoord: ingeklapt, alleen het totaal telt --- */}
      <Card>
        {batch.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-md border-b border-emerald-100 bg-emerald-50/70 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink-900">
                {batch.length} schone weeksta{batch.length === 1 ? "at" : "ten"} kunnen in één keer door
              </p>
              <p className="mt-0.5 text-sm text-ink-600">
                {formatHours(batchHours)} u · {formatCurrency(batchCharge)} te factureren — kies of je
                alleen goedkeurt, of meteen doorzet naar een concept verkoopfactuur per klant.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmSubmit
                action={approveAllAutoApproved}
                variant="outline"
                trigger="button"
                message={`Alle ${batch.length} groene weeksta${batch.length === 1 ? "at" : "ten"} goedkeuren?`}
                description="Er worden urenstaten aangemaakt voor alles wat de controles schoon doorkwam. Wat nagekeken moet worden blijft staan. Er gaat niets de deur uit en er wordt geen factuur gemaakt — dat blijft een aparte stap bij Verwerken."
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
                description="Uren geaccepteerd + verkoopfactuur als concept (per klant). De inkoop is de factuur die de ZZP'er zelf stuurt (Ontvangen facturen) — die controleer/match je daar; er wordt hier géén inkoopfactuur gemaakt. De verkoopfactuur blijft CONCEPT: er gaat niets de deur uit en er wordt niets betaald. Versturen doe je zelf bij Verzenden."
                confirmLabel="Verwerken tot concept"
                confirmVariant="success"
              >
                <Sparkles className="h-4 w-4" /> Verwerk alles groen → verkoopfactuur concept
              </ConfirmSubmit>
            </div>
          </div>
        )}

        <details>
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold text-ink-900 hover:bg-ink-50/60">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Automatisch akkoord ({autoApprove.length})
            </span>
            <span className="text-sm font-normal text-ink-500">
              {formatHours(totals.autoApprove.hours)} u · {formatCurrency(totals.autoApprove.charge)} te factureren ·
              klik om te bekijken
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
    </div>
  );
}
