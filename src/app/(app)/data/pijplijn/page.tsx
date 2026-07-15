import Link from "next/link";
import {
  Database,
  FolderOpen,
  Cloud,
  Server,
  CheckCircle2,
  Clock,
  ArrowRight,
  Info,
} from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { getCloudSummary, CLOUD_PROVIDER_LABEL } from "@/lib/cloud";
import { getSupabaseStatus } from "@/lib/supabase";

export const metadata = { title: "Data-pijplijn" };
export const dynamic = "force-dynamic";

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function Stage({
  icon,
  title,
  active,
  activeLabel,
  gatedLabel,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  active: boolean;
  activeLabel: string;
  gatedLabel: string;
  detail: string;
}) {
  return (
    <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400",
          )}
        >
          {icon}
        </span>
        <span className="font-semibold text-slate-900">{title}</span>
      </div>
      <div className="mt-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
          )}
        >
          {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {active ? activeLabel : gatedLabel}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export default async function DataPijplijnPage() {
  const [cloud, consultants, candidates, clients, invoices, docCount, distinctFiles, byCategory] =
    await Promise.all([
      getCloudSummary(),
      db.consultant.count(),
      db.candidate.count(),
      db.client.count(),
      db.invoice.count(),
      db.document.count(),
      db.cloudSyncLog.findMany({ distinct: ["fileName"], select: { fileName: true } }),
      db.cloudSyncLog.groupBy({
        by: ["category"],
        _count: true,
        _sum: { size: true },
        _max: { createdAt: true },
      }),
    ]);
  const supabase = getSupabaseStatus();

  const [syncedCount, simulatedCount] = await Promise.all([
    db.cloudSyncLog.count({ where: { status: "SYNCED" } }),
    db.cloudSyncLog.count({ where: { status: "SIMULATED" } }),
  ]);

  const mirroredFiles = distinctFiles.length;
  const categories = [...byCategory].sort((a, b) => (b._count ?? 0) - (a._count ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data-pijplijn"
        description="Alles wat je in het dashboard aanmaakt stroomt via één route: Dashboard → Data-map → Supabase → OneDrive/SharePoint. Hier zie je per stap of het actief is of nog gekoppeld moet worden."
        actions={
          <Link href="/data/cloud" className={buttonVariants({ variant: "outline" })}>
            <Cloud className="h-4 w-4" /> Cloudkoppeling
          </Link>
        }
      />

      {/* De pijplijn */}
      <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
        <Stage
          icon={<Database className="h-5 w-5" />}
          title="Dashboard"
          active
          activeLabel="Actief — bron"
          gatedLabel=""
          detail={`${consultants} werknemers · ${candidates} kandidaten · ${clients} klanten · ${invoices} facturen`}
        />
        <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-slate-300 lg:block" />
        <Stage
          icon={<FolderOpen className="h-5 w-5" />}
          title="Data-map"
          active
          activeLabel="Actief — lokaal"
          gatedLabel=""
          detail={`${mirroredFiles} bestanden geïndexeerd in ${categories.length} mappen · ${docCount} documenten`}
        />
        <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-slate-300 lg:block" />
        <Stage
          icon={<Server className="h-5 w-5" />}
          title="Supabase"
          active={supabase.active}
          activeLabel="Draait op Supabase"
          gatedLabel={supabase.configured ? "Klaar — migratie nodig" : "Niet gekoppeld"}
          detail={supabase.host ? `Host: ${supabase.host}` : supabase.note}
        />
        <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-slate-300 lg:block" />
        <Stage
          icon={<Cloud className="h-5 w-5" />}
          title="OneDrive / SharePoint"
          active={cloud.live}
          activeLabel="Synct echt"
          gatedLabel={cloud.enabled ? "Ingesteld — sleutels nodig" : "Klaarzet-modus"}
          detail={`${CLOUD_PROVIDER_LABEL[cloud.choice] ?? cloud.choice} · map "${cloud.rootFolder}"`}
        />
      </div>

      {/* Uitleg gated */}
      {(!supabase.active || !cloud.live) && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <Info className="h-4 w-4" /> Nog te koppelen (de rest werkt gewoon door)
          </div>
          <ul className="ml-1 space-y-1">
            {!supabase.active && (
              <li>
                <strong>Supabase:</strong> {supabase.note} — zet{" "}
                <code className="rounded bg-amber-100 px-1">SUPABASE_DB_URL</code> in je .env.
              </li>
            )}
            {!cloud.live && (
              <li>
                <strong>OneDrive/SharePoint:</strong> vul de M365-koppeling in via{" "}
                <Link href="/data/cloud" className="font-medium underline">
                  Cloudkoppeling
                </Link>{" "}
                — tot die tijd wordt elke spiegel wél netjes gelogd (klaarzet-modus).
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Data-map index per mapje */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-semibold text-slate-800">Data-map — per mapje</div>
            <div className="text-xs text-slate-500">
              {syncedCount} echt gesynct · {simulatedCount} klaargezet
            </div>
          </div>
          {categories.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-500">
              Nog niets in de Data-map. Zodra je bestanden uploadt (dossiers, CV's, urenstaten,
              bonnetjes) verschijnen ze hier, gesorteerd per mapje.
            </p>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Mapje</TH>
                  <TH className="text-right">Spiegels</TH>
                  <TH className="text-right">Grootte</TH>
                  <TH>Laatst</TH>
                </TR>
              </THead>
              <TBody>
                {categories.map((c) => (
                  <TR key={c.category}>
                    <TD className="font-medium text-slate-900">{c.category}</TD>
                    <TD className="text-right tabular-nums text-slate-600">{c._count}</TD>
                    <TD className="text-right tabular-nums text-slate-600">
                      {fileSize(c._sum.size ?? 0)}
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-slate-500">
                      {c._max.createdAt ? formatDate(c._max.createdAt) : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        De lokale schijf + het dashboard blijven altijd de bron. Supabase en OneDrive/SharePoint zijn
        extra kopieën die aanslaan zodra je ze koppelt — er gaat niets verloren in de tussentijd.
      </p>
    </div>
  );
}
