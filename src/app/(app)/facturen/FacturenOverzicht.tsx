"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, ExternalLink, Pencil, Send, Trash2, X } from "lucide-react";
import { formatCurrency, formatDate, round2 } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { INVOICE_STATUSES, labelFor } from "@/lib/domain";
import { SmartList, type SmartColumn, type SmartFilter, type SmartGroup } from "@/components/smart-list";
import { PeriodFilter, periodRange, type Gran } from "@/components/period-filter";
import {
  MAX_OPEN_TABS,
  capOpen,
  invoicePdfHref,
  invoicePdfPreviewHref,
  isDeletableInvoice,
  isSendableInvoice,
} from "@/lib/factuur-bulk";
import { bulkDeleteInvoices, bulkSendInvoices } from "./actions";

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
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [capped, setCapped] = useState(0);
  // De factuur die in het volledige-schermvoorbeeld staat (null = dicht).
  const [preview, setPreview] = useState<{ id: string; number: string } | null>(null);

  // Escape sluit het voorbeeld.
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreview(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

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
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => setPreview({ id: r.id, number: r.number })}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            title="Bekijken"
            aria-label={`Factuur ${r.number} bekijken`}
          >
            <Eye className="h-4 w-4" />
          </button>
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

  // --- Selectie + bulkacties ------------------------------------------------
  // De guards zijn dezelfde als op de server (src/lib/factuur-bulk.ts), dus de
  // knoppen tellen exact wat de actie straks doet. Let op: de RUWE status telt,
  // niet de "Te laat"-weergave.
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const ids = selectedRows.map((r) => r.id).join(",");
  const deletable = selectedRows.filter((r) => isDeletableInvoice(r.status));
  const sendable = selectedRows.filter((r) => isSendableInvoice(r.status));
  const clearSelection = () => {
    setSelected(new Set());
    setCapped(0);
  };

  function openSelected() {
    const res = capOpen(selectedRows.map((r) => r.id));
    for (const id of res.open) window.open(invoicePdfHref(id), "_blank", "noopener");
    setCapped(res.capped);
  }

  const bulkBar =
    selectedRows.length === 0 ? null : (
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-brand-900">
            {selectedRows.length} geselecteerd
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            Selectie wissen
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openSelected}>
              <ExternalLink className="h-4 w-4" /> Openen ({selectedRows.length})
            </Button>

            {sendable.length > 0 && (
              <ConfirmSubmit
                action={bulkSendInvoices}
                hidden={{ ids }}
                trigger="button"
                variant="primary"
                size="sm"
                confirmVariant="primary"
                confirmLabel="Versturen"
                message={`${sendable.length} factu${sendable.length === 1 ? "ur" : "ren"} versturen naar de klant?`}
                description="De facturen gaan als PDF per e-mail naar het factuuradres van de klant en komen op 'Verzonden' te staan — net als vanuit de verzendmap."
              >
                <span className="inline-flex items-center gap-2">
                  <Send className="h-4 w-4" /> Verzend geselecteerde ({sendable.length})
                </span>
              </ConfirmSubmit>
            )}

            {deletable.length > 0 && (
              <ConfirmSubmit
                action={bulkDeleteInvoices}
                hidden={{ ids }}
                trigger="button"
                variant="danger"
                size="sm"
                message={`${deletable.length} factu${deletable.length === 1 ? "ur" : "ren"} verwijderen?`}
                description="Alleen concepten en geannuleerde facturen gaan weg; hun urenstaten komen weer vrij om te factureren."
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> Verwijderen ({deletable.length})
                </span>
              </ConfirmSubmit>
            )}
          </div>
        </div>

        {(sendable.length < selectedRows.length || capped > 0) && (
          <p className="mt-2 text-xs text-brand-800">
            {sendable.length < selectedRows.length && (
              <>
                {selectedRows.length - sendable.length} van de selectie {selectedRows.length - sendable.length === 1 ? "is" : "zijn"} geen concept
                meer — die {selectedRows.length - sendable.length === 1 ? "wordt" : "worden"} niet verstuurd.{" "}
              </>
            )}
            {capped > 0 && (
              <>
                Er {capped === 1 ? "is 1 PDF" : `zijn ${capped} PDF's`} niet geopend: browsers blokkeren meer dan{" "}
                {MAX_OPEN_TABS} tabbladen tegelijk.
              </>
            )}
          </p>
        )}
      </div>
    );

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
          selection={{
            selected,
            onChange: setSelected,
            rowLabel: (r) => `Factuur ${r.number} selecteren`,
          }}
          toolbarExtra={bulkBar}
        />
      )}

      {/* Volledig-scherm factuurvoorbeeld — dezelfde echte PDF als de detailpagina,
          zodat je 'm hier direct kunt bekijken zonder weg te navigeren. */}
      {preview && (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-black/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Factuur ${preview.number}`}
          onClick={() => setPreview(null)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink-900">Factuur {preview.number}</h2>
              <div className="flex items-center gap-2">
                <a
                  href={invoicePdfHref(preview.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink className="h-4 w-4" /> Openen / printen
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className={buttonVariants({ variant: "ghost", size: "icon" })}
                  aria-label="Sluiten"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe
              title={`Factuur ${preview.number}`}
              src={invoicePdfPreviewHref(preview.id)}
              className="min-h-0 w-full flex-1 border-0 bg-ink-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
