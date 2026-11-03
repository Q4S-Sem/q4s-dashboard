import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-[13px]", className)}
        {...props}
      />
    </div>
  );
}

/** Eén tabelkop-stijl voor het hele dashboard (zoals Medewerkers): klein, uppercase, muted.
 *  `[&_button]`: sorteerknoppen erven anders geen uppercase/tracking (preflight). */
export const TABEL_KOP =
  "border-b border-ink-200 bg-ink-50 text-left text-[12px] font-medium text-ink-500 [&_button]:font-medium";

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        // Studio Admin-stijl kop: kleine uppercase labels, rustig en muted,
        // op een lichte achtergrond met een dunne onderrand.
        TABEL_KOP,
        className,
      )}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-ink-200/70", className)} {...props} />;
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  // `relative` + `group` staan er standaard op, zodat een <RowLink> in de rij
  // zich over de héle rij kan uitrekken. Kost niets als je 'm niet gebruikt.
  return (
    <tr
      className={cn("group relative transition-colors hover:bg-ink-50/80", className)}
      {...props}
    />
  );
}

/**
 * De naam-link in de eerste cel, die de hele rij klikbaar maakt.
 *
 * Het blijft één echte link (dus middelklik, "openen in nieuw tabblad" en
 * vooruitladen werken gewoon) — hij rekt alleen zijn klikvlak op tot de rand
 * van de rij. Knoppen en keuzelijsten verderop in de rij zetten we met
 * `relative z-10` erbovenop, zodat die hun eigen klik houden.
 */
export function RowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-medium text-ink-900 after:absolute after:inset-0 after:content-[''] group-hover:text-brand-600",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  // Spreadsheet-dichtheid: compacte rijen, cijfers op één lijn (tabular-nums).
  return <th className={cn("h-9 whitespace-nowrap px-4 font-medium", className)} {...props} />;
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-2.5 tabular-nums text-ink-700", className)} {...props} />;
}
