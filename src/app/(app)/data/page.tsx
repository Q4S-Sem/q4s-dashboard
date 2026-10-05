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
  HardHat,
  Building2,
  Briefcase,
  FolderOpen,
  BarChart3,
  Target,
  Archive,
  UserRound,
} from "lucide-react";
import { explorerConfig } from "@/lib/cloud";
import { graphList, veiligPad, type DriveItem } from "@/lib/onedrive";
import { matchtZoek } from "@/components/ui/tabel-zoek";
import { db } from "@/lib/db";
import { DOCUMENT_CATEGORIES } from "@/lib/domain";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nieuweMap, uploadNaarMap } from "./actions";
import { ZOEK_ICOON, ZOEK_INPUT } from "@/components/ui/tabel-zoek";

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
function icoon(it: Item) {
  if (it.icon) return { Icon: it.icon, kleur: it.isFolder ? "text-blue-500" : "text-ink-500" };
  if (it.isFolder) return { Icon: Folder, kleur: "text-blue-500" };
  const hit = SOORT.find(([re]) => re.test(it.name));
  return hit ? { Icon: hit[1], kleur: hit[2] } : { Icon: FileIcon, kleur: "text-ink-400" };
}

export default async function DataPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const pad = veiligPad(sp.pad);
  const cfg = await explorerConfig();

  // Eén verkenner over alles: de dashboard-mappen (werknemers, klanten,
  // plaatsingen, documenten, …) en — indien gekoppeld — de map OneDrive.
  const inOneDrive = pad === ONEDRIVE || pad.startsWith(`${ONEDRIVE}/`);
  const odPad = inOneDrive ? pad.slice(ONEDRIVE.length + 1) : "";
  const lijst = cfg && inOneDrive ? await graphList(cfg, odPad) : await dashboardMap(pad, Boolean(cfg));
  const items = lijst.ok ? lijst.items.filter((i) => matchtZoek(sp.q, i.name)) : [];
  const delen = pad ? pad.split("/") : [];
  const href = (p: string) => (p ? `/data?pad=${encodeURIComponent(p)}` : "/data");
  const ouder = delen.slice(0, -1).join("/");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Data</h1>
          <p className="text-[13px] text-ink-400">
            {inOneDrive ? "De Q4S-OneDrive — wat je hier doet, staat ook in OneDrive" : "Alle gegevens van het dashboard, per map"}
          </p>
        </div>
        {!cfg && (
          <Link href="/data/cloud" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Cloud className="h-4 w-4" /> OneDrive koppelen
          </Link>
        )}
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
          <Search className={ZOEK_ICOON} />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Zoek in deze map…"
            className={cn(ZOEK_INPUT, "w-64")}
          />
        </form>
        <nav aria-label="Pad" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-[13px]">
          <Link href="/data" className="flex items-center gap-1 rounded px-1.5 py-1 text-ink-600 hover:bg-ink-100">
            <Home className="h-3.5 w-3.5" /> Overzicht
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
        {cfg && inOneDrive && (<>
        <details className="relative">
          <summary className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
            <FolderPlus className="h-4 w-4" /> Nieuwe map
          </summary>
          <form action={nieuweMap} className="absolute right-0 z-20 mt-2 flex w-72 gap-2 rounded-lg border border-ink-200 bg-white p-3 shadow-lg">
            <input type="hidden" name="pad" value={odPad} />
            <input name="naam" required autoFocus placeholder="Naam van de map" className="h-8 flex-1 rounded-md border border-ink-200 px-2 text-sm" />
            <button className={buttonVariants({ size: "sm" })}>Maak</button>
          </form>
        </details>
        <details className="relative">
          <summary className={cn(buttonVariants({ size: "sm" }), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
            <Upload className="h-4 w-4" /> Uploaden
          </summary>
          <form action={uploadNaarMap} className="absolute right-0 z-20 mt-2 w-80 space-y-2 rounded-lg border border-ink-200 bg-white p-3 shadow-lg">
            <input type="hidden" name="pad" value={odPad} />
            <input name="file" type="file" multiple required className="block w-full text-sm" />
            <p className="text-xs text-ink-400">Komt in {odPad || "de hoofdmap van OneDrive"}. Bestaat de naam al, dan krijgt hij een nummer — er wordt nooit iets overschreven.</p>
            <button className={buttonVariants({ size: "sm" })}>Uploaden</button>
          </form>
        </details>
        </>)}
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
          Kon de map niet lezen: {lijst.error}
        </p>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-400">{sp.q ? "Niets gevonden in deze map." : "Deze map is leeg."}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
          {items.map((it: Item) => {
            const { Icon, kleur } = icoon(it);
            const inhoud = (
              <>
                <Icon className={cn("h-11 w-11", kleur)} strokeWidth={1.5} />
                <span className="mt-3 line-clamp-2 w-full break-words text-[13px] font-medium text-ink-900" title={it.name}>
                  {it.name}
                </span>
                <span className="mt-0.5 text-xs text-ink-400">
                  {it.isFolder
                    ? it.childCount == null
                      ? "openen"
                      : `${it.childCount} ${it.childCount === 1 ? "item" : "items"}`
                    : it.href
                      ? ""
                      : grootte(it.size)}
                </span>
                {it.sub && <span className="mt-0.5 line-clamp-1 text-xs text-ink-400">{it.sub}</span>}
              </>
            );
            const kaart = "flex flex-col items-center rounded-lg border border-ink-200 bg-white px-3 py-5 text-center transition hover:border-ink-300 hover:shadow-sm";
            // Map/record die naar een dashboardpagina gaat (klant, plaatsing, Analyses…).
            if (it.href)
              return (
                <Link key={it.id} href={it.href} className={kaart}>
                  {inhoud}
                </Link>
              );
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

type Item = DriveItem & {
  sub?: string;
  /** Opent deze dashboardpagina i.p.v. de map/het bestand. */
  href?: string;
  icon?: typeof FileIcon;
};

const ONEDRIVE = "OneDrive";
type Lijst = { ok: true; items: Item[] } | { ok: false; error: string };

const map = (name: string, aantal: number | null, extra: Partial<Item> = {}): Item => ({
  id: name, name, isFolder: true, size: 0, childCount: aantal, modified: null, webUrl: null, ...extra,
});
const record = (id: string, name: string, href: string, sub: string | undefined, icon: typeof FileIcon): Item => ({
  id, name, isFolder: false, size: 0, childCount: null, modified: null, webUrl: null, href, sub, icon,
});

/**
 * Het Overzicht als mappen:
 *   ""                       → Werknemers · Klanten · Plaatsingen · Documenten · Analyses · Marktkansen · Archief (· OneDrive)
 *   "Werknemers"/"Klanten"/"Plaatsingen" → één kaart per record, klik = dossier
 *   "Documenten/…"           → soort → werknemer → bestanden
 */
async function dashboardMap(pad: string, metOneDrive: boolean): Promise<Lijst> {
  const [top, ...rest] = pad ? pad.split("/") : [];
  if (!top) {
    const [werknemers, klanten, plaatsingen, documenten, kansen] = await Promise.all([
      db.consultant.count({ where: { active: true } }),
      db.client.count(),
      db.placement.count({ where: { status: { not: "ARCHIVED" } } }),
      db.document.count(),
      db.opportunity.count(),
    ]);
    return {
      ok: true,
      items: [
        map("Werknemers", werknemers, { icon: HardHat }),
        map("Klanten", klanten, { icon: Building2 }),
        map("Plaatsingen", plaatsingen, { icon: Briefcase }),
        map("Documenten", documenten, { icon: FolderOpen }),
        map("Analyses", null, { href: "/analyses", icon: BarChart3 }),
        map("Marktkansen", kansen, { href: "/marktkansen", icon: Target }),
        map("Archief", null, { href: "/archief", icon: Archive }),
        ...(metOneDrive ? [map(ONEDRIVE, null, { icon: Cloud })] : []),
      ],
    };
  }
  if (top === "Werknemers" && rest.length === 0) {
    const rows = await db.consultant.findMany({
      where: { active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, discipline: true, companyName: true },
    });
    return { ok: true, items: rows.map((c) => record(c.id, `${c.firstName} ${c.lastName}`, `/werknemers/${c.id}`, c.companyName ?? c.discipline, UserRound)) };
  }
  if (top === "Klanten" && rest.length === 0) {
    const rows = await db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true, city: true } });
    return { ok: true, items: rows.map((c) => record(c.id, c.companyName, `/klanten/${c.id}`, c.city ?? undefined, Building2)) };
  }
  if (top === "Plaatsingen" && rest.length === 0) {
    const rows = await db.placement.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        title: true,
        consultant: { select: { firstName: true, lastName: true } },
        client: { select: { companyName: true } },
      },
    });
    return {
      ok: true,
      items: rows.map((p) =>
        record(p.id, `${p.consultant.firstName} ${p.consultant.lastName}`, `/plaatsingen/${p.id}`, [p.client?.companyName, p.title].filter(Boolean).join(" · "), Briefcase),
      ),
    };
  }
  if (top === "Documenten") return documentenMap(rest.join("/"));
  return { ok: false, error: "Deze map bestaat niet." };
}

