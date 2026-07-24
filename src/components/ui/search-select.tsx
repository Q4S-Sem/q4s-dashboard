"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
}: {
  id?: string;
  name: string;
  options: SearchOption[];
  defaultValue?: string;
  placeholder?: string;
  emptyText?: string;
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
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q),
    );
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

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {open && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">{emptyText}</li>
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
                    i === active ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.sub && <span className="block truncate text-xs text-slate-400">{o.sub}</span>}
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
