import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { accessibleHubs } from "@/components/nav";
import { getNavBadges } from "@/lib/facturatie";
import { getNotifications, hubActionCounts } from "@/lib/notifications";
import { currentUser } from "@/lib/session";

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
      className="group animate-card-in relative flex items-center gap-4 rounded-lg border border-ink-200 bg-white p-4 transition-colors duration-150 hover:border-ink-300 hover:bg-ink-50"
    >
      {/* Monochroom icoon in een grijs vlak — zoals de Facturatie-tegel. */}
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ink-200 bg-ink-50 transition-colors duration-150 group-hover:bg-white">
        <Icon className="h-5 w-5 text-ink-800" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink-900">
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
          className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-ink-900 px-1.5 text-xs font-semibold tabular-nums text-white"
          title={`${count} openstaand${count === 1 ? "e melding" : "e meldingen"}`}
          aria-label={`${count} openstaande meldingen`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}

      {/* Pijl die bij hover naar buiten schuift. */}
      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-300 transition-colors group-hover:text-ink-900" />
    </Link>
  );
}

export default async function StartPage() {
  const [badges, notifications, user] = await Promise.all([getNavBadges(), getNotifications(), currentUser()]);
  const counts = hubActionCounts(badges, notifications);
  const open = Object.values(counts).reduce((a, b) => a + b, 0);

  // Alleen de werkplekken tonen waar deze gebruiker toegang toe heeft (ADMIN: alles).
  const hubs = accessibleHubs(user);

  return (
    <div className="max-w-6xl">
      <header className="mb-6">
        <h1 className="q4s-display text-[22px]">
          Waar wil je aan werken?
        </h1>
        <p className="mt-1 text-[13px] text-ink-500">
          {open > 0
            ? `${open} ${open === 1 ? "actie staat" : "acties staan"} open — de tellers wijzen de weg.`
            : "Alles is bijgewerkt. Kies een werkplek om te beginnen."}
        </p>
      </header>

      {/* Linksuitgelijnd kaartraster — vult de breedte, geen losse gecentreerde iconen. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {hubs.map((h) => (
          <AppCard
            key={h.href}
            href={h.start ?? h.href}
            label={h.label}
            Icon={h.icon}
            count={counts[h.href] ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
