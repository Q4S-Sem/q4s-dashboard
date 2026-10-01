import Link from "next/link";
import { cn } from "@/lib/utils";

export type TegelToon = "slate" | "blue" | "green" | "amber" | "red" | "violet";

const TOON: Record<TegelToon, string> = {
  slate: "bg-ink-100 text-ink-600",
  blue: "bg-blue-100 text-blue-600",
  green: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  red: "bg-red-100 text-red-600",
  violet: "bg-violet-100 text-violet-600",
};

export type FilterTegel = {
  key: string;
  label: string;
  waarde: React.ReactNode;
  icon: React.ReactNode;
  toon: TegelToon;
  href: string;
  actief: boolean;
  /** Waarde in rood (bv. te laat). */
  rood?: boolean;
};

/**
 * Eén smalle rij tegels die tegelijk teller én filter zijn — dezelfde rij als
 * op Week verwerken, zodat elke facturatie-lijst hetzelfde leest.
 */
export function FilterTegels({ items, label }: { items: FilterTegel[]; label: string }) {
  return (
    <nav
      aria-label={label}
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", items.length > 4 ? "xl:grid-cols-6" : "xl:grid-cols-4")}
    >
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          aria-current={t.actief ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg border bg-white px-3 py-2 transition-colors hover:border-ink-300",
            t.actief ? "border-ink-900 ring-1 ring-ink-900" : "border-ink-200",
          )}
        >
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", TOON[t.rood ? "red" : t.toon])}>
            {t.icon}
          </span>
          <span className="min-w-0">
            <span className={cn("block text-base font-semibold leading-tight tabular-nums", t.rood ? "text-red-700" : "text-ink-900")}>
              {t.waarde}
            </span>
            <span className="block truncate text-[11px] text-ink-500">{t.label}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

/** Kop zoals Week verwerken: titel + één regel links, acties rechts. */
export function PaginaKop({
  titel,
  sub,
  children,
}: {
  titel: string;
  sub: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{titel}</h1>
        <p className="text-[13px] text-ink-400">{sub}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
