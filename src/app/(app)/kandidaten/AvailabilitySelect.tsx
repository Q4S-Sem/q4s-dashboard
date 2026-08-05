"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CANDIDATE_AVAILABILITY } from "@/lib/domain";
import { setCandidateAvailability } from "./actions";

const TONE: Record<string, string> = {
  BESCHIKBAAR: "border-emerald-200 bg-emerald-50 text-emerald-700",
  BINNENKORT: "border-amber-200 bg-amber-50 text-amber-700",
  NIET_BESCHIKBAAR: "border-red-200 bg-red-50 text-red-700",
  ONBEKEND: "border-ink-200 bg-white text-ink-600",
};
const DOT: Record<string, string> = {
  BESCHIKBAAR: "bg-emerald-500",
  BINNENKORT: "bg-amber-500",
  NIET_BESCHIKBAAR: "bg-red-500",
  ONBEKEND: "bg-ink-300",
};

/**
 * Inline beschikbaarheid-kiezer, gespiegeld aan de RatingSelect. Kiezen slaat
 * direct op. De datum "beschikbaar vanaf" wordt via het bewerk-formulier gezet;
 * hier zet je alleen snel de status. Het uitklap-menu is fixed-gepositioneerd,
 * zodat de tabel-overflow het niet afknipt.
 */
export function AvailabilitySelect({
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
  const valueRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCurrent(value), [value]);

  useEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width });

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
    CANDIDATE_AVAILABILITY.find((a) => a.value === current)?.label ?? "Onbekend";
  const tone = TONE[current] ?? TONE.ONBEKEND;

  function choose(v: string) {
    setOpen(false);
    if (v === current) return;
    setCurrent(v);
    if (valueRef.current && formRef.current) {
      valueRef.current.value = v;
      formRef.current.requestSubmit();
    }
  }

  return (
    <>
      <form ref={formRef} action={setCandidateAvailability} className="hidden">
        <input type="hidden" name="id" value={id} />
        <input ref={valueRef} type="hidden" name="availability" defaultValue={current} />
      </form>

      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Beschikbaarheid"
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
          {CANDIDATE_AVAILABILITY.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => choose(a.value)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-ink-50"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[a.value] ?? DOT.ONBEKEND}`} />
              <span className="flex-1">{a.label}</span>
              {current === a.value && <Check className="h-4 w-4 text-emerald-600" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
