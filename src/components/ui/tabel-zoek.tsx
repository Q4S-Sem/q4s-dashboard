import { Search } from "lucide-react";
import { AutoFilterForm } from "./auto-filter-form";

/** Eén zoekveld-stijl voor het hele dashboard (ook voor live-filters in client-lijsten). */
export const ZOEK_INPUT =
  "h-9 w-full rounded-md border border-ink-200 bg-white pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-100 [&::-webkit-search-cancel-button]:cursor-pointer";
export const ZOEK_ICOON = "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400";

/**
 * Zoekbalk boven een tabel. Zet `?q=` in de URL (auto-submit, debounce) en
 * neemt de overige parameters (week, filter, tab…) ongewijzigd mee.
 */
export function TabelZoek({
  basePath,
  q,
  placeholder,
  behoud,
  children,
}: {
  basePath: string;
  q?: string;
  placeholder: string;
  /** Overige query-parameters die bij het zoeken moeten blijven staan. */
  behoud?: Record<string, string | undefined>;
  /** Extra filtervelden (Select) rechts van de zoekbalk. */
  children?: React.ReactNode;
}) {
  return (
    <AutoFilterForm basePath={basePath} className="flex flex-wrap items-center gap-3">
      {Object.entries(behoud ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <label className="relative min-w-[16rem] flex-1">
        <Search className={ZOEK_ICOON} />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={placeholder}
          aria-label={placeholder}
          className={ZOEK_INPUT}
        />
      </label>
      {children}
    </AutoFilterForm>
  );
}

/** Zoekterm-match: alle woorden moeten ergens in de velden voorkomen. */
export function matchtZoek(q: string | undefined, ...velden: (string | null | undefined)[]): boolean {
  const woorden = (q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!woorden.length) return true;
  const hooi = velden.filter(Boolean).join(" ").toLowerCase();
  return woorden.every((w) => hooi.includes(w));
}
