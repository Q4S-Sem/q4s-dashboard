"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CANDIDATE_INTERVIEW_STATUSES } from "@/lib/domain";
import { setCandidateInterview } from "./actions";

const TONE: Record<string, string> = {
  DONE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PLANNED: "border-amber-200 bg-amber-50 text-amber-700",
  NONE: "border-slate-200 bg-white text-slate-600",
};
const DOT: Record<string, string> = {
  DONE: "bg-emerald-500",
  PLANNED: "bg-amber-500",
  NONE: "bg-slate-300",
};

/**
 * Inline interview-status-kiezer (met Q4S), gespiegeld aan de RatingSelect /
 * AvailabilitySelect. "Op interview geweest" zonder datum vult server-side
 * automatisch vandaag in. Het menu is fixed-gepositioneerd zodat de tabel-overflow
 * het niet afknipt.
 */
export function InterviewSelect({ id, value }: { id: string; value: string }) {
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
    CANDIDATE_INTERVIEW_STATUSES.find((s) => s.value === current)?.label ?? "Nog niet";
  const tone = TONE[current] ?? TONE.NONE;

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
      <form ref={formRef} action={setCandidateInterview} className="hidden">
        <input type="hidden" name="id" value={id} />
        <input ref={valueRef} type="hidden" name="interviewStatus" defaultValue={current} />
      </form>

      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Interview-status"
        aria-haspopup="menu"
        className={`inline-flex w-44 items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${tone}`}
      >
        <span className="inline-flex items-center gap-1.5 truncate">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[current] ?? DOT.NONE}`} />
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
          className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5"
        >
          {CANDIDATE_INTERVIEW_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => choose(s.value)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[s.value] ?? DOT.NONE}`} />
              <span className="flex-1">{s.label}</span>
              {current === s.value && <Check className="h-4 w-4 text-emerald-600" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
