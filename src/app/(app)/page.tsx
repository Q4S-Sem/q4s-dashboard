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
      {/* Witte tegel met het kleurrijke icoon erin — strakke hoeken zoals
          q4s.nl, rand die zwart wordt bij hover. */}
      <span className="relative flex h-40 w-40 items-center justify-center rounded-md border border-ink-100 bg-white transition-all duration-200 group-hover:-translate-y-1 group-hover:border-ink-900 group-hover:shadow-[0_14px_30px_-20px_rgb(0_0_0/0.6)]">
        {/* Oranje hoekaccent dat uitgroeit bij hover */}
        <span className="absolute inset-x-0 top-0 h-[3px] w-0 bg-brand-600 transition-all duration-200 group-hover:w-full" />
        {Custom ? (
          <Custom className="h-20 w-20 transition-transform duration-200 group-hover:scale-105" />
        ) : (
          <Fallback className="h-16 w-16 text-ink-700 transition-transform duration-200 group-hover:scale-105" />
        )}
        {/* Cijfer-badge rechtsboven: hoeveel er nog openstaat aan acties/meldingen */}
        {count > 0 && (
          <span
            className="absolute right-2.5 top-2.5 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-brand-600 px-2 text-sm font-black tabular-nums text-white ring-2 ring-white"
            title={`${count} openstaand${count === 1 ? "e melding" : "e meldingen"}`}
            aria-label={`${count} openstaande meldingen`}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="text-[15px] font-bold tracking-tight text-ink-700 group-hover:text-brand-600">
        {label}
      </span>
    </Link>
  );
}

export default async function StartPage() {
  const [badges, notifications] = await Promise.all([getNavBadges(), getNotifications()]);
  const counts = hubActionCounts(badges, notifications);
  const open = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-6xl pt-2 sm:pt-6">
      {/* Kop in de stijl van q4s.nl: oranje bovenlabel, zware kop, streepje */}
      <header className="mb-10 text-center">
        <p className="q4s-eyebrow">Q4S Project Partners</p>
        <h1 className="q4s-display mt-3 text-[clamp(30px,5vw,52px)]">
          Waar wil je aan werken?
        </h1>
        <span className="q4s-rule mx-auto mt-5" />
        <p className="mt-5 text-sm text-ink-400">
          {open > 0
            ? `${open} ${open === 1 ? "actie staat" : "acties staan"} open — de oranje cijfers wijzen de weg.`
            : "Alles is bijgewerkt. Kies een werkplek om te beginnen."}
        </p>
      </header>

      {/* Gecentreerd grid met vaste tegels */}
      <div className="flex justify-center">
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
    </div>
  );
}
