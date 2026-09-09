"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, CheckCircle2, RefreshCw } from "lucide-react";

// Hoe vaak we de live server-versie checken.
const POLL_MS = 45_000;
// Sessievlag: na een reload door een update tonen we kort "bijgewerkt ✓".
const DONE_FLAG = "q4s-update-done";

type Phase = "idle" | "available" | "applying" | "done";

/**
 * Onderaan-melding "Er is een nieuwe update". Pollt /api/version; verandert de
 * build-sha (nieuwe Vercel-deploy), dan verschijnt een melding met een animerend
 * laad-icoon terwijl de update op JOUW dashboard wordt toegepast (reload), gevolgd
 * door een korte bevestiging "Je dashboard is bijgewerkt".
 */
export function UpdateNotifier() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [mounted, setMounted] = useState(false);
  const baseline = useRef<string | null>(null);
  const applied = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Net terug van een update-reload? Toon kort de bevestiging.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DONE_FLAG)) {
      sessionStorage.removeItem(DONE_FLAG);
      setPhase("done");
      const t = setTimeout(() => setPhase("idle"), 5000);
      return () => clearTimeout(t);
    }
  }, []);

  // Pas de update daadwerkelijk toe: spinner tonen, dan herladen.
  function apply() {
    if (applied.current) return;
    applied.current = true;
    setPhase("applying");
    try {
      sessionStorage.setItem(DONE_FLAG, "1");
    } catch {
      // sessionStorage kan geblokkeerd zijn — dan gewoon herladen.
    }
    // Even de spinner laten zien, dan de nieuwe versie laden.
    setTimeout(() => window.location.reload(), 1800);
  }

  useEffect(() => {
    let stop = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (!version || stop) return;
        if (baseline.current === null) {
          baseline.current = version; // eerste meting = referentie
          return;
        }
        if (version !== baseline.current) {
          // Nieuwe deploy gezien.
          setPhase((p) => (p === "idle" ? "available" : p));
        }
      } catch {
        // netwerk even weg — stil overslaan, volgende poll probeert opnieuw
      }
    }

    check();
    const iv = setInterval(check, POLL_MS);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, []);

  // Zodra de update is gezien: automatisch toepassen (met zichtbare spinner).
  useEffect(() => {
    if (phase === "available") {
      const t = setTimeout(apply, 900);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (!mounted || phase === "idle") return null;

  const isDone = phase === "done";

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-4 z-[130] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={[
          "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg",
          "animate-[updatein_0.35s_cubic-bezier(0.22,1,0.36,1)_both]",
          isDone
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-ink-200 bg-ink-900 text-white",
        ].join(" ")}
      >
        {isDone ? (
          <>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span className="text-sm font-medium">Je dashboard is bijgewerkt naar de nieuwste versie.</span>
          </>
        ) : (
          <>
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-white/90" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Er is een nieuwe update</p>
              <p className="text-xs text-white/70">
                {phase === "applying"
                  ? "Bezig met toepassen op jouw dashboard…"
                  : "Wordt zo automatisch toegepast op jouw dashboard…"}
              </p>
            </div>
            <button
              type="button"
              onClick={apply}
              className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/25"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Nu vernieuwen
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes updatein{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>,
    document.body,
  );
}
