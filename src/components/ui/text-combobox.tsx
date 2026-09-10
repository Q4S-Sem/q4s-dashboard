"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "block w-full rounded-sm border border-ink-200 bg-white px-3 py-2 pr-9 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25";

/**
 * Een typebaar tekstveld met suggesties (vervangt de native <input list>). Je
 * kunt vrij typen (nieuwe waarde toegestaan — het veld zelf draagt de `name`,
 * dus wat er staat wordt ingediend) OF een bestaande naam uit de lijst kiezen.
 * Bij openen filtert de lijst op wat je typt; de lijst toont ~5 rijen en scrollt
 * daarna. Zo zie je niet meteen tientallen bedrijven, maar vind je ze snel.
 */
export function TextCombobox({
  id,
  name,
  options,
  defaultValue = "",
  required,
  placeholder,
}: {
  id?: string;
  name: string;
  options: string[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = text.trim().toLowerCase();
  const matches = q
    ? options.filter((o) => {
        const low = o.toLowerCase();
        return low.startsWith(q) || low.split(/\s+/).some((w) => w.startsWith(q)) || low.includes(q);
      })
    : options;

  function pick(value: string) {
    setText(value);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        name={name}
        type="text"
        value={text}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(matches.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && open && matches[active]) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={fieldBase}
      />
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

      {open && matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-[220px] w-full overflow-auto rounded-sm border border-ink-200 bg-white py-1 text-sm shadow-lg"
        >
          {matches.map((o, i) => (
            <li key={o}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={cn(
                  "block w-full truncate px-3 py-2 text-left transition-colors",
                  i === active ? "bg-ink-100 text-ink-900" : "text-ink-700 hover:bg-ink-50",
                )}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
