"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutGrid, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { hubForPath, itemIsActive, type NavHub, type NavItem } from "./nav";
import { ConnectionStatus } from "./connection-status";
import { NotificationCenter } from "./notification-center";
import { AskAi } from "./ask-ai";
import { Avatar } from "./ui/avatar";
import type { Notifications } from "@/lib/notifications";
import { logout } from "@/app/login/actions";

function Brand({ logoSrc }: { logoSrc?: string | null }) {
  return (
    <Link
      href="/"
      aria-label="Naar de hub"
      className="flex items-center gap-2.5"
      title="Q4S Project Partners — naar de hub"
    >
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt="Q4S Project Partners"
          className="h-9 w-auto max-w-[220px] object-contain"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand-600 text-[11px] font-black tracking-tight text-white">
          Q4S
        </span>
      )}
    </Link>
  );
}

// Kleurrijk icoon-palet voor de zijmenu-items — cyclisch toegekend per hub, in
// vaste volgorde, zodat de kleuren stabiel zijn en het menu kleur krijgt i.p.v.
// grijs.
const NAV_ICON_COLORS = [
  "text-blue-600",
  "text-violet-600",
  "text-emerald-600",
  "text-amber-600",
  "text-rose-600",
  "text-cyan-600",
  "text-indigo-600",
  "text-orange-600",
  "text-teal-600",
  "text-fuchsia-600",
];

function HubNav({
  hub,
  onNavigate,
  badges,
}: {
  hub: NavHub;
  onNavigate?: () => void;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();

  // Vaste icoonkleur per item (op volgorde binnen de hub).
  const colorByHref = new Map<string, string>();
  hub.items.forEach((it, i) => colorByHref.set(it.href, NAV_ICON_COLORS[i % NAV_ICON_COLORS.length]));

  // Only the most specific matching item lights up, so a nested route like
  // /kandidaten/beschikbaar highlights "Beschikbaar" and not its parent
  // "Talentpool" (/kandidaten) as well.
  const matching = hub.items.filter((it) => itemIsActive(pathname, it));
  const activeHref = matching.reduce<string | null>(
    (best, it) => (best && best.length >= it.href.length ? best : it.href),
    null,
  );

  // Group consecutive items by their optional section heading.
  const groups: { section?: string; items: NavItem[] }[] = [];
  for (const item of hub.items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-4">
      {/* Eén doorlopende lijst: een streepje tussen elk item én tussen de secties. */}
      <div className="divide-y divide-ink-100">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.section && (
              <div
                className={cn(
                  "px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-300",
                  gi > 0 && "pt-4",
                )}
              >
                {group.section}
              </div>
            )}
            <div className="divide-y divide-ink-100">
              {group.items.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              const count = item.badge ? (badges?.[item.badge] ?? 0) : 0;
              const iconColor = colorByHref.get(item.href) ?? "text-ink-400";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    // Actief item krijgt een oranje balk aan de linkerkant —
                    // hetzelfde accentgebaar als de navigatie op q4s.nl.
                    "relative flex items-center gap-2.5 rounded-sm py-2.5 pl-4 pr-3 text-[13px] font-bold tracking-tight transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-800 hover:bg-ink-50",
                  )}
                >
                  <span
                    className={cn(
                      "absolute inset-y-1 left-0 w-[3px] rounded-full transition-colors",
                      active ? "bg-brand-600" : "bg-transparent",
                    )}
                  />
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-brand-600" : iconColor,
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {count > 0 && (
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold tabular-nums text-white">
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
    </nav>
  );
}

export function AppShell({
  children,
  badges,
  notifications,
  logoSrc,
  user,
}: {
  children: React.ReactNode;
  badges?: Record<string, number>;
  notifications?: Notifications;
  logoSrc?: string | null;
  user?: { name: string; role: string } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hub = hubForPath(pathname);
  const isHome = pathname === "/";

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b-2 border-ink-900 bg-white px-4 no-print">
        <Brand logoSrc={logoSrc} />
        {hub && (
          <button
            type="button"
            aria-label="Menu openen"
            onClick={() => setOpen(true)}
            className="rounded-sm p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {!isHome && (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-600 transition-colors hover:bg-ink-50 hover:text-brand-600"
          >
            <LayoutGrid className="h-4 w-4" /> Apps
          </Link>
        )}
        {/* Online-status links in de balk */}
        <ConnectionStatus />
        <div className="ml-auto flex items-center gap-2">
          {notifications && <NotificationCenter data={notifications} />}
          {user && (
            <div className="flex items-center gap-2.5 border-l border-ink-200 pl-3">
              <Avatar name={user.name} size="sm" />
              <span className="hidden flex-col items-start leading-tight sm:flex">
                <span className="text-[13px] font-bold tracking-tight text-ink-900">
                  {user.name}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-300">
                  {user.role === "ADMIN" ? "Beheerder" : "Gebruiker"}
                </span>
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  title="Uitloggen"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Uitloggen</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Contextual sidebar — only inside an app */}
      {hub && (
        <aside className="hidden border-r border-ink-200 bg-white no-print lg:fixed lg:bottom-0 lg:top-16 lg:flex lg:w-60 lg:flex-col">
          <div className="px-4 pb-3 pt-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-ink-900">
              {hub.label}
            </div>
            <span className="q4s-rule mt-2" />
          </div>
          <HubNav hub={hub} badges={badges} />
        </aside>
      )}

      {/* Mobile drawer */}
      {hub && open && (
        <div className="fixed inset-0 z-40 lg:hidden no-print">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white">
            <div className="flex items-center justify-between border-b-2 border-ink-900 px-5 py-4">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-ink-900">
                {hub.label}
              </span>
              <button
                type="button"
                aria-label="Menu sluiten"
                onClick={() => setOpen(false)}
                className="rounded-sm p-2 text-ink-600 hover:bg-ink-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <HubNav hub={hub} badges={badges} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className={cn(hub && "lg:pl-60")}>
        <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      {/* Globale AI-assistent (rechtsonder), op elke pagina */}
      <AskAi />
    </div>
  );
}
