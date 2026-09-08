"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  weekSlotVanKey,
  vorigeWeek,
  volgendeWeek,
  weekKeyVanDatum,
  weekBereikLabel,
  weekVanLabel,
} from "@/lib/wizard-weeknav";

// ---------------------------------------------------------------------------
// DE WEEKNAVIGATOR — de leidende weekfilter van "Week verwerken".
//
// "Vorige week"  ·  [ Week 37 · 7 sep – 13 sep 2026  📅 ]  ·  "Volgende week"
//                              week van 07-09-2026 · huidige week
//
// De eigenaar kiest hier de week waarin hij werkt en stapt er met de pijlen
// doorheen; de kalenderknop springt naar een willekeurige week. Alle
// weekberekening zit in src/lib/wizard-weeknav.ts (getest); dit is puur beeld.
// ---------------------------------------------------------------------------

export function WeekNavigator({
  week,
  onWeek,
  huidigeWeekKey,
}: {
  /** De gekozen weeksleutel, bv. "2026-W37". */
  week: string;
  /** Een andere week gekozen (via pijl of kalender). */
  onWeek: (weekKey: string) => void;
  /** De lopende week — om "huidige week" te tonen. */
  huidigeWeekKey?: string | null;
}) {
  const dateRef = useRef<HTMLInputElement>(null);
  const slot = weekSlotVanKey(week);
  const vorige = vorigeWeek(slot);
  const volgende = volgendeWeek(slot);
  const isHuidig = !!huidigeWeekKey && week === huidigeWeekKey;

  const knop =
    "inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-2 text-[13px] font-semibold text-ink-800 shadow-sm transition-colors hover:border-ink-300 hover:bg-ink-50 disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={knop}
          onClick={() => vorige && onWeek(vorige.key)}
          disabled={!vorige}
          aria-label="Vorige week"
        >
          <ChevronLeft className="h-4 w-4" /> Vorige week
        </button>

        {/* Midden: de gekozen week + het datumbereik, met een verborgen native
            date-input eronder zodat de kalenderknop echt een week laat kiezen. */}
        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-ink-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-700 shadow-sm transition-colors hover:bg-ink-50"
            onClick={() => {
              const el = dateRef.current;
              if (!el) return;
              // showPicker() waar beschikbaar; anders focus als terugval.
              if (typeof el.showPicker === "function") el.showPicker();
              else el.focus();
            }}
            aria-label="Kies een week via de kalender"
          >
            {slot ? (
              <>
                <span>Week {slot.isoWeek}</span>
                <span className="text-ink-400">·</span>
                <span className="text-ink-900">{weekBereikLabel(slot)}</span>
              </>
            ) : (
              <span className="text-ink-400">Geen week gekozen</span>
            )}
            <CalendarDays className="h-4 w-4 text-ink-400" />
          </button>
          <input
            ref={dateRef}
            type="date"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0 w-full opacity-0"
            tabIndex={-1}
            aria-hidden
            value={slot?.monday ?? ""}
            onChange={(e) => {
              const key = weekKeyVanDatum(e.target.value);
              if (key) onWeek(key);
            }}
          />
        </div>

        <button
          type="button"
          className={knop}
          onClick={() => volgende && onWeek(volgende.key)}
          disabled={!volgende}
          aria-label="Volgende week"
        >
          Volgende week <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {slot && (
        <p className="text-[11px] text-ink-400">
          {weekVanLabel(slot)}
          {isHuidig ? " · huidige week" : ""}
        </p>
      )}
    </div>
  );
}
