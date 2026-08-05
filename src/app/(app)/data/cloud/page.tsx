import { Cloud, FolderTree, RefreshCw, CheckCircle2, CircleDot, HardDrive, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { getCloudSummary, CLOUD_FOLDERS } from "@/lib/cloud";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { SubmitButton } from "@/components/ui/submit-button";
import { CloudForm } from "./CloudForm";
import { syncExistingData } from "./actions";

export const metadata = { title: "SharePoint & OneDrive" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; color: "green" | "slate" | "red" }> = {
  SYNCED: { label: "Gesynct", color: "green" },
  SIMULATED: { label: "Klaargezet", color: "slate" },
  ERROR: { label: "Fout", color: "red" },
};

const PROVIDER_META: Record<string, { label: string; color: "blue" | "cyan" }> = {
  ONEDRIVE: { label: "OneDrive", color: "blue" },
  SHAREPOINT: { label: "SharePoint", color: "cyan" },
};

export default async function CloudPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; synced?: string }>;
}) {
  const sp = await searchParams;
  const [settings, summary, logs, counts] = await Promise.all([
    getCompanySettings(),
    getCloudSummary(),
    db.cloudSyncLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.cloudSyncLog.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const live = summary.live;
  const countBy = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const synced = countBy("SYNCED");
  const simulated = countBy("SIMULATED");
  const errors = countBy("ERROR");
  const total = synced + simulated + errors;

  const targetLabels = summary.targets.map((t) => PROVIDER_META[t.provider]?.label ?? t.provider);
  const targetsText = targetLabels.join(" én ");
  const copies = 1 + summary.targets.length; // dashboard + elk platform

  return (
    <div className="space-y-6">
      <PageHeader
        title="SharePoint & OneDrive"
        description="Alles wat je in het dashboard zet, wordt automatisch dubbel weggezet — netjes gesorteerd in mappen op OneDrive én SharePoint. De lokale opslag blijft altijd de bron."
      />

      {sp.saved && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Koppeling opgeslagen.
        </p>
      )}
      {sp.synced && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {sp.synced === "0"
            ? "Alles was al veiliggesteld — niets nieuws te synchroniseren."
            : `✓ ${sp.synced} bestand(en) opgeslagen in het dashboard én ${live ? "verstuurd" : "klaargezet"} naar ${targetsText}.`}
        </p>
      )}

      {/* MELDING — de garantie dat niets verloren gaat */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold text-emerald-900">
              Niets gaat verloren — elk bestand wordt {copies}× bewaard.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> In het dashboard (bron)
              </span>
              {summary.targets.map((t) => (
                <span
                  key={t.provider}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-medium text-emerald-800 ring-1 ring-emerald-200"
                >
                  <CheckCircle2 className={`h-4 w-4 ${t.live ? "text-emerald-600" : "text-ink-300"}`} />
                  Op {PROVIDER_META[t.provider]?.label ?? t.provider}
                  {!t.live && <span className="text-xs font-normal text-ink-400">(klaargezet)</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                live ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              <Cloud className="h-6 w-6" />
            </span>
            <div>
              <p className="font-semibold text-ink-900">
                {live
                  ? `Gekoppeld — ${targetsText}`
                  : summary.enabled
                    ? "Koppeling aan, gegevens onvolledig"
                    : "Nog niet gekoppeld — klaarzet-modus"}
              </p>
              <p className="text-sm text-ink-500">
                {live
                  ? `Bestanden worden dubbel gespiegeld naar "${summary.rootFolder}"${
                      summary.source === "env" ? " (via server-instellingen)" : ""
                    }.`
                  : "Alle uploads worden alvast gesorteerd en gelogd; vul de koppeling hieronder in om echt te verzenden."}
              </p>
            </div>
          </div>
          <Badge color={live ? "green" : "amber"}>{live ? "Actief" : "Klaarzet-modus"}</Badge>
        </CardContent>
      </Card>

      {/* Cijfers */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Gespiegelde kopieën" value={total} icon={<HardDrive className="h-5 w-5" />} accent="brand" />
        <StatCard label={live ? "Gesynct" : "Klaargezet"} value={live ? synced : simulated} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <StatCard label="Fouten" value={errors} icon={<CircleDot className="h-5 w-5" />} accent={errors ? "red" : "slate"} />
      </div>

      {/* Mapindeling — alle mapjes onder elkaar, elk dubbel gekoppeld */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-brand-600" /> Mapindeling
          </CardTitle>
          <form action={syncExistingData}>
            <SubmitButton size="sm" variant="outline" pendingLabel="Synchroniseren…">
              <RefreshCw className="h-4 w-4" /> Bestaande data nu veiligstellen
            </SubmitButton>
          </form>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-ink-500">
            Alles wat je in het dashboard zet, komt automatisch in deze mappen onder{" "}
            <span className="font-medium text-ink-700">{summary.rootFolder}</span> — en elke map is
            doorgekoppeld aan {targetsText}:
          </p>
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {CLOUD_FOLDERS.map((f) => (
              <li key={f.category} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                <FolderTree className="h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-800">
                    {summary.rootFolder} / {f.category}
                  </p>
                  <p className="text-xs text-ink-500">{f.description}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {summary.targets.map((t) => (
                    <Badge key={t.provider} color={PROVIDER_META[t.provider]?.color ?? "slate"}>
                      {PROVIDER_META[t.provider]?.label ?? t.provider}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Koppeling instellen */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Koppeling instellen
        </h2>
        <CloudForm
          initial={{
            enabled: settings.cloudEnabled,
            provider: settings.cloudProvider,
            tenantId: settings.cloudTenantId,
            clientId: settings.cloudClientId,
            driveUser: settings.cloudDriveUser,
            siteId: settings.cloudSiteId,
            driveId: settings.cloudDriveId,
            rootFolder: settings.cloudRootFolder,
          }}
          hasSecret={Boolean(settings.cloudClientSecret)}
        />
      </div>

      {/* Sync-log */}
      <Card>
        <CardHeader>
          <CardTitle>Recent veiliggesteld</CardTitle>
          <span className="text-sm text-ink-400">laatste {logs.length}</span>
        </CardHeader>
        {logs.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Nog niets gespiegeld. Upload een document of klik “Bestaande data nu veiligstellen”.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Bestand</TH>
                <TH>Map</TH>
                <TH>Platform</TH>
                <TH>Status</TH>
                <TH>Wanneer</TH>
              </TR>
            </THead>
            <TBody>
              {logs.map((l) => {
                const meta = STATUS_META[l.status] ?? STATUS_META.SIMULATED;
                const pm = PROVIDER_META[l.provider];
                return (
                  <TR key={l.id}>
                    <TD className="max-w-[14rem] truncate font-medium text-ink-800" title={l.originalName}>
                      {l.originalName}
                    </TD>
                    <TD className="max-w-[18rem] truncate text-ink-500" title={l.folder}>
                      {l.folder}
                    </TD>
                    <TD>
                      <Badge color={pm?.color ?? "slate"}>{pm?.label ?? l.provider}</Badge>
                    </TD>
                    <TD>
                      <Badge color={meta.color}>{meta.label}</Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-ink-500">{formatDate(l.createdAt)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
