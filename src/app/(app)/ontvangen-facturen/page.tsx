import Link from "next/link";
import { AlertTriangle, Upload, CheckCircle2, Mail, Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import {
  listReceivedInvoices,
  receivedInvoicesSummary,
  receivedBucket,
} from "@/lib/received-invoices";
import { ReceivedList } from "./ReceivedList";

export const metadata = { title: "Ontvangen facturen" };
export const dynamic = "force-dynamic";

export default async function OntvangenFacturenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  const [rows, summary] = await Promise.all([listReceivedInvoices(), receivedInvoicesSummary()]);

  const awaiting = rows.filter((r) => receivedBucket(r) === "afwijking").length;
  const toCheck = rows.filter((r) => receivedBucket(r) === "controleren").length;

  // Compacte overzichts-chips i.p.v. drie grote stat-cards — deze pagina is een
  // naslag/archief; de flow (Week verwerken → wachtkamer) is elders leidend.
  const chips: { label: string; value: string; tone: "amber" | "red" | "green" | "slate" }[] = [
    {
      label: "Nog te betalen",
      value: `${formatCurrency(summary.toPayAmount)} · ${summary.toPayCount}`,
      tone: "amber",
    },
    { label: "Wacht op correctie", value: String(summary.awaitingCount), tone: summary.awaitingCount > 0 ? "red" : "green" },
    { label: "Betaald", value: `${summary.paidCount} van ${summary.total}`, tone: "green" },
  ];
  const chipTone: Record<"amber" | "red" | "green" | "slate", string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-ink-200 bg-ink-50 text-ink-600",
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ontvangen facturen"
        description="Archief van alle facturen van geplaatste ZZP'ers. Sorteer of filter op week, status en controle. De echte afhandeling loopt via Week verwerken en de wachtkamer — hier heb je het overzicht."
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
      {sp.reset === "ok" && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Week teruggezet — de urenstaat en het concept zijn verwijderd. De weekstaat staat weer klaar in{" "}
          <Link href="/verwerken/nieuw" className="font-medium underline underline-offset-2">Week verwerken</Link>.
        </p>
      )}
      {sp.reset === "locked" && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Deze week is <strong>niet</strong> gereset: er hangt een al vrijgegeven, verstuurde of betaalde factuur aan. Crediteer die eerst — administratie wordt nooit automatisch verwijderd.
        </p>
      )}

      {/* Compacte chips — één regel, geen grote kaarten meer */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <span
            key={c.label}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
              chipTone[c.tone],
            )}
          >
            {c.label}
            <span className="font-semibold tabular-nums">{c.value}</span>
          </span>
        ))}
      </div>

      {/* Lichte hint: afwijkingen zitten gewoon in de tabel (filter op 'Afwijking') */}
      {(awaiting > 0 || toCheck > 0) && (
        <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 px-4 py-2.5 text-xs text-ink-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>
            {awaiting > 0 && (
              <>
                <strong>{awaiting}</strong> factu{awaiting === 1 ? "ur wijkt" : "ren wijken"} af van de urenstaat —
                betaal die pas na correctie.{" "}
              </>
            )}
            {toCheck > 0 && (
              <>
                <strong>{toCheck}</strong> zonder periode nog niet gecontroleerd.{" "}
              </>
            )}
            Filter hieronder op <strong>Controle → Afwijking</strong> om ze apart te zien.
          </span>
        </p>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="Nog geen ontvangen facturen"
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
        <ReceivedList rows={rows} />
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
