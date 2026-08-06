"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CANDIDATE_RATINGS } from "@/lib/domain";
import { setCandidateRating } from "./actions";

const TONE: Record<string, string> = {
  GOED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REDELIJK: "border-amber-200 bg-amber-50 text-amber-700",
  NIET_MEER: "border-red-200 bg-red-50 text-red-700",
  ONBEKEND: "border-ink-200 bg-white text-ink-600",
};
const DOT: Record<string, string> = {
  GOED: "bg-emerald-500",
  REDELIJK: "bg-amber-500",
  NIET_MEER: "bg-red-500",
  ONBEKEND: "bg-ink-300",
};

/**
 * Inline beoordeling-kiezer. De "balk" (knop) is licht afgerond; het uitklap-menu
 * is een afgerond, zwevend paneel (fixed-gepositioneerd, zodat de tabel-overflow
 * het niet afknipt). Kiezen slaat direct op.
 */
export function RatingSelect({
  id,
  value,
  className = "w-44",
}: {
  id: string;
  value: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(value);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const ratingRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCurrent(value), [value]);

  useEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      // Past het menu niet meer onder de knop (laatste kaarten in de lijst),
      // klap het dan omhoog — anders valt het onder de rand van het scherm en
      // kun je de opties niet aanklikken.
      const height = CANDIDATE_RATINGS.length * 36 + 16;
      const below = window.innerHeight - r.bottom;
      const up = below < height + 12 && r.top > below;
      setPos({
        top: up ? Math.max(8, r.top - 6 - height) : r.bottom + 6,
        left: r.left,
        width: r.width,
      });
    }

    const onDown = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const label =
    CANDIDATE_RATINGS.find((r) => r.value === current)?.label ?? "Niet beoordeeld";
  const tone = TONE[current] ?? TONE.ONBEKEND;

  function choose(v: string) {
    setOpen(false);
    if (v === current) return;
    setCurrent(v);
    if (ratingRef.current && formRef.current) {
      ratingRef.current.value = v;
      formRef.current.requestSubmit();
    }
  }

  return (
    <>
      <form ref={formRef} action={setCandidateRating} className="hidden">
        <input type="hidden" name="id" value={id} />
        <input ref={ratingRef} type="hidden" name="rating" defaultValue={current} />
      </form>

      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Beoordeling"
        aria-haspopup="menu"
        className={`inline-flex ${className} items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${tone}`}
      >
        <span className="inline-flex items-center gap-1.5 truncate">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[current] ?? DOT.ONBEKEND}`} />
          {label}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          role="listbox"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: Math.max(pos.width, 208),
          }}
          className="z-50 overflow-hidden rounded-xl border border-ink-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5"
        >
          {CANDIDATE_RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => choose(r.value)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-50"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[r.value] ?? DOT.ONBEKEND}`} />
              <span className="flex-1">{r.label}</span>
              {current === r.value && <Check className="h-4 w-4 text-emerald-600" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
