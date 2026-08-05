import Link from "next/link";
import { Plug, ArrowRight, Upload, Building2, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge } from "@/components/ui/badge";
import { VMS_STATUSES } from "@/lib/domain";
import { MSP_PROVIDERS } from "@/lib/msp-providers";
import { addKnownConnector } from "../../../connectors/actions";
import { formatDate, cn } from "@/lib/utils";
import { getSources, OVERIG_KEY } from "../data";

export const metadata = { title: "Opdrachtgevers · Vacaturehub" };

/** Verdeling relevant / afgewezen / nog te beoordelen als één balkje. */
function Split({ relevant, irrelevant, unknown }: { relevant: number; irrelevant: number; unknown: number }) {
  const total = Math.max(1, relevant + irrelevant + unknown);
  const seg = (n: number, cls: string) =>
    n > 0 ? <span className={cls} style={{ width: `${(n / total) * 100}%` }} /> : null;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
      {seg(relevant, "bg-emerald-500")}
      {seg(unknown, "bg-amber-400")}
      {seg(irrelevant, "bg-slate-300")}
    </div>
  );
}

export default async function InstroomPage() {
  const [sources, connected] = await Promise.all([
    getSources(),
    db.vmsConnector.findMany({ select: { key: true } }),
  ]);
  const actief = sources.filter((s) => s.total > 0);
  const leeg = sources.filter((s) => s.total === 0);

  // Grote NL-platformen die je nog niet gekoppeld hebt — één klik om toe te voegen.
  const known = new Set(connected.map((c) => c.key));
  const missing = MSP_PROVIDERS.filter((p) => !known.has(p.key));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-500" /> Waar de vacatures vandaan komen
          </CardTitle>
          <div className="flex gap-2">
            <Link href="/vacatures/importeren" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Upload className="h-4 w-4" /> Bulk-import
            </Link>
            <Link href="/connectors" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Plug className="h-4 w-4" /> Koppelingen
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Elke opdrachtgever of inhuurdesk levert vacatures aan. Klik een bron open om te zien wat
            er binnenkwam, wat de AI ervan vond en wat er nog beoordeeld moet worden.
          </p>
        </CardContent>
      </Card>

      {actief.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-400">
            Nog geen instroom. Importeer een lijst of laat een platform aanleveren.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actief.map((s) => (
            <Link
              key={s.key}
              href={`/vacaturehub/instroom/${s.key}`}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900">{s.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {s.key === OVERIG_KEY
                      ? "handmatig, CSV en e-mail"
                      : s.lastIn
                        ? `laatste levering ${formatDate(s.lastIn)}`
                        : "nog geen levering"}
                  </p>
                </div>
                {s.key !== OVERIG_KEY && <StatusBadge options={VMS_STATUSES} value={s.status} />}
              </div>

              <div className="mt-4 flex items-end justify-between">
                <span className="text-3xl font-bold tabular-nums text-slate-900">{s.total}</span>
                <span className="text-xs text-slate-400">vacatures</span>
              </div>

              <div className="mt-3">
                <Split relevant={s.relevant} irrelevant={s.irrelevant} unknown={s.unknown} />
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-emerald-50 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-emerald-700/70">Relevant</dt>
                  <dd className="font-semibold tabular-nums text-emerald-700">{s.relevant}</dd>
                </div>
                <div
                  className={cn(
                    "rounded-lg py-1.5",
                    s.unknown > 0 ? "bg-amber-50" : "bg-slate-50",
                  )}
                >
                  <dt
                    className={cn(
                      "text-[10px] uppercase tracking-wide",
                      s.unknown > 0 ? "text-amber-700/70" : "text-slate-400",
                    )}
                  >
                    Te doen
                  </dt>
                  <dd
                    className={cn(
                      "font-semibold tabular-nums",
                      s.unknown > 0 ? "text-amber-700" : "text-slate-500",
                    )}
                  >
                    {s.unknown}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">Live</dt>
                  <dd className="font-semibold tabular-nums text-slate-600">{s.published}</dd>
                </div>
              </dl>

              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                Bekijk instroom
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-slate-500" /> Grote platformen die je nog niet hebt
            </CardTitle>
            <span className="text-sm text-slate-500">{missing.length} beschikbaar</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">
              De bekende inhuurdesks en VMS-platformen in de Nederlandse markt. Voeg er één toe en
              hij verschijnt hierboven als bron; de instroom loopt dan via de webhook, e-mail of
              een import.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {missing.map((p) => (
                <form
                  key={p.key}
                  action={addKnownConnector}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3"
                >
                  <input type="hidden" name="key" value={p.key} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                    <span className="line-clamp-1 text-xs text-slate-400">{p.description}</span>
                  </span>
                  <SubmitButton variant="outline" size="sm" pendingLabel="Bezig…">
                    <Plus className="h-3.5 w-3.5" /> Koppelen
                  </SubmitButton>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {leeg.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gekoppeld, nog geen instroom</CardTitle>
            <span className="text-sm text-slate-500">{leeg.length} koppeling(en)</span>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {leeg.map((s) => (
              <Link
                key={s.key}
                href={s.id ? `/connectors/${s.id}` : "/vacatures/importeren"}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3 text-sm hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
                  <Plug className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate">{s.name}</span>
                </span>
                <StatusBadge options={VMS_STATUSES} value={s.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
