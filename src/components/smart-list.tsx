"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Search, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Select } from "@/components/ui/field";

/** Diacritics-insensitive fold zodat "jose" ook "José" vindt. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export type SmartColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Waarde om op te sorteren; laat weg om deze kolom niet-sorteerbaar te maken. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  headerClassName?: string;
  cellClassName?: string;
};

export type SmartFilter<T> = {
  key: string;
  label: string;
  value: (row: T) => string;
  /** `color` (een BadgeColor-token) toont een gekleurd stipje bij de optie. */
  options: { value: string; label: string; color?: string }[];
};

export type SmartGroup<T> = {
  key: string;
  label: string;
  value: (row: T) => string;
  display: (row: T) => string;
};

/**
 * Odoo-achtige lijstweergave: zoeken, filteren (dropdowns), groeperen (inklapbaar)
 * en sorteren op kolom — allemaal client-side, herbruikbaar. De pagina levert
 * platte rijen aan + een kolom-/filter-/groep-config (met render-functies).
 */
export function SmartList<T extends { id: string }>({
  rows,
  columns,
  search,
  searchPlaceholder = "Zoeken…",
  filters = [],
  groups = [],
  initialSort,
  emptyLabel = "Geen resultaten.",
}: {
  rows: T[];
  columns: SmartColumn<T>[];
  search?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: SmartFilter<T>[];
  groups?: SmartGroup<T>[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  emptyLabel?: string;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Record<string, string>>({});
  const [groupKey, setGroupKey] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const term = search ? fold(q.trim()) : "";

  const filtered = useMemo(() => {
    let r = rows;
    if (term && search) r = r.filter((row) => fold(search(row)).includes(term));
    for (const f of filters) {
      const v = sel[f.key];
      if (v) r = r.filter((row) => f.value(row) === v);
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        const dir = sort.dir === "asc" ? 1 : -1;
        r = [...r].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          if (av < bv) return -dir;
          if (av > bv) return dir;
          return 0;
        });
      }
    }
    return r;
  }, [rows, term, search, filters, sel, sort, columns]);

  const group = groups.find((g) => g.key === groupKey);
  const grouped = useMemo(() => {
    if (!group) return null;
    const m = new Map<string, { label: string; rows: T[] }>();
    for (const row of filtered) {
      const k = group.value(row);
      let g = m.get(k);
      if (!g) {
        g = { label: group.display(row), rows: [] };
        m.set(k, g);
      }
      g.rows.push(row);
    }
    return [...m.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label, "nl"));
  }, [filtered, group]);

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" },
    );
  }
  function toggleCollapse(k: string) {
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  const colCount = columns.length;

  const renderRow = (row: T) => (
    <TR key={row.id}>
      {columns.map((c) => (
        <TD key={c.key} className={cn(c.align === "right" && "text-right", c.cellClassName)}>
          {c.render(row)}
        </TD>
      ))}
    </TR>
  );

  return (
    <div className="space-y-3">
      {/* Toolbar: zoeken · filters · groeperen */}
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Zoeken"
              className="block w-full rounded-lg border border-ink-300 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        )}
        {filters.map((f) => (
          <Select
            key={f.key}
            aria-label={f.label}
            className="w-44"
            defaultValue=""
            onValueChange={(v) => setSel((s) => ({ ...s, [f.key]: v }))}
          >
            <option value="">Alle {f.label.toLowerCase()}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value} data-color={o.color}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        {groups.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-sm text-ink-500">
            <Layers className="h-4 w-4" />
            <Select
              aria-label="Groeperen op"
              className="w-48"
              defaultValue=""
              onValueChange={(v) => setGroupKey(v)}
            >
              <option value="">Niet groeperen</option>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  Groepeer: {g.label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              {columns.map((c) => (
                <TH key={c.key} className={cn(c.align === "right" && "text-right", c.headerClassName)}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 transition-colors hover:text-ink-800",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-brand-600" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-brand-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-ink-300" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TR className="hover:bg-transparent">
                <TD colSpan={colCount} className="py-8 text-center text-ink-400">
                  {emptyLabel}
                </TD>
              </TR>
            ) : grouped ? (
              grouped.map((g) => {
                const isCollapsed = collapsed.has(g.key);
                return (
                  <Fragment key={g.key}>
                    <TR
                      className="cursor-pointer bg-ink-50/70 hover:bg-ink-100"
                      onClick={() => toggleCollapse(g.key)}
                    >
                      <TD colSpan={colCount} className="font-semibold text-ink-800">
                        <span className="inline-flex items-center gap-1.5">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-ink-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-ink-400" />
                          )}
                          {g.label}
                          <span className="rounded-full bg-ink-200 px-2 py-0.5 text-xs font-medium text-ink-600">
                            {g.rows.length}
                          </span>
                        </span>
                      </TD>
                    </TR>
                    {!isCollapsed && g.rows.map(renderRow)}
                  </Fragment>
                );
              })
            ) : (
              filtered.map(renderRow)
            )}
          </TBody>
        </Table>
      </div>

      <p className="text-xs text-ink-400">
        {filtered.length} van {rows.length}
        {grouped ? ` · ${grouped.length} groep${grouped.length === 1 ? "" : "en"}` : ""}
      </p>
    </div>
  );
}
