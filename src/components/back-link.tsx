"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { HUBS } from "./nav";
import { NAV_PREV } from "./nav-history";
import { cn } from "@/lib/utils";

/**
 * "Terug"-link die wijst naar de pagina waar je vandaan kwam.
 *
 * Open je dezelfde kandidaat vanuit Binnengekomen CV's, dan hoort de link terug
 * te gaan naar Binnengekomen CV's — niet naar de Talentpool omdat dat toevallig
 * de standaardbestemming is.
 *
 * Bewust behoudend: we springen alléén terug naar een pagina die in de
 * navigatie staat (een echte overzichtspagina). Kwam je van een detailpagina,
 * een formulier of rechtstreeks binnen via een link, dan blijft de meegegeven
 * standaard staan. Zo kan de knop nooit ergens onverwachts heen wijzen.
 */

/** Alle overzichtspagina's uit de navigatie: pad → naam. */
function navLabels(): Map<string, string> {
  const map = new Map<string, string>();
  for (const hub of HUBS) {
    map.set(hub.href, hub.label);
    for (const item of hub.items) map.set(item.href, item.label);
  }
  return map;
}

export function BackLink({
  href,
  children,
  className,
}: {
  /** Standaardbestemming als we niet weten waar je vandaan kwam. */
  href: string;
  /**
   * Waar de link standaard heen gaat, bv. "Terug naar talentpool". Staat niet
   * meer in beeld — de knop toont altijd alleen "Terug" — maar wordt gebruikt
   * als tooltip en voor schermlezers.
   */
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const [from, setFrom] = useState<{ href: string; label: string } | null>(null);

  useEffect(() => {
    let prev: string | null = null;
    try {
      prev = window.sessionStorage.getItem(NAV_PREV);
    } catch {
      return;
    }
    if (!prev) return;

    const [path] = prev.split("?");
    // Niet terugsturen naar de pagina zelf, en niet naar een onderliggende
    // pagina (bv. van /klanten/x/bewerken terug naar /klanten/x/bewerken).
    if (path === pathname || path.startsWith(`${pathname}/`)) return;
    // De standaardbestemming is al goed — dan niets bijzonders tonen.
    if (path === href) return;

    const label = navLabels().get(path);
    if (!label) return; // geen bekende overzichtspagina → standaard aanhouden

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrom({ href: prev, label });
  }, [pathname, href]);

  // In beeld staat alleen "Terug" — kort en overal gelijk. Waar hij naartoe
  // gaat lees je in de tooltip; dat scheelt een lange regel boven elke pagina.
  const destination = from
    ? `Terug naar ${from.label}`
    : typeof children === "string"
      ? children
      : "Terug";

  return (
    <Link
      href={from?.href ?? href}
      title={destination}
      aria-label={destination}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-900",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      Terug
    </Link>
  );
}
