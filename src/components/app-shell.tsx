"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, ChevronRight, ChevronsUpDown, LayoutGrid, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { hubForPath, itemIsActive, visibleItems, accessibleHubs, type NavHub, type NavItem, type UserAccess } from "./nav";
import { ConnectionStatus } from "./connection-status";
import { NotificationCenter } from "./notification-center";
import { AskAi, ASK_AI_EVENT } from "./ask-ai";
import { Avatar } from "./ui/avatar";
import type { Notifications } from "@/lib/notifications";
import { logout } from "@/app/login/actions";

// ---------------------------------------------------------------------------
// App-schil (zwart · lichtgrijs · wit): een vaste lichtgrijze zijbalk met
// bovenin de werkplek-wisselaar, daaronder het menu van die werkplek en
// onderaan wie er is ingelogd. Rechts een witte werkruimte met een dunne
// bovenbalk (broodkruimel + meldingen). Zo zie je altijd waar je bent en kom je
// met één klik in een andere werkplek, zonder eerst terug naar het startscherm.
// ---------------------------------------------------------------------------

const ITEM = "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-100";
const ITEM_AAN = "bg-ink-200/70 font-semibold text-ink-900";
const ITEM_UIT = "font-medium text-ink-600 hover:bg-ink-200/40 hover:text-ink-900";

/** Het actieve menu-item: de meest specifieke match; een verborgen scherm laat het item erboven oplichten. */
function actiefItem(pathname: string, hub: NavHub): NavItem | null {
  const best = hub.items
    .filter((it) => itemIsActive(pathname, it))
    .reduce<NavItem | null>((b, it) => (b && b.href.length >= it.href.length ? b : it), null);
  let idx = best ? hub.items.indexOf(best) : -1;
  while (idx >= 0 && hub.items[idx].hidden) idx--;
  return idx >= 0 ? hub.items[idx] : null;
}

