import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { HUBS } from "@/components/nav";
import { getNavBadges } from "@/lib/facturatie";
import { getNotifications, hubActionCounts } from "@/lib/notifications";
import { APP_ICONS } from "./AppIcons";

export const metadata = { title: "Start" };
export const dynamic = "force-dynamic"; // live tellingen van openstaande acties

function AppCard({
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
    <Link
      href={href}
      className="group animate-card-in relative flex items-center gap-4 rounded-lg border border-ink-200 bg-white p-4 shadow-[0_1px_3px_0_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-900 hover:shadow-[0_16px_34px_-22px_rgb(0_0_0/0.65)]"
    >
      {/* Icoon-chip: rustig grijs vlak dat bij hover zwart wordt. */}
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 transition-colors duration-200 group-hover:border-ink-900">
        {Custom ? (
          <Custom className="h-9 w-9 transition-transform duration-200 group-hover:scale-105" />
        ) : (
          <Fallback className="h-7 w-7 text-ink-700 transition-transform duration-200 group-hover:scale-105" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold tracking-tight text-ink-900">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-400">
          {count > 0
            ? `${count} ${count === 1 ? "actie open" : "acties open"}`
            : "Bijgewerkt"}
        </span>
      </span>

      {/* Teller rechtsboven (alleen als er wat openstaat). */}
      {count > 0 && (
        <span
          className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-ink-900 px-1.5 text-[13px] font-bold tabular-nums text-white"
          title={`${count} openstaand${count === 1 ? "e melding" : "e meldingen"}`}
          aria-label={`${count} openstaande meldingen`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}

      {/* Pijl die bij hover naar buiten schuift. */}
      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink-900" />
    </Link>
  );
}

export default async function StartPage() {
  const [badges, notifications] = await Promise.all([getNavBadges(), getNotifications()]);
  const counts = hubActionCounts(badges, notifications);
  const open = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-6xl pt-2 sm:pt-4">
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-ink-900">
          Waar wil je aan werken?
        </h1>
        <p className="mt-1 text-[15px] text-ink-500">
          {open > 0
            ? `${open} ${open === 1 ? "actie staat" : "acties staan"} open — de tellers wijzen de weg.`
            : "Alles is bijgewerkt. Kies een werkplek om te beginnen."}
        </p>
      </header>

      {/* Linksuitgelijnd kaartraster — vult de breedte, geen losse gecentreerde iconen. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HUBS.map((h) => (
          <AppCard
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
