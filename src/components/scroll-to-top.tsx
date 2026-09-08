"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scrollt bij elke paginawissel terug naar boven.
 *
 * Het dashboard scrollt in het window (de header is sticky, de zijbalk staat
 * vast). Zonder deze helper houdt de browser bij een client-side navigatie de
 * oude scrollpositie vast, waardoor je halverwege een nieuwe pagina binnenkomt.
 * Bij élke wissel van het pad springen we daarom naar de top — meteen (geen
 * smooth-animatie), zodat de pagina altijd bovenaan begint.
 *
 * Reageert op het PAD, niet op de query: filters/tabs die alleen de zoekopdracht
 * veranderen laten de scrollpositie met rust.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // De browser herstelt anders zelf een eerdere scrollpositie bij navigatie.
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
