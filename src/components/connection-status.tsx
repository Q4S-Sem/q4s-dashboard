"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <span
      title={
        online
          ? "Online — wijzigingen worden direct in de database opgeslagen"
          : "Offline — wijzigingen worden NIET opgeslagen tot je weer verbinding hebt"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        online
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          online ? "bg-emerald-500" : "animate-pulse bg-red-500",
        )}
      />
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{online ? "Online" : "Offline"}</span>
    </span>
  );
}
