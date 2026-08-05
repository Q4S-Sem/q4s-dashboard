"use client";

import { useEffect, useRef, useState } from "react";

const fieldBase =
  "block w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

/**
 * A free-text input with type-ahead suggestions from earlier values. You can pick
 * a suggestion or type anything — the typed text is what gets submitted (`name`).
 * No "create" step: it's free text, so a new value is simply saved as typed.
 */
export function TextAutocomplete({
  name,
  defaultValue,
  suggestions,
  placeholder,
  required,
}: {
  name: string;
  defaultValue?: string;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
}) {
  const [text, setText] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = text.trim().toLowerCase();
  const matches = (
    q
      ? suggestions.filter((s) => {
          const l = s.toLowerCase();
          return l !== q && l.includes(q);
        })
      : suggestions
  ).slice(0, 50);

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        name={name}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className={fieldBase}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 text-sm shadow-lg">
          {matches.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  setText(s);
                  setOpen(false);
                }}
                className="block w-full truncate px-3 py-2 text-left text-ink-700 hover:bg-ink-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
