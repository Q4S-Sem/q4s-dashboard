import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Cloud,
  ExternalLink,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  File as FileIcon,
  Folder,
  FolderPlus,
  Home,
  Search,
  Upload,
} from "lucide-react";
import { explorerConfig } from "@/lib/cloud";
import { graphList, veiligPad, type DriveItem } from "@/lib/onedrive";
import { matchtZoek } from "@/components/ui/tabel-zoek";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nieuweMap, uploadNaarMap } from "./actions";

// ---------------------------------------------------------------------------
// DATA = de bestaande Q4S-OneDrive, rechtstreeks in het dashboard. Je bladert
// door dezelfde mappen als in Verkenner/OneDrive, opent bestanden in Office
// online, en wat je hier uploadt staat meteen ook in OneDrive. Eén bron: de
// bestanden leven in OneDrive, het dashboard kijkt mee.
// ---------------------------------------------------------------------------

export const metadata = { title: "Data" };
export const dynamic = "force-dynamic";

type SP = { pad?: string; q?: string; fout?: string; geupload?: string; map?: string };

function grootte(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

const SOORT: [RegExp, typeof FileIcon, string][] = [
  [/\.(pdf|docx?|txt|rtf)$/i, FileText, "text-red-500"],
  [/\.(xlsx?|csv)$/i, FileSpreadsheet, "text-emerald-600"],
  [/\.(png|jpe?g|gif|webp|heic)$/i, FileImage, "text-violet-500"],
  [/\.(zip|rar|7z)$/i, FileArchive, "text-amber-500"],
  [/\.(mp4|mov|avi)$/i, FileVideo, "text-pink-500"],
];
function icoon(it: DriveItem) {
  if (it.isFolder) return { Icon: Folder, kleur: "text-blue-500" };
  const hit = SOORT.find(([re]) => re.test(it.name));
  return hit ? { Icon: hit[1], kleur: hit[2] } : { Icon: FileIcon, kleur: "text-ink-400" };
}

export default async function DataPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const pad = veiligPad(sp.pad);
  const cfg = await explorerConfig();

  if (!cfg) return <NietGekoppeld />;

  const lijst = await graphList(cfg, pad);
  const items = lijst.ok ? lijst.items.filter((i) => matchtZoek(sp.q, i.name)) : [];
  const delen = pad ? pad.split("/") : [];
  const href = (p: string) => (p ? `/data?pad=${encodeURIComponent(p)}` : "/data");
  const ouder = delen.slice(0, -1).join("/");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Data</h1>
          <p className="text-[13px] text-ink-400">De Q4S-OneDrive — wat je hier doet, staat ook in OneDrive</p>
        </div>
      </div>

      {/* Werkbalk: terug, kruimelpad, zoeken, nieuwe map, uploaden */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 pb-4">
        <Link
          href={href(ouder)}
          aria-label="Map omhoog"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
            !pad && "pointer-events-none opacity-40",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <form method="get" className="relative">
          {pad && <input type="hidden" name="pad" value={pad} />}
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Zoek in deze map…"
            className="h-9 w-64 rounded-md border border-ink-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </form>
        <nav aria-label="Pad" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-[13px]">
          <Link href="/data" className="flex items-center gap-1 rounded px-1.5 py-1 text-ink-600 hover:bg-ink-100">
            <Home className="h-3.5 w-3.5" /> OneDrive
          </Link>
          {delen.map((d, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-ink-300" />
              <Link
                href={href(delen.slice(0, i + 1).join("/"))}
                className={cn("rounded px-1.5 py-1 hover:bg-ink-100", i === delen.length - 1 ? "font-semibold text-ink-900" : "text-ink-600")}
              >
                {d}
              </Link>
            </span>
          ))}
        </nav>
        <details className="relative">
          <summary className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
            <FolderPlus className="h-4 w-4" /> Nieuwe map
          </summary>
          <form action={nieuweMap} className="absolute right-0 z-20 mt-2 flex w-72 gap-2 rounded-lg border border-ink-200 bg-white p-3 shadow-lg">
            <input type="hidden" name="pad" value={pad} />
            <input name="naam" required autoFocus placeholder="Naam van de map" className="h-8 flex-1 rounded-md border border-ink-200 px-2 text-sm" />
            <button className={buttonVariants({ size: "sm" })}>Maak</button>
          </form>
        </details>
        <details className="relative">
          <summary className={cn(buttonVariants({ size: "sm" }), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
            <Upload className="h-4 w-4" /> Uploaden
          </summary>
          <form action={uploadNaarMap} className="absolute right-0 z-20 mt-2 w-80 space-y-2 rounded-lg border border-ink-200 bg-white p-3 shadow-lg">
            <input type="hidden" name="pad" value={pad} />
            <input name="file" type="file" multiple required className="block w-full text-sm" />
            <p className="text-xs text-ink-400">Komt in {pad || "de hoofdmap"}. Bestaat de naam al, dan krijgt hij een nummer — er wordt nooit iets overschreven.</p>
            <button className={buttonVariants({ size: "sm" })}>Uploaden</button>
          </form>
        </details>
      </div>

      {sp.geupload && Number(sp.geupload) > 0 && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          {sp.geupload} bestand{sp.geupload === "1" ? "" : "en"} geüpload naar OneDrive.
        </p>
      )}
      {sp.map && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">Map aangemaakt.</p>}
      {sp.fout && sp.fout !== "geen-koppeling" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">Niet gelukt: {sp.fout}</p>
      )}

      {!lijst.ok ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          OneDrive kon niet gelezen worden: {lijst.error}
        </p>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-400">{sp.q ? "Niets gevonden in deze map." : "Deze map is leeg."}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
          {items.map((it) => {
            const { Icon, kleur } = icoon(it);
            const inhoud = (
              <>
                <Icon className={cn("h-11 w-11", kleur)} strokeWidth={1.5} />
                <span className="mt-3 line-clamp-2 w-full break-words text-[13px] font-medium text-ink-900" title={it.name}>
                  {it.name}
                </span>
                <span className="mt-0.5 text-xs text-ink-400">
                  {it.isFolder ? `${it.childCount ?? 0} items` : grootte(it.size)}
                </span>
              </>
            );
            const kaart = "flex flex-col items-center rounded-lg border border-ink-200 bg-white px-3 py-5 text-center transition hover:border-ink-300 hover:shadow-sm";
            return it.isFolder ? (
              <Link key={it.id} href={href([pad, it.name].filter(Boolean).join("/"))} className={kaart}>
                {inhoud}
              </Link>
            ) : (
              <a key={it.id} href={it.webUrl ?? "#"} target="_blank" rel="noopener noreferrer" className={cn(kaart, "relative")}>
                <ExternalLink className="absolute right-2 top-2 h-3.5 w-3.5 text-ink-300" />
                {inhoud}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NietGekoppeld() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-10 text-center">
      <Cloud className="mx-auto h-12 w-12 text-ink-300" />
      <h1 className="text-xl font-semibold text-ink-900">OneDrive is nog niet gekoppeld</h1>
      <p className="text-sm text-ink-500">
        Zodra de koppeling staat, zie je hier dezelfde mappen als in OneDrive en komt alles wat je uploadt ook daar te staan.
      </p>
      <Link href="/data/cloud" className={buttonVariants({})}>
        Koppeling instellen
      </Link>
    </div>
  );
}
