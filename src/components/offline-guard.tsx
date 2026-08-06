"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloudOff, RefreshCw, Check, TriangleAlert } from "lucide-react";
import { useOnline, isOnlineNow } from "./online-status";
import { cn } from "@/lib/utils";

/**
 * Vangnet als de verbinding wegvalt.
 *
 *  1. Er verschijnt een scherm-vullende melding: synchroniseren kan niet meer.
 *  2. Druk je tóch op opslaan, dan houden we het verzoek tegen in plaats van
 *     het te laten mislukken, en zetten we het in een wachtrij.
 *  3. Zodra de verbinding terug is gaat alles alsnog automatisch de deur uit.
 *
 * Wat je hebt ingetypt is los hiervan altijd veilig: FormAutosave bewaart elk
 * veld lokaal en zet het terug als je later terugkomt op die pagina.
 */

type Queued = { form: HTMLFormElement; submitter: HTMLElement | null };

export function OfflineGuard() {
  const online = useOnline();
  const [minimised, setMinimised] = useState(false);
  const [queued, setQueued] = useState(0);
  const [flushed, setFlushed] = useState(0);
  const pending = useRef<Queued[]>([]);
  const wasOffline = useRef(false);

  // --- 1. Verzenden tegenhouden zolang er geen verbinding is -----------------
  useEffect(() => {
    const onSubmit = (e: Event) => {
      if (isOnlineNow()) return;
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;

      // Tegenhouden vóór React de server-action afvuurt: die zou nu stilletjes
      // mislukken en het ingevulde scherm leeg achterlaten.
      e.preventDefault();
      e.stopImmediatePropagation();

      const submitter = (e as SubmitEvent).submitter ?? null;
      // Twee keer op dezelfde knop drukken mag niet twee keer versturen.
      const already = pending.current.findIndex((q) => q.form === form);
      if (already >= 0) pending.current[already] = { form, submitter };
      else pending.current.push({ form, submitter });

      setQueued(pending.current.length);
      setMinimised(false);
    };

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  // --- 2. Bij herstel alsnog versturen --------------------------------------
  const flush = useCallback(() => {
    const items = pending.current.filter((q) => q.form.isConnected);
    pending.current = [];
    setQueued(0);
    if (items.length === 0) return;

    setFlushed(items.length);
    // Eén voor één; de meeste acties navigeren na afloop, dus de rest is dan
    // meestal al niet meer aan de orde.
    for (const { form, submitter } of items) {
      const btn =
        submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
          ? submitter
          : null;
      try {
        form.requestSubmit(btn);
      } catch {
        form.requestSubmit();
      }
    }
  }, []);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinimised(false);
    flush();
  }, [online, flush]);

  // Melding "weer online" vanzelf laten verdwijnen.
  useEffect(() => {
    if (flushed === 0) return;
    const t = setTimeout(() => setFlushed(0), 6000);
    return () => clearTimeout(t);
  }, [flushed]);

  // Zolang we offline zijn de pagina niet laten wegscrollen achter het scherm.
  useEffect(() => {
    if (!online && !minimised) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [online, minimised]);

  if (typeof document === "undefined") return null;

  // --- Weer online, met verstuurde wijzigingen ------------------------------
  if (online) {
    if (flushed === 0) return null;
    return createPortal(
      <div className="no-print fixed bottom-5 left-1/2 z-[200] -translate-x-1/2">
        <div className="flex items-center gap-2.5 rounded-sm bg-emerald-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg">
          <Check className="h-4 w-4 shrink-0" />
          Weer verbonden — {flushed}{" "}
          {flushed === 1 ? "wijziging is alsnog verstuurd" : "wijzigingen zijn alsnog verstuurd"}.
        </div>
      </div>,
      document.body,
    );
  }

  // --- Offline, maar de gebruiker wil doorkijken ----------------------------
  // De balk staat bewust onderaan: een vaste balk over de kopbalk heen vangt de
  // klikken op de knoppen daaronder weg.
  if (minimised) {
    return createPortal(
      <button
        type="button"
        onClick={() => setMinimised(false)}
        className="no-print fixed inset-x-0 bottom-0 z-[200] flex items-center justify-center gap-2.5 bg-red-600 px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-red-700"
      >
        <TriangleAlert className="h-4 w-4 shrink-0" />
        Geen internetverbinding — er wordt niets opgeslagen
        {queued > 0 && ` · ${queued} in de wachtrij`}
        <span className="underline underline-offset-2">Bekijken</span>
      </button>,
      document.body,
    );
  }

  // --- Offline: scherm-vullende melding -------------------------------------
  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-titel"
      className="no-print fixed inset-0 z-[200] flex items-center justify-center bg-ink-900/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-md border border-ink-200 bg-white p-7 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <CloudOff className="h-8 w-8" />
        </div>

        <h2 id="offline-titel" className="mt-5 text-[22px] font-semibold text-ink-900">
          Geen synchronisatie mogelijk
        </h2>
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink-500">
          Er is geen internetverbinding, dus er kan niets naar de database
          worden opgeslagen. <strong className="font-semibold text-ink-800">Verbind met internet</strong> om
          verder te gaan.
        </p>

        <div className="mt-5 rounded-sm bg-ink-50 px-4 py-3.5 text-left text-[14px] leading-relaxed text-ink-600">
          Wat je hebt ingevuld blijft op dit apparaat staan
          {queued > 0 && (
            <>
              , en{" "}
              <strong className="font-semibold text-ink-900">
                {queued} {queued === 1 ? "wijziging staat" : "wijzigingen staan"} klaar
              </strong>
            </>
          )}
          . Zodra de verbinding terug is wordt alles automatisch alsnog
          verstuurd — je hoeft niets opnieuw in te typen.
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-[13px] font-medium text-ink-400">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Bezig met opnieuw verbinden…
        </p>

        <button
          type="button"
          onClick={() => setMinimised(true)}
          className={cn(
            "mt-5 text-[13px] font-medium text-ink-400 underline underline-offset-2",
            "transition-colors hover:text-ink-900",
          )}
        >
          Verder kijken zonder op te slaan
        </button>
      </div>
    </div>,
    document.body,
  );
}
