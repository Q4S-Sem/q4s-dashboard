"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDropDirection, dropClass } from "./use-drop-direction";
import { Search, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchOption = { value: string; label: string; sub?: string };

/**
 * Zoekbare keuzelijst (combobox): typ om te filteren, kies met muis of toetsen.
 * De geselecteerde waarde staat in een verborgen input `name`, zodat het gewoon
 * met het formulier meekomt. Werkt ook prima met een lange lijst.
 */
export function SearchSelect({
  id,
  name,
  options,
  defaultValue = "",
  placeholder = "Typ om te zoeken…",
  emptyText = "Geen resultaten.",
  onValueChange,
}: {
  id?: string;
  name: string;
  options: SearchOption[];
  defaultValue?: string;
  placeholder?: string;
  emptyText?: string;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState(
    () => options.find((o) => o.value === defaultValue)?.label ?? "",
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const showAll = q === "" || (selected && query === selected.label);
    if (showAll) return options;
    // Rangschik op relevantie: exact > begint-met > woord-begin > bevat > sub bevat.
    // De beste match komt zo bovenaan (en kleurt groen).
    const scored: { o: SearchOption; i: number; score: number }[] = [];
    options.forEach((o, i) => {
      const label = o.label.toLowerCase();
      const sub = (o.sub ?? "").toLowerCase();
      let score = -1;
      if (label === q) score = 0;
      else if (label.startsWith(q)) score = 1;
      else if (label.split(/[^a-z0-9]+/i).some((w) => w.startsWith(q))) score = 2;
      else if (label.includes(q)) score = 3;
      else if (sub.includes(q)) score = 4;
      if (score >= 0) scored.push({ o, i, score });
    });
    scored.sort((a, b) => a.score - b.score || a.i - b.i);
    return scored.map((s) => s.o);
  }, [query, options, selected]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(o: SearchOption) {
    setValue(o.value);
    setQuery(o.label);
    setOpen(false);
    onValueChange?.(o.value);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[active]) {
        e.preventDefault();
        pick(filtered[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const up = useDropDirection(open, rootRef, 260);


  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setValue("");
            setOpen(true);
            setActive(0);
            onValueChange?.("");
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-ink-300 bg-white py-2 pl-9 pr-9 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      </div>

      {open && (
        <ul
          className={cn(
            "absolute z-30 max-h-60 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg",
            dropClass(up),
          )}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-400">{emptyText}</li>
          ) : (
            filtered.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                    i === active
                      ? query.trim()
                        ? "bg-emerald-50 font-medium text-emerald-700"
                        : "bg-brand-50 text-brand-800"
                      : "text-ink-700 hover:bg-ink-50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.sub && <span className="block truncate text-xs text-ink-400">{o.sub}</span>}
                  </span>
                  {o.value === value && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
