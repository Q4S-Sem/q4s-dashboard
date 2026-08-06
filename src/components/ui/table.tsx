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
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        // Kleine kapitalen met ruime spatiëring — het labelritme van q4s.nl.
        "border-b border-ink-200 bg-ink-50/60 text-left text-[13px] font-semibold text-ink-500",
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
  return <tbody className={cn("divide-y divide-ink-100", className)} {...props} />;
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  // `relative` + `group` staan er standaard op, zodat een <RowLink> in de rij
  // zich over de héle rij kan uitrekken. Kost niets als je 'm niet gebruikt.
  return (
    <tr
      className={cn("group relative transition-colors hover:bg-brand-50/50", className)}
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
  return <th className={cn("px-4 py-3 font-bold", className)} {...props} />;
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 text-ink-700", className)} {...props} />;
}
