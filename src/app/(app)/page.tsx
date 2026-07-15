import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { HUBS } from "@/components/nav";
import { getNavBadges } from "@/lib/facturatie";
import { getNotifications, hubActionCounts } from "@/lib/notifications";
import { APP_ICONS } from "./AppIcons";

export const metadata = { title: "Start" };
export const dynamic = "force-dynamic"; // live tellingen van openstaande acties

function AppTile({
  href,
  label,
  Fallback,
  count = 0,
}: {
  href: string;
  label: string;
  Fallback: LucideIcon;
  count?: number;
}) {
  const Custom = APP_ICONS[href];
  return (
    <Link href={href} className="group flex w-40 flex-col items-center gap-3.5 text-center">
      {/* Witte tegel met het kleurrijke icoon erin */}
      <span className="relative flex h-40 w-40 items-center justify-center rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/5 transition group-hover:-translate-y-1 group-hover:shadow-lg">
        {Custom ? (
          <Custom className="h-20 w-20" />
        ) : (
          <Fallback className="h-16 w-16 text-slate-700" />
        )}
        {/* Cijfer-badge rechtsboven: hoeveel er nog openstaat aan acties/meldingen */}
        {count > 0 && (
          <span
            className="absolute right-2.5 top-2.5 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-red-500 px-2 text-sm font-bold tabular-nums text-white shadow-md ring-2 ring-white"
            title={`${count} openstaand${count === 1 ? "e melding" : "e meldingen"}`}
            aria-label={`${count} openstaande meldingen`}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="text-base font-medium text-slate-700 group-hover:text-slate-900">
        {label}
      </span>
    </Link>
  );
}

export default async function StartPage() {
  const [badges, notifications] = await Promise.all([getNavBadges(), getNotifications()]);
  const counts = hubActionCounts(badges, notifications);

  return (
    <div className="flex justify-center pt-4 sm:pt-10">
      {/* Gecentreerd grid met vaste tegels (Odoo-stijl) */}
      <div className="grid w-fit grid-cols-2 gap-x-10 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {HUBS.map((h) => (
          <AppTile
            key={h.href}
            href={h.href}
            label={h.label}
            Fallback={h.icon}
            count={counts[h.href] ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
