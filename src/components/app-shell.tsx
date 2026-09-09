"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Home, LogOut, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { hubForPath, itemIsActive, type NavHub, type NavItem } from "./nav";
import { ConnectionStatus } from "./connection-status";
import { NotificationCenter } from "./notification-center";
import { AskAi } from "./ask-ai";
import { Avatar } from "./ui/avatar";
import type { Notifications } from "@/lib/notifications";
import { logout } from "@/app/login/actions";

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

  // Vaste icoonkleur per item — nu monochrome/rustig (Studio Admin-stijl).
  const colorByHref = new Map<string, string>();
  hub.items.forEach((it) => colorByHref.set(it.href, "text-ink-400"));

  // Only the most specific matching item lights up, so a nested route like
  // /kandidaten/beschikbaar highlights "Beschikbaar" and not its parent
  // "Talentpool" (/kandidaten) as well.
  const matching = hub.items.filter((it) => itemIsActive(pathname, it));
  const activeHref = matching.reduce<string | null>(
    (best, it) => (best && best.length >= it.href.length ? best : it.href),
    null,
  );

  // Group consecutive items by their optional section heading. `hidden` items
  // horen wel bij de hub (zijbalk + BackLink-label) maar niet in het menu; ze
  // vallen hier weg, vóór het groeperen, zodat een lege sectie ook geen kopje
  // achterlaat.
  const groups: { section?: string; items: NavItem[] }[] = [];
  for (const item of hub.items.filter((it) => !it.hidden)) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-5">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.section && (
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {group.section}
              </div>
            )}
            <div className="space-y-1.5">
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
                    // Elk item is een omlijnde pill (zoals de Werkplekken-knop).
                    // Bij klikken/actief tilt hij een klein stukje omhoog én wordt
                    // hij donkerder — vandaar transition-all + -translate-y.
                    "relative flex items-center gap-3 rounded-lg border px-3 py-2 text-[13px] font-medium shadow-sm transition-all duration-150 active:translate-y-0",
                    active
                      ? "-translate-y-0.5 border-brand-700 bg-brand-700 text-white shadow-md"
                      : "border-ink-200 bg-white text-ink-600 hover:-translate-y-0.5 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-white" : iconColor,
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                        active ? "bg-white/20 text-white" : "bg-ink-200 text-ink-700",
                      )}
                    >
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
  user,
}: {
  children: React.ReactNode;
  badges?: Record<string, number>;
  notifications?: Notifications;
  user?: { name: string; role: string } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hub = hubForPath(pathname);
  const isHome = pathname === "/";
  const HubIcon = hub?.icon;

  return (
    <div className="min-h-screen">
      {/* Top bar — links waar je bent, rechts één rustige groep met status,
          meldingen en wie er is ingelogd. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-ink-200 bg-white px-3 no-print sm:px-4">
        {hub && (
          <button
            type="button"
            aria-label="Menu openen"
            onClick={() => setOpen(true)}
            className="mr-0.5 rounded-sm p-2 text-ink-600 transition-colors hover:bg-ink-100 min-[900px]:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {/* Broodkruimel: waar je vandaan komt in het grijs, waar je nú bent in
            het zwart met het icoon van de werkplek. Vervangt het logo als
            oriëntatiepunt. */}
        {!isHome && (
          <Link
            href="/"
            title="Terug naar werkplekken"
            aria-label="Terug naar werkplekken"
            className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-[13px] font-medium text-ink-600 shadow-sm transition-colors hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900"
          >
            <Home className="h-4 w-4 text-ink-400 transition-colors group-hover:text-brand-600" />
            <span className="hidden sm:inline">Werkplekken</span>
          </Link>
        )}
        {hub && (
          <>
            {!isHome && (
              <ChevronRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-ink-200"
              />
            )}
            <span className="flex min-w-0 items-center gap-2 pl-0.5">
              {HubIcon && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-600">
                  <HubIcon className="h-[15px] w-[15px]" />
                </span>
              )}
              <span className="truncate text-[15px] font-semibold text-ink-900">
                {hub.label}
              </span>
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <ConnectionStatus />
          {notifications && <NotificationCenter data={notifications} />}
          {user && (
            <>
              <span aria-hidden className="mx-1.5 h-5 w-px bg-ink-200" />
              <span
                className="flex h-9 items-center gap-2 rounded-sm pl-1 pr-1.5"
                title={`${user.name} — ${user.role === "ADMIN" ? "Beheerder" : "Gebruiker"}`}
              >
                <Avatar name={user.name} size="sm" />
                <span className="hidden text-[13px] font-semibold text-ink-800 sm:inline">
                  {user.name}
                </span>
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  title="Uitloggen"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Uitloggen</span>
                </button>
              </form>
            </>
          )}
        </div>
      </header>

      {/* Contextual sidebar — only inside an app */}
      {hub && (
        <aside className="hidden border-r border-ink-200 bg-white no-print min-[900px]:fixed min-[900px]:bottom-0 min-[900px]:top-14 min-[900px]:flex min-[900px]:w-60 min-[900px]:flex-col">
          <HubNav hub={hub} badges={badges} />
          {user && (
            <div className="flex items-center gap-2.5 border-t border-ink-200 px-3 py-3">
              <Avatar name={user.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink-900">{user.name}</p>
                <p className="truncate text-[11px] text-ink-400">
                  {user.role === "ADMIN" ? "Beheerder" : "Gebruiker"}
                </p>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  title="Uitloggen"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Uitloggen</span>
                </button>
              </form>
            </div>
          )}
        </aside>
      )}

      {/* Mobile drawer */}
      {hub && open && (
        <div className="fixed inset-0 z-40 min-[900px]:hidden no-print">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white">
            <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
              <span className="text-[15px] font-semibold text-ink-900">{hub.label}</span>
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
      <div className={cn(hub && "min-[900px]:pl-60")}>
        <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      {/* Globale AI-assistent (rechtsonder), op elke pagina */}
      <AskAi />
    </div>
  );
}
