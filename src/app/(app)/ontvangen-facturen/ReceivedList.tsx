"use client";

import Link from "next/link";
import { CheckCircle2, AlertTriangle, Wallet, Check, Trash2, FileText } from "lucide-react";
import { cn, formatCurrency, formatDate, formatHours } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { SmartList, type SmartColumn, type SmartFilter } from "@/components/smart-list";
import { RECEIVED_INVOICE_STATUSES } from "@/lib/domain";
import type { ReceivedRow } from "@/lib/received-invoices";
import { setReceivedStatus, deleteReceivedInvoice } from "./actions";
import { DiscrepancyMailButton } from "./DiscrepancyMailButton";

function periodLabel(start: Date | null, end: Date | null): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start || end) return formatDate((start ?? end) as Date);
  return "—";
}

/** Gedeelde stijl voor de actie-icoonknoppen: nette "box" met kleur-hover. */
function iconBtn(tone: "slate" | "green" | "red" | "brand" | "delete"): string {
  return cn(
    "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition-colors",
    tone === "slate" && "text-ink-500 hover:border-ink-200 hover:bg-ink-100",
    tone === "green" && "text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50",
    tone === "red" && "text-red-600 hover:border-red-200 hover:bg-red-50",
    tone === "brand" && "text-brand-600 hover:border-brand-200 hover:bg-brand-50",
    tone === "delete" && "text-ink-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600",
  );
}

function StatusButton({
  id,
  status,
  title,
  tone = "slate",
  children,
}: {
  id: string;
  status: string;
  title: string;
  tone?: "slate" | "green" | "red";
  children: React.ReactNode;
}) {
  return (
    <form action={setReceivedStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" title={title} aria-label={title} className={iconBtn(tone)}>
        {children}
      </button>
    </form>
  );
}

export function ReceivedList({ rows }: { rows: ReceivedRow[] }) {
  const columns: SmartColumn<ReceivedRow>[] = [
    {
      key: "medewerker",
      header: "Medewerker",
      sortValue: (r) => r.consultantName.toLowerCase(),
      render: (r) => (
        <Link href={`/ontvangen-facturen/${r.id}`} className="font-medium text-ink-900 hover:text-brand-700">
          {r.consultantName}
        </Link>
      ),
    },
    {
      key: "factuur",
      header: "Factuur · periode",
      render: (r) => (
        <div>
          <div className="text-sm text-ink-700">{r.number ?? "—"}</div>
          <div className="text-xs text-ink-400">{periodLabel(r.periodStart, r.periodEnd)}</div>
        </div>
      ),
    },
    {
      key: "binnen",
      header: "Binnengekomen",
      sortValue: (r) => (r.issueDate ? new Date(r.issueDate).getTime() : 0),
      render: (r) => (
        <span className="whitespace-nowrap text-sm text-ink-500">
          {r.issueDate ? formatDate(r.issueDate) : "—"}
        </span>
      ),
    },
    {
      key: "gefactureerd",
      header: "Gefactureerd",
      align: "right",
      sortValue: (r) => r.amount,
      render: (r) => <span className="tabular-nums text-ink-900">{formatCurrency(r.amount)}</span>,
    },
    {
      key: "verwacht",
      header: "Verwacht",
      align: "right",
      sortValue: (r) => r.expected?.total ?? -1,
      render: (r) =>
        r.expected ? (
          <div>
            <span className="tabular-nums text-ink-700">{formatCurrency(r.expected.total)}</span>
            <div className="text-xs text-ink-400">
              {formatCurrency(r.expected.subtotal)} ex · {r.expected.weeks} wk ·{" "}
              {formatHours(r.expected.hours)} u
            </div>
          </div>
        ) : (
          <span className="text-xs text-ink-400">geen periode</span>
        ),
    },
    {
      key: "controle",
      header: "Controle",
      render: (r) =>
        r.matched == null ? (
          <span className="text-xs text-ink-400">—</span>
        ) : r.matched ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Klopt
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-sm bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
            title="Verschil t.o.v. de timesheet"
          >
            <AlertTriangle className="h-3 w-3" />
            {(r.diff ?? 0) > 0 ? "+" : ""}
            {formatCurrency(r.diff ?? 0)}
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge options={RECEIVED_INVOICE_STATUSES} value={r.status} />,
    },
    {
      key: "acties",
      header: "",
      align: "right",
      cellClassName: "whitespace-nowrap",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {/* Contextuele acties — variëren per rij, staan links */}
          {r.matched === false && r.status !== "PAID" && (
            <DiscrepancyMailButton id={r.id} alreadyMailed={r.mailed} />
          )}
          {r.status !== "APPROVED" && r.status !== "PAID" && (
            <StatusButton id={r.id} status="APPROVED" title="Markeer als gecontroleerd">
              <Check className="h-4 w-4" />
            </StatusButton>
          )}
          {r.status !== "PAID" && (
            <StatusButton id={r.id} status="PAID" title="Markeer als betaald" tone="green">
              <Wallet className="h-4 w-4" />
            </StatusButton>
          )}

          {/* Vaste acties — altijd rechts, uitgelijnd over alle rijen */}
          <span className="mx-1 h-6 w-px shrink-0 bg-ink-200" aria-hidden="true" />
          <Link
            href={`/ontvangen-facturen/${r.id}`}
            title="Open de factuur"
            aria-label="Open de factuur"
            className={iconBtn("slate")}
          >
            <FileText className="h-4 w-4" />
          </Link>
          <form action={deleteReceivedInvoice}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" title="Verwijderen" aria-label="Verwijderen" className={iconBtn("delete")}>
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      ),
    },
  ];

  const filters: SmartFilter<ReceivedRow>[] = [
    {
      key: "status",
      label: "Status",
      value: (r) => r.status,
      options: RECEIVED_INVOICE_STATUSES.map((s) => ({ value: s.value, label: s.label, color: s.color })),
    },
    {
      key: "controle",
      label: "Controle",
      value: (r) => (r.matched == null ? "geen" : r.matched ? "klopt" : "afwijking"),
      options: [
        { value: "klopt", label: "Klopt", color: "green" },
        { value: "afwijking", label: "Afwijking", color: "red" },
        { value: "geen", label: "Geen periode", color: "slate" },
      ],
    },
  ];

  return (
    <SmartList
      rows={rows}
      columns={columns}
      search={(r) => `${r.consultantName} ${r.number ?? ""}`}
      searchPlaceholder="Zoek op naam of factuurnummer…"
      filters={filters}
      initialSort={{ key: "binnen", dir: "desc" }}
      emptyLabel="Geen facturen in deze selectie."
    />
  );
}
