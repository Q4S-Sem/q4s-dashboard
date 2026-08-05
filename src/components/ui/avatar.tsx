import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Ronde profielfoto met initialen als terugval.
 *
 * De kleur van de initialen-variant wordt afgeleid van de naam, zodat dezelfde
 * persoon overal in de app dezelfde kleur krijgt. Dat maakt lange lijsten en
 * de pipeline in één oogopslag scanbaar — en geeft het strakke, hoekige
 * ontwerp een vrolijke noot.
 */

const PALETTE = [
  "bg-brand-100 text-brand-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
} as const;

export type AvatarSize = keyof typeof sizeClasses;

/** Stabiele kleurkeuze op basis van de naam (geen willekeur, geen state). */
function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** "Jan de Vries" → "JV"; valt terug op de eerste letter of "?". */
export function initialsOf(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0 && !/^(van|de|der|den|het|te|ten|ter|du|la|le)$/i.test(p));
  if (parts.length === 0) return name.trim().slice(0, 1).toUpperCase() || "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = "md",
  ring = false,
  className,
}: {
  /** Volledige naam — bepaalt de initialen én de kleur. */
  name: string;
  /** Pad naar de profielfoto; leeg = initialen. */
  src?: string | null;
  size?: AvatarSize;
  /** Witte ring eromheen, voor gestapelde avatars of foto's op een kleurvlak. */
  ring?: boolean;
  className?: string;
}) {
  const base = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold tracking-tight select-none",
    sizeClasses[size],
    ring && "ring-2 ring-white",
    className,
  );

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        title={name}
        className={cn(base, "bg-ink-100 object-cover")}
      />
    );
  }

  return (
    <span className={cn(base, colorFor(name))} title={name} aria-label={name}>
      {initialsOf(name)}
    </span>
  );
}

/**
 * Overlappende rij avatars ("+3" als er meer zijn) — voor teams, kandidaten bij
 * een vacature of deelnemers aan een afspraak.
 */
export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: { name: string; src?: string | null }[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} name={p.name} src={p.src} size={size} ring />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-ink-900 font-bold text-white ring-2 ring-white",
            sizeClasses[size],
          )}
          title={`nog ${rest}`}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
