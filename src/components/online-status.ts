"use client";

import { useEffect, useState } from "react";

/**
 * Eén gedeelde waarheid over "hebben we verbinding?".
 *
 * Zowel het stipje in de kopbalk, het offline-scherm als de verzendwachtrij
 * moeten hetzelfde denken — anders zie je een groen stipje terwijl je opslaan
 * mislukt. Daarom één poller op moduleniveau met abonnees, in plaats van een
 * eigen timer per component.
 *
 * `navigator.onLine` alleen is niet genoeg: dat staat ook op `true` bij een
 * wifi-verbinding zonder internet. Daarom pollen we /api/ping.
 */

let online = true;
let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(v: boolean) => void>();

/** Snel opnieuw proberen zolang we offline zijn, rustig als alles goed gaat. */
const INTERVAL_ONLINE = 8000;
const INTERVAL_OFFLINE = 2500;

function publish(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((l) => l(next));
}

async function probe() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    publish(false);
  } else {
    try {
      // Korte deadline: een verbinding die blijft hangen is voor de gebruiker
      // net zo goed offline.
      const ac = new AbortController();
      const bail = setTimeout(() => ac.abort(), 4000);
      const res = await fetch("/api/ping", { cache: "no-store", signal: ac.signal });
      clearTimeout(bail);
      publish(res.ok);
    } catch {
      publish(false);
    }
  }
  schedule();
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(probe, online ? INTERVAL_ONLINE : INTERVAL_OFFLINE);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void probe();
  window.addEventListener("online", () => void probe());
  window.addEventListener("offline", () => publish(false));
}

/** Directe uitlezing buiten React om (event-handlers, verzendwachtrij). */
export function isOnlineNow(): boolean {
  return online;
}

/** Abonneer een component op de verbindingsstatus. */
export function useOnline(): boolean {
  const [value, setValue] = useState(true);

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(online);
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);

  return value;
}
