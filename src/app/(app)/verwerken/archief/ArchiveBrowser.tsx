"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Receipt, Coins, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatHours } from "@/lib/utils";
import { INVOICE_STATUSES, PURCHASE_INVOICE_STATUSES } from "@/lib/domain";

type Row = {
  timesheetId: string;
  consultantId: string;
  consultantName: string;
  placementTitle: string;
  clientName: string;
  hours: number;
  sales: { id: string; number: string; status: string } | null;
  purchase: { id: string; number: string; status: string } | null;
};

export type ArchiveWeek = { key: string; weekLabel: string; hours: number; rows: Row[] };

/** Facturatie-archief: per week inklapbaar + filter op naam medewerker. */
export function ArchiveBrowser({ weeks }: { weeks: ArchiveWeek[] }) {
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const query = q.trim().toLowerCase();

  // Filter de rijen per week op medewerker-naam; weken zonder match vallen weg.
  const filtered = useMemo(() => {
    if (!query) return weeks;
    return weeks
      .map((w) => ({ ...w, rows: w.rows.filter((r) => r.consultantName.toLowerCase().includes(query)) }))
      .filter((w) => w.rows.length > 0);
  }, [weeks, query]);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allCollapsed = weeks.length > 0 && weeks.every((w) => collapsed.has(w.key));
  const setAll = (collapse: boolean) => setCollapsed(collapse ? new Set(weeks.map((w) => w.key)) : new Set());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op naam medewerker…"
            aria-label="Zoek op naam medewerker"
            className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
        <button
          type="button"
          onClick={() => setAll(!allCollapsed)}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50"
        >
          {allCollapsed ? "Alles uitklappen" : "Alles inklappen"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-ink-200 bg-white px-4 py-6 text-center text-sm text-ink-500">
          Geen medewerker gevonden voor “{q}”.
        </p>
      ) : (
        filtered.map((w) => {
          const open = query ? true : !collapsed.has(w.key); // tijdens zoeken altijd open
          const cnt = w.rows.length;
          const hrs = w.rows.reduce((s, r) => s + r.hours, 0);
          return (
            <Card key={w.key} className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(w.key)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-ink-50"
              >
                <span className="flex items-center gap-2 text-base font-semibold text-ink-900">
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-ink-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-ink-400" />
                  )}
                  <CalendarDays className="h-4 w-4 text-brand-600" /> {w.weekLabel}
                </span>
                <span className="text-sm text-ink-500">
                  {cnt} medewerker-week{cnt === 1 ? "" : "en"} · {formatHours(hrs)} u
                </span>
              </button>

              {open && (
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Medewerker</TH>
                      <TH>Plaatsing / klant</TH>
                      <TH className="text-right">Uren</TH>
                      <TH>Verkoopfactuur</TH>
                      <TH>Inkoopfactuur</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {w.rows.map((r) => (
                      <TR key={r.timesheetId}>
                        <TD>
                          <Link
                            href={`/werknemers/${r.consultantId}`}
                            className="font-medium text-ink-900 hover:text-brand-700"
                          >
                            {r.consultantName}
                          </Link>
                        </TD>
                        <TD className="text-ink-500">
                          <span className="text-ink-900">{r.placementTitle}</span>
                          <span className="block text-xs text-ink-400">{r.clientName}</span>
                        </TD>
                        <TD className="text-right tabular-nums">{formatHours(r.hours)}</TD>
                        <TD>
                          {r.sales ? (
                            <span className="flex items-center gap-2">
                              <Link
                                href={`/facturen/${r.sales.id}`}
                                className="inline-flex items-center gap-1 font-medium text-ink-900 hover:text-brand-700"
                              >
                                <Receipt className="h-3.5 w-3.5 text-ink-400" /> {r.sales.number}
                              </Link>
                              <StatusBadge options={INVOICE_STATUSES} value={r.sales.status} />
                            </span>
                          ) : (
                            "—"
                          )}
                        </TD>
                        <TD>
                          {r.purchase ? (
                            <span className="flex items-center gap-2">
                              <Link
                                href={`/inkoopfacturen/${r.purchase.id}`}
                                className="inline-flex items-center gap-1 font-medium text-ink-900 hover:text-brand-700"
                              >
                                <Coins className="h-3.5 w-3.5 text-ink-400" /> {r.purchase.number}
                              </Link>
                              <StatusBadge options={PURCHASE_INVOICE_STATUSES} value={r.purchase.status} />
                            </span>
                          ) : (
                            "—"
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
