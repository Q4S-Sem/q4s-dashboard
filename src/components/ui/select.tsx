"use client";

import * as React from "react";
import { ChevronsUpDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string; disabled?: boolean; color?: string };

/** BadgeColor-token → gekleurd stipje, voor opties met een `data-color`. */
const DOT_CLASS: Record<string, string> = {
  slate: "bg-ink-300",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
  orange: "bg-brand-600",
};

/** Flatten an option's children (e.g. `{firstName} {lastName}`) into one label. */
function labelOf(children: React.ReactNode): string {
  if (children == null || children === false) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(labelOf).join("");
  return "";
}

/** Read <option value>label</option> children into plain data. */
function readOptions(children: React.ReactNode): Opt[] {
  const out: Opt[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const p = child.props as {
      value?: string | number;
      disabled?: boolean;
      children?: React.ReactNode;
      "data-color"?: string;
    };
    const value = p.value === undefined ? "" : String(p.value);
    const label = labelOf(p.children) || value;
    out.push({ value, label, disabled: p.disabled, color: p["data-color"] });
  });
  return out;
}

/**
 * Rangschik opties op relevantie voor `query`: exact > begint-met > woord-begin >
 * bevat. Niet-matchende opties vallen weg; de beste match komt bovenaan. Lege
 * query → oorspronkelijke volgorde (ongewijzigd).
 */
function rankOptions(items: Opt[], query: string): Opt[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const scored: { o: Opt; i: number; score: number }[] = [];
  items.forEach((o, i) => {
    const label = o.label.toLowerCase();
    let score = -1;
    if (label === q) score = 0;
    else if (label.startsWith(q)) score = 1;
    else if (label.split(/[^a-z0-9]+/i).some((w) => w.startsWith(q))) score = 2;
    else if (label.includes(q)) score = 3;
    if (score >= 0) scored.push({ o, i, score });
  });
  // Gelijke score → oorspronkelijke volgorde behouden (stabiel).
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  return scored.map((s) => s.o);
}

const triggerBase =
  "flex w-full items-center justify-between gap-2 rounded-sm border border-ink-200 bg-white px-3 py-2 text-left text-sm text-ink-900 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-600 disabled:cursor-not-allowed disabled:bg-ink-50";

/**
 * Themed, rounded select that replaces the native one (whose popup the browser
 * renders un-stylable). Keeps the same <option>-children API + a hidden input,
 * so every existing form keeps working and submits identically.
 *
 * Bij lange lijsten (>6 opties) verschijnt automatisch een zoekveld: typ om te
 * filteren, de beste match springt naar boven en kleurt groen (minder scrollen).
 */
export function Select({
  id,
  name,
  defaultValue,
  disabled,
  className,
  children,
  onValueChange,
  ...rest
}: {
  id?: string;
  name?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onValueChange?: (value: string) => void;
  "aria-label"?: string;
}) {
  const options = React.useMemo(() => readOptions(children), [children]);
  const [value, setValue] = React.useState<string>(
    () => defaultValue ?? options[0]?.value ?? "",
  );
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Selectable (non-placeholder) options for the popup + keyboard nav.
  const items = React.useMemo(() => options.filter((o) => !o.disabled), [options]);
  const current = options.find((o) => o.value === value);
  // Zoekveld op élke keuzelijst met meer dan twee opties: typen filtert, de beste
  // match springt naar boven — scrollen hoeft dan niet meer. Alleen een echte
  // twee-keuze (ja/nee) blijft zonder zoekveld.
  const searchable = items.length > 2;
  const visible = React.useMemo(() => rankOptions(items, query), [items, query]);
  const searching = searchable && query.trim() !== "";

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Bij openen: reset de zoekterm, markeer de huidige waarde en focus het zoekveld.
  React.useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    const idx = items.findIndex((o) => o.value === value);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(idx >= 0 ? idx : 0);
    if (searchable) {
      const t = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function choose(v: string) {
    setValue(v);
    setOpen(false);
    setQuery("");
    onValueChange?.(v);
  }

  function onListKeys(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      // Sluit alleen de dropdown; laat een omliggende popover/dialog open.
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(visible.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = visible[active];
      if (o) choose(o.value);
    }
  }

  function onTriggerKeys(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    // Zonder zoekveld navigeer je met de knop zelf; mét zoekveld ligt de focus daar.
    if (!searchable) onListKeys(e);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={rest["aria-label"]}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeys}
        className={cn(triggerBase, open && "border-brand-600 ring-2 ring-brand-500/25")}
      >
        <span className={cn("flex items-center gap-2 truncate", !current?.value && "text-ink-300")}>
          {current?.color && DOT_CLASS[current.color] && (
            <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_CLASS[current.color])} />
          )}
          <span className="truncate">{current?.label ?? "—"}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-300" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-sm border border-ink-900 bg-white shadow-[0_16px_36px_-22px_rgb(0_0_0/0.55)]">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-ink-100 px-2.5 py-2">
              <Search className="h-4 w-4 shrink-0 text-ink-300" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKeys}
                placeholder="Typ om te zoeken…"
                autoComplete="off"
                className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none"
              />
            </div>
          )}
          <div className="max-h-60 overflow-auto p-1">
            {visible.length === 0 ? (
              <p className="px-2.5 py-3 text-center text-sm text-ink-300">Geen resultaten.</p>
            ) : (
              visible.map((o, i) => {
                const selected = o.value === value;
                const isActive = active === i;
                // Tijdens het zoeken kleurt de actieve rij (standaard de beste match
                // bovenaan) GROEN — zo zie je meteen wat Enter/klik selecteert.
                const green = searching && isActive;
                return (
                  <button
                    key={`${o.value}-${i}`}
                    type="button"
                    onClick={() => choose(o.value)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors",
                      green
                        ? "bg-emerald-50 font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200"
                        : selected
                          ? "bg-brand-50 font-bold text-brand-700"
                          : "text-ink-700",
                      !green && isActive && !selected && "bg-ink-100",
                      !green && isActive && selected && "bg-brand-100",
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {o.color && DOT_CLASS[o.color] && (
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_CLASS[o.color])} />
                      )}
                      <span className="truncate">{o.label}</span>
                    </span>
                    {selected && (
                      <Check
                        className={cn("h-4 w-4 shrink-0", green ? "text-emerald-600" : "text-brand-600")}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
