import * as React from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success";
type Size = "sm" | "md" | "lg" | "icon";

// Studio Admin-knop: zacht afgeronde hoeken (~6px), stevig vet, subtiele schaduw
// op de gevulde varianten. Bij een klik zakt de knop 1px in zodat de actie
// voelbaar is.
const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 whitespace-nowrap cursor-pointer active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0";

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink-900 text-white shadow-sm hover:bg-ink-700",
  secondary: "bg-ink-100 text-ink-900 hover:bg-ink-200",
  outline:
    "border border-ink-200 bg-white text-ink-800 shadow-[0_1px_1px_rgb(0_0_0/0.04)] hover:border-ink-300 hover:bg-ink-50",
  ghost: "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-3.5 text-[13px]",
  lg: "h-10 px-5 text-sm",
  icon: "h-9 w-9",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(base, variantClasses[variant], sizeClasses[size], className);
}

/**
 * Icoonknoppen (Word, printen, leegmaken…) als één strak blokje: zet ze in een
 * `<div className={ICOON_GROEP}>` met elk `className={ICOON_KNOP}`.
 */
export const ICOON_GROEP =
  "inline-flex items-center divide-x divide-ink-200 overflow-hidden rounded-md border border-ink-200 bg-white shadow-sm";
export const ICOON_KNOP =
  "inline-flex h-[30px] w-9 items-center justify-center text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 disabled:pointer-events-none disabled:opacity-40 cursor-pointer [&_svg]:size-4";

/**
 * Gesegmenteerde schakelaar (periode, taal, weergave, documentsoort): ÉÉN stijl
 * in het hele dashboard. Zet de knoppen in een `<div className={SEGMENT_GROEP}>`.
 * Actief = zwart, net als de primaire knoppen; nooit een eigen kleur per pagina.
 */
export const SEGMENT_GROEP = "inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-ink-100 p-0.5";

export function segmentVariants(active: boolean, className?: string) {
  return cn(
    "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&_svg]:size-4 [&_svg]:shrink-0",
    active ? "bg-white text-ink-900 shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-ink-200" : "text-ink-500 hover:text-ink-900",
    className,
  );
}

/**
 * Mapje-tab (dossier- en lijst-tabbladen boven een kaart). -mb-px laat het tabje
 * over de lijn vallen (de lijn is een inset-schaduw op de balk, dus geen -mb-px
 * overflow die de rand afknipt of een scrollbalk geeft); de onderrand krijgt de paginakleur zodat het mapje "open" staat.
 */
export function mapTabVariants(active: boolean) {
  return cn(
    "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
    active ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-900",
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button className={buttonVariants({ variant, size, className })} {...props} />
  );
}

/** Bewerken = alleen een pen-icoon (grijs vlak), overal in het dashboard gelijk. */
export const BEWERK_ICOON =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-700 transition-colors hover:bg-ink-200 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
