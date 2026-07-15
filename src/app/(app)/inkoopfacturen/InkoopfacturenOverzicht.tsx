"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, round2 } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { PURCHASE_INVOICE_STATUSES, labelFor } from "@/lib/domain";
import { SmartList, type SmartColumn, type SmartFilter, type SmartGroup } from "@/components/smart-list";
import { PeriodFilter, periodRange, type Gran } from "@/components/period-filter";

export type InkoopRow = {
  id: string;
  number: string;
  consultantName: string;
  issueDate: string; // ISO
  dueDate: string; // ISO
  subtotal: number;
  total: number;
  status: string; // raw DB status
};

export function InkoopfacturenOverzicht({ invoices }: { invoices: InkoopRow[] }) {
  const [gran, setGran] = useState<Gran>("all");
  const [anchor, setAnchor] = useState(() => new Date());

  const range = periodRange(gran, anchor);

  const rows = useMemo(() => {
    if (!range) return invoices;
    return invoices.filter((inv) => {
      const t = new Date(inv.issueDate).getTime();
      return t >= range.start && t < range.end;
    });
  }, [invoices, range]);

  const totaal = round2(
    rows.filter((i) => i.status !== "CANCELLED").reduce((s, i) => s + i.subtotal, 0),
  );
  const teBetalen = round2(
    rows.filter((i) => i.status === "APPROVED").reduce((s, i) => s + i.total, 0),
  );
  const betaald = round2(
    rows.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0),
  );

  const columns: SmartColumn<InkoopRow>[] = [
    {
      key: "number",
      header: "Nummer",
      sortValue: (r) => r.number,
      render: (r) => (
        <Link href={`/inkoopfacturen/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
          {r.number}
        </Link>
      ),
    },
    {
      key: "werknemer",
      header: "Werknemer",
      sortValue: (r) => r.consultantName.toLowerCase(),
      render: (r) => r.consultantName,
    },
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
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge options={PURCHASE_INVOICE_STATUSES} value={r.status} />,
    },
  ];
  const filters: SmartFilter<InkoopRow>[] = [
    {
      key: "status",
      label: "Status",
      value: (r) => r.status,
      options: PURCHASE_INVOICE_STATUSES.map((s) => ({ value: s.value, label: s.label, color: s.color })),
    },
  ];
  const groups: SmartGroup<InkoopRow>[] = [
    { key: "status", label: "Status", value: (r) => r.status, display: (r) => labelFor(PURCHASE_INVOICE_STATUSES, r.status) },
    { key: "werknemer", label: "Werknemer", value: (r) => r.consultantName, display: (r) => r.consultantName },
  ];

  return (
    <div className="space-y-4">
      {/* Period filter (gedeeld; week-stand toont de klikbare week-box) */}
      <PeriodFilter gran={gran} anchor={anchor} onGran={setGran} onAnchor={setAnchor} />

      {/* Overzicht voor de gekozen periode */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Inkoopfacturen" value={rows.length} accent="brand" />
        <StatCard label="Totaal (excl. BTW)" value={formatCurrency(totaal)} accent="violet" />
        <StatCard label="Te betalen" value={formatCurrency(teBetalen)} accent="amber" />
        <StatCard label="Betaald" value={formatCurrency(betaald)} accent="green" />
      </div>

      {/* Tabel — met zoeken/filteren/groeperen/sorteren */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm">
          Geen inkoopfacturen in deze periode.
        </div>
      ) : (
        <SmartList
          rows={rows}
          columns={columns}
          search={(r) => `${r.number} ${r.consultantName}`}
          searchPlaceholder="Zoek op nummer of werknemer…"
          filters={filters}
          groups={groups}
          initialSort={{ key: "datum", dir: "desc" }}
        />
      )}
    </div>
  );
}
