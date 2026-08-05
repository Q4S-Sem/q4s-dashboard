"use client";

import { useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH } from "@/components/ui/table";
import { KlantRow, type KlantRowData } from "./KlantRow";

type SortKey = "companyName" | "city" | "contactName" | "contacts" | "placements" | "invoices";
type SortDir = "asc" | "desc";

const NUMERIC: SortKey[] = ["contacts", "placements", "invoices"];

/** Klantenlijst: zoeken (bedrijf/plaats/contact) + sorteerbare kolommen.
 *  Standaard gesorteerd op aantal plaatsingen (meeste bovenaan). */
export function KlantenTable({ clients }: { clients: KlantRowData[] }) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("placements");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const query = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return clients;
    return clients.filter(
      (c) =>
        c.companyName.toLowerCase().includes(query) ||
        (c.city ?? "").toLowerCase().includes(query) ||
        (c.contactName ?? "").toLowerCase().includes(query),
    );
  }, [clients, query]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let primary: number;
      if (sortKey === "contacts" || sortKey === "placements" || sortKey === "invoices") {
        primary = a[sortKey] - b[sortKey];
      } else {
        primary = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "", "nl", {
          sensitivity: "base",
        });
      }
      if (primary !== 0) return primary * dir;
      // Gelijk? Altijd stabiel op bedrijfsnaam (A→Z).
      return a.companyName.localeCompare(b.companyName, "nl");
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Getallen aflopend (meeste eerst), tekst oplopend (A→Z).
      setSortDir(NUMERIC.includes(key) ? "desc" : "asc");
    }
  }

  function SortHeader({
    keyName,
    label,
    align = "left",
  }: {
    keyName: SortKey;
    label: string;
    align?: "left" | "right";
  }) {
    const active = sortKey === keyName;
    return (
      <button
        type="button"
        onClick={() => toggleSort(keyName)}
        aria-label={`Sorteer op ${label}`}
        className={cn(
          "group inline-flex select-none items-center gap-1 transition-colors",
          align === "right" && "flex-row-reverse",
          active ? "text-slate-900" : "text-slate-500 hover:text-slate-700",
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-400" />
        )}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op bedrijf, plaats of contact…"
            aria-label="Zoek klant"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
        {query && (
          <span className="text-xs text-slate-400">
            {sorted.length} van {clients.length} klanten
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Geen klanten gevonden voor “{q}”.
        </p>
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH><SortHeader keyName="companyName" label="Bedrijf" /></TH>
                <TH><SortHeader keyName="city" label="Plaats" /></TH>
                <TH><SortHeader keyName="contactName" label="Contact" /></TH>
                <TH className="text-right">
                  <SortHeader keyName="contacts" label="Contacten" align="right" />
                </TH>
                <TH className="text-right">
                  <SortHeader keyName="placements" label="Plaatsingen" align="right" />
                </TH>
                <TH className="text-right">
                  <SortHeader keyName="invoices" label="Facturen" align="right" />
                </TH>
              </TR>
            </THead>
            <TBody>
              {sorted.map((c) => (
                <KlantRow key={c.id} c={c} />
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
