"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Klapt een keuzemenu omhoog als het naar beneden niet meer past.
 *
 * Onderaan een lange lijst (bv. de laatste kaarten in de Talentpool) viel het
 * menu anders onder de rand van het scherm: je zag de opties wel staan, maar je
 * kon ze niet aanklikken.
 *
 * Geeft `true` terug als het menu bóven de knop hoort te staan.
 */
export function useDropDirection(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  /** Geschatte hoogte van het menu in pixels. */
  height: number,
): boolean {
  const [up, setUp] = useState(false);

  useEffect(() => {
    if (!open) return;

    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const above = r.top;
      // Alleen omhoog als het beneden écht niet past én boven meer ruimte is.
      setUp(below < height && above > below);
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, ref, height]);

  return open && up;
}

/** Positieklassen voor het menu, op basis van de gekozen richting. */
export function dropClass(up: boolean): string {
  return up ? "bottom-full mb-1" : "top-full mt-1";
}
