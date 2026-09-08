import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { HUBS } from "@/components/nav";
import { getNavBadges } from "@/lib/facturatie";
import { getNotifications, hubActionCounts } from "@/lib/notifications";

export const metadata = { title: "Start" };
export const dynamic = "force-dynamic"; // live tellingen van openstaande acties

function AppCard({
  href,
  label,
  Icon,
  count = 0,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="group animate-card-in relative flex items-center gap-4 rounded-lg border border-ink-200 bg-white p-5 shadow-[0_1px_3px_0_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-900 hover:shadow-[0_16px_34px_-22px_rgb(0_0_0/0.65)]"
    >
      {/* Monochroom icoon in een grijs vlak — zoals de Facturatie-tegel. */}
      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-ink-100 bg-ink-50 transition-colors duration-200 group-hover:border-ink-900">
        <Icon className="h-8 w-8 text-ink-800 transition-transform duration-200 group-hover:scale-105" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-bold tracking-tight text-ink-900">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[14px] text-ink-400">
          {count > 0
            ? `${count} ${count === 1 ? "actie open" : "acties open"}`
            : "Bijgewerkt"}
        </span>
      </span>

      {/* Teller rechtsboven (alleen als er wat openstaat). */}
      {count > 0 && (
        <span
          className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-ink-900 px-2 text-sm font-bold tabular-nums text-white"
          title={`${count} openstaand${count === 1 ? "e melding" : "e meldingen"}`}
          aria-label={`${count} openstaande meldingen`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}

      {/* Pijl die bij hover naar buiten schuift. */}
      <ArrowUpRight className="h-5 w-5 shrink-0 text-ink-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink-900" />
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HUBS.map((h) => (
          <AppCard
            key={h.href}
            href={h.href}
            label={h.label}
            Icon={h.icon}
            count={counts[h.href] ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
