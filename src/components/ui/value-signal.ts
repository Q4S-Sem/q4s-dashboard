"use client";

import { useEffect, useRef } from "react";

/**
 * Laat een verborgen invoerveld een echte `change` afgeven zodra zijn waarde
 * wijzigt.
 *
 * De eigen keuzelijsten en datumvelden schrijven hun waarde via React naar een
 * `<input type="hidden">`. Zo'n programmatische wijziging geeft géén
 * input/change-gebeurtenis, waardoor alles wat op formulierwijzigingen luistert
 * — de waarschuwing bij weggaan, de concept-opslag — hem niet ziet. Deze hook
 * vuurt dat signaal alsnog af, één keer per echte waardewijziging.
 */
export function useValueSignal(
  ref: React.RefObject<HTMLInputElement | null>,
  value: string,
) {
  const vorige = useRef(value);

  useEffect(() => {
    if (vorige.current === value) return;
    vorige.current = value;
    ref.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [ref, value]);
}
