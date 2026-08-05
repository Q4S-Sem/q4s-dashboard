"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shows whether the dashboard can reach the server (online) or not (offline).
 * Polls a tiny /api/ping endpoint and listens to the browser's online/offline
 * events. When offline, edits won't reach the database until you're back online.
 */
export function ConnectionStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let active = true;

    const check = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (active) setOnline(false);
        return;
      }
      try {
        const res = await fetch("/api/ping", { cache: "no-store" });
        if (active) setOnline(res.ok);
      } catch {
        if (active) setOnline(false);
      }
    };

    const first = setTimeout(check, 0);
    const id = setInterval(check, 5000);
    const onOnline = () => check();
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      active = false;
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

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
