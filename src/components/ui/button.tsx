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

// q4s.nl-knop: strakke rechthoek, stevig vet, geen zware schaduw. Bij een klik
// zakt de knop 1px in zodat de actie voelbaar is.
const base =
  "inline-flex items-center justify-center gap-2 rounded-sm font-semibold tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 whitespace-nowrap cursor-pointer active:translate-y-px";

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "bg-ink-900 text-white hover:bg-ink-700",
  outline:
    "border border-ink-200 bg-white text-ink-800 hover:border-ink-900 hover:bg-ink-50",
  ghost: "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
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
