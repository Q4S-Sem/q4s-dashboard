"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { formatCurrency, formatDate, round2 } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { INVOICE_STATUSES, labelFor } from "@/lib/domain";
import { SmartList, type SmartColumn, type SmartFilter, type SmartGroup } from "@/components/smart-list";
import { PeriodFilter, periodRange, type Gran } from "@/components/period-filter";

export type FactuurRow = {
  id: string;
  number: string;
  clientName: string;
  issueDate: string; // ISO
  dueDate: string; // ISO
  subtotal: number;
  total: number;
  status: string; // raw DB status
};

export function FacturenOverzicht({ invoices }: { invoices: FactuurRow[] }) {
  const [gran, setGran] = useState<Gran>("all");
  const [anchor, setAnchor] = useState(() => new Date());
  const [now] = useState(() => Date.now());

  const range = periodRange(gran, anchor);

  const rows = useMemo(() => {
    const inRange = range
      ? invoices.filter((inv) => {
          const t = new Date(inv.issueDate).getTime();
          return t >= range.start && t < range.end;
        })
      : invoices;
    return inRange.map((inv) => ({
      ...inv,
      effective:
        inv.status === "SENT" && new Date(inv.dueDate).getTime() < now
          ? "OVERDUE"
          : inv.status,
    }));
  }, [invoices, range, now]);

  const omzet = round2(
    rows.filter((i) => i.status !== "CANCELLED").reduce((s, i) => s + i.subtotal, 0),
  );
  const openstaand = round2(
    rows.filter((i) => i.status === "SENT").reduce((s, i) => s + i.total, 0),
  );
  const betaald = round2(
    rows.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0),
  );

  type Row = FactuurRow & { effective: string };
  const columns: SmartColumn<Row>[] = [
    {
      key: "number",
      header: "Nummer",
      sortValue: (r) => r.number,
      render: (r) => (
        <Link href={`/facturen/${r.id}`} className="font-medium text-ink-900 hover:text-brand-700">
          {r.number}
        </Link>
      ),
    },
    { key: "client", header: "Klant", sortValue: (r) => r.clientName.toLowerCase(), render: (r) => r.clientName },
    { key: "datum", header: "Datum", sortValue: (r) => r.issueDate, render: (r) => formatDate(r.issueDate) },
    {
      key: "bedrag",
      header: "Bedrag",
      align: "right",
      sortValue: (r) => r.total,
      render: (r) => <span className="tabular-nums">{formatCurrency(r.total)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.effective,
      render: (r) => <StatusBadge options={INVOICE_STATUSES} value={r.effective} />,
    },
    {
      key: "acties",
      header: "Acties",
      align: "right",
      render: (r) => (
        <div className="flex justify-end">
          <Link
            href={`/facturen/${r.id}/bewerken`}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            title="Bewerken"
            aria-label="Factuur bewerken"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
      ),
    },
  ];
  const filters: SmartFilter<Row>[] = [
    { key: "status", label: "Status", value: (r) => r.effective, options: INVOICE_STATUSES.map((s) => ({ value: s.value, label: s.label, color: s.color })) },
  ];
  const groups: SmartGroup<Row>[] = [
    { key: "status", label: "Status", value: (r) => r.effective, display: (r) => labelFor(INVOICE_STATUSES, r.effective) },
    { key: "client", label: "Klant", value: (r) => r.clientName, display: (r) => r.clientName },
  ];

  return (
    <div className="space-y-4">
      {/* Period filter (gedeeld; week-stand toont de klikbare week-box) */}
      <PeriodFilter gran={gran} anchor={anchor} onGran={setGran} onAnchor={setAnchor} />

      {/* Overview for the selected period */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Facturen" value={rows.length} accent="brand" />
        <StatCard label="Omzet (excl. BTW)" value={formatCurrency(omzet)} accent="violet" />
        <StatCard label="Openstaand" value={formatCurrency(openstaand)} accent="amber" />
        <StatCard label="Betaald" value={formatCurrency(betaald)} accent="green" />
      </div>

      {/* Table — met Odoo-stijl zoeken/filteren/groeperen/sorteren */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-ink-200 bg-white px-4 py-12 text-center text-sm text-ink-500 shadow-sm">
          Geen facturen in deze periode.
        </div>
      ) : (
        <SmartList
          rows={rows}
          columns={columns}
          search={(r) => `${r.number} ${r.clientName}`}
          searchPlaceholder="Zoek op nummer of klant…"
          filters={filters}
          groups={groups}
          initialSort={{ key: "datum", dir: "desc" }}
        />
      )}
    </div>
  );
}
