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
          className="h-12 w-auto max-w-[340px] object-contain"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-[11px] font-bold tracking-tight text-white">
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
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {/* Eén doorlopende lijst: een streepje tussen elk item én tussen de secties. */}
      <div className="divide-y divide-slate-100">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.section && (
              <div
                className={cn(
                  "px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400",
                  gi > 0 && "pt-3",
                )}
              >
                {group.section}
              </div>
            )}
            <div className="divide-y divide-slate-100">
              {group.items.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              const count = item.badge ? (badges?.[item.badge] ?? 0) : 0;
              const iconColor = colorByHref.get(item.href) ?? "text-slate-500";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-slate-900 transition-colors",
                    active ? "bg-slate-100" : "hover:bg-slate-50",
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", iconColor)} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {count > 0 && (
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-semibold tabular-nums text-white">
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
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 no-print">
        {hub && (
          <button
            type="button"
            aria-label="Menu openen"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {!isHome && (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 hover:bg-slate-100"
          >
            <LayoutGrid className="h-4 w-4" /> Apps
          </Link>
        )}
        {/* Online-status links in de balk */}
        <ConnectionStatus />
        <div className="ml-auto flex items-center gap-2">
          {notifications && <NotificationCenter data={notifications} />}
          {user && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
              <span className="hidden flex-col items-end leading-tight sm:flex">
                <span className="text-sm font-medium text-slate-900">{user.name}</span>
                <span className="text-[11px] text-slate-400">
                  {user.role === "ADMIN" ? "Beheerder" : "Gebruiker"}
                </span>
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  title="Uitloggen"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
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
        <aside className="hidden border-r border-slate-200 bg-white no-print lg:fixed lg:bottom-0 lg:top-16 lg:flex lg:w-60 lg:flex-col">
          <div className="px-5 pt-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-900">
            {hub.label}
          </div>
          <HubNav hub={hub} badges={badges} />
        </aside>
      )}

      {/* Mobile drawer */}
      {hub && open && (
        <div className="fixed inset-0 z-40 lg:hidden no-print">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <span className="text-sm font-semibold text-slate-900">{hub.label}</span>
              <button
                type="button"
                aria-label="Menu sluiten"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
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
