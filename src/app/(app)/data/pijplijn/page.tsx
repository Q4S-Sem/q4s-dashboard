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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { getCloudSummary, CLOUD_PROVIDER_LABEL, CLOUD_FOLDERS } from "@/lib/cloud";
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
    <div className="flex-1 rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            active ? "bg-emerald-50 text-emerald-600" : "bg-ink-100 text-ink-400",
          )}
        >
          {icon}
        </span>
        <span className="font-semibold text-ink-900">{title}</span>
      </div>
      <div className="mt-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold",
            active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
          )}
        >
          {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {active ? activeLabel : gatedLabel}
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-500">{detail}</p>
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
        <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-ink-300 lg:block" />
        <Stage
          icon={<FolderOpen className="h-5 w-5" />}
          title="Data-map"
          active
          activeLabel="Actief — lokaal"
          gatedLabel=""
          detail={`${mirroredFiles} bestanden geïndexeerd in ${categories.length} mappen · ${docCount} documenten`}
        />
        <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-ink-300 lg:block" />
        <Stage
          icon={<Server className="h-5 w-5" />}
          title="Supabase"
          active={supabase.active}
          activeLabel="Draait op Supabase"
          gatedLabel={supabase.configured ? "Klaar — migratie nodig" : "Niet gekoppeld"}
          detail={supabase.host ? `Host: ${supabase.host}` : supabase.note}
        />
        <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-ink-300 lg:block" />
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
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div className="text-sm font-semibold text-ink-800">Data-map — per mapje</div>
            <div className="text-xs text-ink-500">
              {syncedCount} echt gesynct · {simulatedCount} klaargezet
            </div>
          </div>
          {categories.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ink-500">
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
                    <TD className="font-medium text-ink-900">{c.category}</TD>
                    <TD className="text-right tabular-nums text-ink-600">{c._count}</TD>
                    <TD className="text-right tabular-nums text-ink-600">
                      {fileSize(c._sum.size ?? 0)}
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-ink-500">
                      {c._max.createdAt ? formatDate(c._max.createdAt) : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Wat het dashboard zélf aanmaakt in OneDrive/SharePoint. */}
      <Card>
        <CardHeader>
          <CardTitle>Mappen die het dashboard aanmaakt</CardTitle>
          <span className="text-sm text-ink-400">
            in &ldquo;{cloud.rootFolder}&rdquo;
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-sm bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-800">
            Het dashboard schrijft <strong className="font-semibold">uitsluitend</strong> in de map{" "}
            <strong className="font-semibold">{cloud.rootFolder}</strong> en maakt daarin zijn eigen
            submappen aan. Mappen die al in OneDrive staan — Contracten Q4S, CV&rsquo;s, Klant
            gegevens en de rest — worden niet gelezen, niet gewijzigd en niet verwijderd. Ook binnen
            de eigen map wordt nooit een bestand overschreven: een gelijknamig bestand krijgt er een
            volgnummer bij.
          </p>

          <ul className="divide-y divide-ink-100 rounded-sm border border-ink-100">
            {CLOUD_FOLDERS.map((f) => (
              <li key={f.category} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                <code className="rounded-sm bg-ink-100 px-1.5 py-0.5 text-[13px] text-ink-800">
                  {cloud.rootFolder}/{f.category}
                </code>
                <span className="text-sm text-ink-500">{f.description}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-ink-400">
        De lokale schijf + het dashboard blijven altijd de bron. Supabase en OneDrive/SharePoint zijn
        extra kopieën die aanslaan zodra je ze koppelt — er gaat niets verloren in de tussentijd.
      </p>
    </div>
  );
}
