"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH } from "@/components/ui/table";
import { KlantRow, type KlantRowData } from "./KlantRow";

/** Klantenlijst met directe zoekfilter (op bedrijf, plaats of contact). */
export function KlantenTable({ clients }: { clients: KlantRowData[] }) {
  const [q, setQ] = useState("");
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
            {filtered.length} van {clients.length} klanten
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Geen klanten gevonden voor “{q}”.
        </p>
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Bedrijf</TH>
                <TH>Plaats</TH>
                <TH>Contact</TH>
                <TH className="text-right">Plaatsingen</TH>
                <TH className="text-right">Facturen</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((c) => (
                <KlantRow key={c.id} c={c} />
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
