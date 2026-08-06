"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "./online-status";

/**
 * Verbindingsstatus in de kopbalk. Leest dezelfde gedeelde status als het
 * offline-scherm, zodat het stipje nooit groen staat terwijl opslaan mislukt.
 */
export function ConnectionStatus() {
  const online = useOnline();

  // Online is de normale toestand en verdient dus geen aandacht: één klein
  // groen stipje, verder niets. Offline is wél belangrijk — dan groeit het uit
  // tot een duidelijke rode melding, want je werk wordt dan niet opgeslagen.
  if (online) {
    return (
      <span
        title="Online — wijzigingen worden direct opgeslagen"
        className="inline-flex h-9 w-6 items-center justify-center"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="sr-only">Online</span>
      </span>
    );
  }

  return (
    <span
      title="Offline — wijzigingen worden NIET opgeslagen tot je weer verbinding hebt"
      className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-red-50 px-2.5 text-[13px] font-semibold text-red-700 ring-1 ring-inset ring-red-200"
    >
      <WifiOff className="h-4 w-4 animate-pulse" />
      Offline
    </span>
  );
}
