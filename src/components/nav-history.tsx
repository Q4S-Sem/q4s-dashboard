"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Onthoudt van welke pagina je kwam.
 *
 * Het dashboard hangt aan elkaar van flows: dezelfde kandidaat open je vanuit de
 * Talentpool, vanuit Binnengekomen CV's, vanuit een sollicitatie. Een vaste
 * "Terug naar talentpool" klopt dan maar in één van die gevallen. `BackLink`
 * leest wat hier is opgeslagen en wijst je terug naar waar je écht vandaan kwam.
 *
 * Per tabblad (sessionStorage), dus twee tabbladen zitten elkaar niet in de weg.
 */

export const NAV_CURRENT = "q4s-nav:current";
export const NAV_PREV = "q4s-nav:prev";

export function NavHistory() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const current = pathname + window.location.search;
      const previous = window.sessionStorage.getItem(NAV_CURRENT);
      // Alleen bij een échte paginawissel doorschuiven; een re-render mag de
      // geschiedenis niet met dezelfde pagina overschrijven.
      if (previous && previous.split("?")[0] !== pathname) {
        window.sessionStorage.setItem(NAV_PREV, previous);
      }
      window.sessionStorage.setItem(NAV_CURRENT, current);
    } catch {
      // Geen sessionStorage (privémodus) → dan valt BackLink terug op zijn
      // standaardbestemming. Nooit de navigatie hierop laten stuklopen.
    }
  }, [pathname]);

  return null;
}