function HubNav({
  hub,
  onNavigate,
  badges,
  access,
}: {
  hub: NavHub;
  onNavigate?: () => void;
  badges?: Record<string, number>;
  access?: UserAccess | null;
}) {
  const pathname = usePathname();
  const actief = actiefItem(pathname, hub);

  // Opeenvolgende items met dezelfde sectie vormen één groep; verborgen items en
  // items zonder toegang vallen vóór het groeperen weg (geen leeg kopje).
  const groups: { section?: string; items: NavItem[] }[] = [];
  for (const item of visibleItems(hub, access).filter((it) => !it.hidden)) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }

  return (
    <div className="space-y-4">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.section && <div className="px-2.5 pb-1 text-[11px] font-medium text-ink-400">{group.section}</div>}
          <div className="space-y-px">
            {group.items.map((item) => {
              const active = item.href === actief?.href;
              const Icon = item.icon;
              const count = item.badge ? (badges?.[item.badge] ?? 0) : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(ITEM, active ? ITEM_AAN : ITEM_UIT)}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-ink-900" : "text-ink-400")} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {count > 0 && (
                    <span className="rounded-sm bg-white px-1.5 text-[11px] font-semibold tabular-nums text-ink-600 ring-1 ring-ink-200">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Op het startscherm: alle werkplekken als menu. */
function HubLijst({ hubs, onNavigate }: { hubs: NavHub[]; onNavigate?: () => void }) {
  return (
    <div>
      <div className="px-2.5 pb-1 text-[11px] font-medium text-ink-400">Werkplekken</div>
      <div className="space-y-px">
        {hubs.map((h) => {
          const Icon = h.icon;
          return (
            <Link key={h.href} href={h.start ?? h.href} onClick={onNavigate} className={cn(ITEM, ITEM_UIT)}>
              <Icon className="h-4 w-4 shrink-0 text-ink-400" />
              <span className="min-w-0 flex-1 truncate">{h.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Werkplek-wisselaar bovenin de zijbalk: huidige werkplek, klik = alle werkplekken. */
function WerkplekKiezer({ hub, hubs, onNavigate }: { hub: NavHub | null; hubs: NavHub[]; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const weg = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", weg);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", weg);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const sluit = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2.5 rounded-md px-1.5 text-left transition-colors hover:bg-ink-200/50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/cv/q4s-logo.png" alt="Q4S Project Partners" width={900} height={652} className="h-7 w-auto shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-tight text-ink-900">{hub?.label ?? "Werkplekken"}</span>
          <span className="block truncate text-[11px] leading-tight text-ink-400">Q4S Project Partners</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-400" />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-dialog-in absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-ink-200 bg-white p-1 shadow-lg"
        >
          <Link href="/" role="menuitem" onClick={sluit} className={cn(ITEM, ITEM_UIT)}>
            <LayoutGrid className="h-4 w-4 text-ink-400" /> Alle werkplekken
          </Link>
          <div className="my-1 h-px bg-ink-100" />
          {hubs.map((h) => {
            const Icon = h.icon;
            const aan = h.href === hub?.href;
            return (
              <Link key={h.href} href={h.start ?? h.href} role="menuitem" onClick={sluit} className={cn(ITEM, aan ? ITEM_AAN : ITEM_UIT)}>
                <Icon className={cn("h-4 w-4 shrink-0", aan ? "text-ink-900" : "text-ink-400")} />
                <span className="min-w-0 flex-1 truncate">{h.label}</span>
                {aan && <Check className="h-4 w-4 text-ink-900" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Zijbalk({
  hub,
  hubs,
  badges,
  access,
  user,
  onNavigate,
}: {
  hub: NavHub | null;
  hubs: NavHub[];
  badges?: Record<string, number>;
  access: UserAccess | null;
  user?: { name: string; role: string } | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* Even hoog als de bovenbalk (h-12) met dezelfde onderlijn: één doorlopende lijn. */}
      <div className="flex h-12 shrink-0 items-center border-b border-ink-300/60 px-2">
        <div className="w-full">
          <WerkplekKiezer hub={hub} hubs={hubs} onNavigate={onNavigate} />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {hub ? (
          <HubNav hub={hub} badges={badges} access={access} onNavigate={onNavigate} />
        ) : (
          <HubLijst hubs={hubs} onNavigate={onNavigate} />
        )}
      </nav>
      {user && (
        <div className="flex items-center gap-2.5 border-t border-ink-200 px-3 py-2.5">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink-900">{user.name}</p>
            <p className="truncate text-[11px] text-ink-400">{user.role === "ADMIN" ? "Beheerder" : "Gebruiker"}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Uitloggen"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-200/60 hover:text-ink-900"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Uitloggen</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export function AppShell({
  children,
  badges,
  notifications,
  user,
}: {
  children: React.ReactNode;
  badges?: Record<string, number>;
  notifications?: Notifications;
  user?: { name: string; role: string; allowedHubs?: string[]; allowedPages?: string[] } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const access: UserAccess | null = user
    ? { role: user.role, allowedHubs: user.allowedHubs ?? [], allowedPages: user.allowedPages ?? [] }
    : null;
  const hubs = accessibleHubs(access);
  const rawHub = hubForPath(pathname);
  // Geen toegang tot deze hub → geen menu (de server-guard stuurt toch al weg).
  const hub = rawHub && (access === null || hubs.some((h) => h.href === rawHub.href)) ? rawHub : null;
  const pagina = hub ? actiefItem(pathname, hub) : null;
  const hubStart = hub ? (hub.start ?? hub.href) : "/";

  return (
    <div className="min-h-screen bg-white">
      {/* Zijbalk (desktop) */}
      <aside className="no-print hidden border-r border-ink-200 bg-ink-50 min-[900px]:fixed min-[900px]:inset-y-0 min-[900px]:left-0 min-[900px]:z-30 min-[900px]:flex min-[900px]:w-60 min-[900px]:flex-col">
        <Zijbalk hub={hub} hubs={hubs} badges={badges} access={access} user={user} />
      </aside>

      {/* Zijbalk (mobiel, als lade) — dezelfde inhoud */}
      {open && (
        <div className="no-print fixed inset-0 z-40 min-[900px]:hidden">
          <div className="animate-overlay-in absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-ink-200 bg-ink-50">
            <Zijbalk hub={hub} hubs={hubs} badges={badges} access={access} user={user} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-[900px]:pl-60">
        {/* Bovenbalk: waar je bent (werkplek › pagina) + status en meldingen */}
        <header className="no-print sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-ink-200 bg-white/95 px-3 backdrop-blur sm:px-5">
          <button
            type="button"
            aria-label={open ? "Menu sluiten" : "Menu openen"}
            onClick={() => setOpen((o) => !o)}
            className="rounded-md p-1.5 text-ink-600 transition-colors hover:bg-ink-100 min-[900px]:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <nav aria-label="Broodkruimel" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
            {hub ? (
              <>
                <Link href={hubStart} className="truncate text-ink-500 transition-colors hover:text-ink-900">
                  {hub.label}
                </Link>
                {pagina && pagina.href !== hubStart && (
                  <>
                    <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                    <span className="truncate font-medium text-ink-900">{pagina.label}</span>
                  </>
                )}
              </>
            ) : (
              <span className="font-medium text-ink-900">Werkplekken</span>
            )}
          </nav>
          {/* Rechtsboven één knoppengroep: verbinding · AI-hulp · meldingen. */}
          <div className="ml-auto flex h-8 shrink-0 items-stretch divide-x divide-ink-200 rounded-md border border-ink-200 bg-white">
            <ConnectionStatus />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(ASK_AI_EVENT))}
              title="AI-hulp: stel een vraag over het dashboard"
              className="inline-flex items-center gap-1.5 px-2.5 text-[12px] font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">AI-hulp</span>
            </button>
            {notifications && <NotificationCenter data={notifications} />}
          </div>
        </header>

        <main className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      {/* Globale AI-assistent (rechtsonder), op elke pagina */}
      <AskAi />
    </div>
  );
}