/** Dossierdocumenten: "" → soorten, "Contract" → werknemers, "Contract/Jan Jansen" → bestanden. */
async function documentenMap(pad: string): Promise<Lijst> {
  const [soortLabel, persoon] = pad ? pad.split("/") : [];
  const soort = DOCUMENT_CATEGORIES.find((c) => c.label === soortLabel);
  if (soortLabel && !soort) return { ok: false, error: "Deze map bestaat niet." };

  const docs = await db.document.findMany({
    where: soort ? { category: soort.value } : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      category: true,
      title: true,
      originalName: true,
      size: true,
      createdAt: true,
      consultant: { select: { firstName: true, lastName: true } },
    },
  });
  const naam = (d: (typeof docs)[number]) => `${d.consultant.firstName} ${d.consultant.lastName}`.trim();

  if (!soort) {
    return { ok: true, items: DOCUMENT_CATEGORIES.map((c) => map(c.label, docs.filter((d) => d.category === c.value).length)) };
  }
  if (!persoon) {
    const tel = new Map<string, number>();
    for (const d of docs) tel.set(naam(d), (tel.get(naam(d)) ?? 0) + 1);
    return { ok: true, items: [...tel].map(([n, a]) => map(n, a)).sort((a, b) => a.name.localeCompare(b.name, "nl")) };
  }
  return {
    ok: true,
    items: docs
      .filter((d) => naam(d) === persoon)
      .map((d) => ({
        id: d.id,
        name: d.originalName || d.title,
        isFolder: false,
        size: d.size,
        childCount: null,
        modified: d.createdAt.toISOString(),
        webUrl: `/api/documents/${d.id}`,
        sub: d.title !== d.originalName ? d.title : undefined,
      })),
  };
}
