"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "./online-status";
import { cn } from "@/lib/utils";

/**
 * Verbindingsstatus in de kopbalk. Leest dezelfde gedeelde status als het
 * offline-scherm, zodat het stipje nooit groen staat terwijl opslaan mislukt.
 */
export function ConnectionStatus() {
  const online = useOnline();

  // Online is de normale toestand en verdient dus geen aandacht: één klein
  // groen stipje, verder niets. Offline is wél belangrijk — dan groeit het uit
  // tot een duidelijke rode melding, want je werk wordt dan niet opgeslagen.
  // Eén vak in de knoppengroep rechtsboven: groen stipje + "Online", of rood
  // "Offline" als je werk niet wordt opgeslagen.
  return (
    <span
      title={online ? "Online — wijzigingen worden direct opgeslagen" : "Offline — wijzigingen worden NIET opgeslagen tot je weer verbinding hebt"}
      className={cn("inline-flex h-full items-center gap-1.5 px-2.5 text-[12px] font-medium", online ? "text-ink-500" : "bg-red-50 font-semibold text-red-700")}
    >
      {online ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 animate-pulse" />}
      <span className={online ? "hidden sm:inline" : ""}>{online ? "Online" : "Offline"}</span>
    </span>
  );
}
