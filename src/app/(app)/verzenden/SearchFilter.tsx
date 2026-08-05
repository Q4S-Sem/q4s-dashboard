"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/field";

/**
 * Vrij zoeken in de verzendmap op factuurnummer, klant of naam. Debounced en
 * server-gedreven (?q=…) zodat de weergave, de tellingen én de bulk-verzending
 * exact hetzelfde filteren — behoudt de actieve tab + weekfilter.
 */
export function SearchFilter({
  tab,
  week,
  value,
}: {
  tab: string;
  week: string;
  value: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nieuwste tab/week/router bij de hand houden, zodat een debounced navigatie
  // nooit een verouderde closure gebruikt: een tab-/weekwissel binnen het
  // debounce-venster mag niet stiekem teruggedraaid worden door een late timer.
  const latest = useRef({ tab, week, router });
  useEffect(() => {
    latest.current = { tab, week, router };
  }, [tab, week, router]);

  // Neem de toegepaste zoekterm uit de URL over als die extern verandert
  // (browser terug/vooruit) — maar niet terwijl je typt (lopende debounce),
  // anders klapt een trage echo je invoer terug.
  useEffect(() => {
    if (timer.current) return;
    setText(value);
  }, [value]);

  // Lopende debounce opruimen bij unmount, anders navigeert een late timer je
  // terug naar /verzenden nadat je de pagina al verlaten hebt.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function push(next: string) {
    const { tab, week, router } = latest.current;
    const params = new URLSearchParams({ tab });
    if (week) params.set("week", week);
    const q = next.trim();
    if (q) params.set("q", q);
    router.push(`/verzenden?${params.toString()}`, { scroll: false });
  }

  function onChange(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      push(v);
    }, 300);
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setText("");
    push("");
  }

  return (
    <div className="relative w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <Input
        type="text"
        aria-label="Zoek op nummer, klant of naam"
        placeholder="Zoek op nummer, klant of naam…"
        className="pl-8 pr-8"
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
      {text && (
        <button
          type="button"
          onClick={clear}
          aria-label="Wis zoekopdracht"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
