"use client";

import { useEffect, useRef, useState } from "react";
import { useValueSignal } from "./value-signal";
import { useDropDirection, dropClass } from "./use-drop-direction";
import { Check, UserPlus, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboPerson = { id: string; name: string };

const fieldBase =
  "block w-full rounded-lg border border-ink-300 bg-white px-3 py-2 pr-9 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

/**
 * A typeable person picker. As you type it filters existing people; pick one to
 * submit its id (`name` field). If the typed name matches nobody, it is submitted
 * as a NEW person via the `createName` field — the server then adds it (Overig).
 */
export function PersonCombobox({
  name,
  createName,
  people,
  defaultId,
  defaultName,
  required,
  allowCreate,
  placeholder = "Typ of kies een naam…",
  onSelect,
}: {
  name: string;
  /** Verborgen veld voor een NIEUWE naam. Vereist als je nieuwe personen toestaat. */
  createName?: string;
  people: ComboPerson[];
  defaultId?: string;
  defaultName?: string;
  required?: boolean;
  /** Sta toe een niet-bestaande naam als nieuwe persoon in te dienen. Standaard aan
   *  zodra `createName` is meegegeven; zet expliciet op false voor "alleen kiezen". */
  allowCreate?: boolean;
  placeholder?: string;
  /** Wordt aangeroepen zodra er een bestaande persoon gekozen wordt (of null bij
   *  een vrij getypte naam) — bijv. om andere velden alvast in te vullen. */
  onSelect?: (person: ComboPerson | null) => void;
}) {
  const canCreate = allowCreate ?? Boolean(createName);
  const [text, setText] = useState(defaultName ?? "");
  const [selectedId, setSelectedId] = useState(defaultId ?? "");
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
  const matches = q
    ? people.filter((p) => {
        const lower = p.name.toLowerCase();
        return lower.startsWith(q) || lower.split(/\s+/).some((w) => w.startsWith(q));
      })
    : people;
  const exact = q ? people.find((p) => p.name.toLowerCase() === q) : undefined;
  const showCreate = canCreate && q.length > 0 && !exact;
  const showNoMatch = !canCreate && q.length > 0 && matches.length === 0;

  function syncSelection(value: string) {
    const ex = people.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    setSelectedId(ex ? ex.id : "");
    onSelect?.(ex ?? null);
  }

  function pick(p: ComboPerson) {
    setText(p.name);
    setSelectedId(p.id);
    setOpen(false);
    onSelect?.(p);
  }

  const newName = !selectedId && text.trim() ? text.trim() : "";

  const up = useDropDirection(open, rootRef, 260);


  const hiddenRef = useRef<HTMLInputElement>(null);


  useValueSignal(hiddenRef, selectedId);



  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          syncSelection(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && open && matches.length > 0 && !exact) {
            e.preventDefault();
            pick(matches[0]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        aria-label="Zoek of typ een naam"
        className={fieldBase}
      />
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

      {/* Submitted values: an existing id, OR (when allowed) a new name to create. */}
      <input ref={hiddenRef} type="hidden" name={name} value={selectedId} />
      {createName && <input type="hidden" name={createName} value={canCreate ? newName : ""} />}

      {open && (matches.length > 0 || showCreate || showNoMatch) && (
        <ul
          className={cn(
            "absolute z-30 max-h-60 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 text-sm shadow-lg",
            dropClass(up),
          )}
        >
          {matches.slice(0, 50).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-ink-700 hover:bg-ink-50"
              >
                <span className="truncate">{p.name}</span>
                {selectedId === p.id && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            </li>
          ))}
          {showCreate && (
            <li className={cn(matches.length > 0 && "border-t border-ink-100")}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-brand-700 hover:bg-brand-50"
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span className="truncate">“{text.trim()}” toevoegen als nieuwe persoon</span>
              </button>
            </li>
          )}
          {showNoMatch && (
            <li className="px-3 py-2 text-ink-400">Geen medewerker gevonden.</li>
          )}
        </ul>
      )}
    </div>
  );
}
