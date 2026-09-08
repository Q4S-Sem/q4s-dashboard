"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Send, Mail, MailWarning } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { InvoicePreviewButton } from "@/components/invoice-preview-button";
import { formatCurrency, getISOWeek } from "@/lib/utils";
import { sendSalesInvoice, sendSelected } from "./actions";

export type VerzendRow = {
  id: string;
  number: string;
  recipientName: string;
  email: string | null;
  fixHref: string;
  total: number;
  weekKeys: string[];
};

const checkboxClass =
  "h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40";

/** Korte weekweergave per rij, bv. "Wk 28" of "Wk 27, 28". */
function weekShort(keys: string[]): string {
  if (keys.length === 0) return "—";
  return [...keys]
    .sort()
    .map((k) => `Wk ${getISOWeek(new Date(`${k}T00:00:00`))}`)
    .join(", ");
}

/**
 * Selecteerbare verzendmap-tabel: vink rijen aan (alleen die mét e-mailadres) en
 * verstuur de selectie in één keer. Per rij blijft het oogje-voorbeeld en de
 * losse "Versturen"-knop beschikbaar. De kopregel-checkbox (de)selecteert alles
 * wat verstuurd kan worden.
 */
export function VerzendTable({
  rows,
  week,
  q,
}: {
  rows: VerzendRow[];
  week: string;
  q: string;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  const sendableIds = useMemo(
    () => rows.filter((r) => r.email).map((r) => r.id),
    [rows],
  );
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const ids = selectedRows.map((r) => r.id).join(",");
  const allSendableSelected =
    sendableIds.length > 0 && sendableIds.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(() => (allSendableSelected ? new Set() : new Set(sendableIds)));

  return (
    <div className="space-y-3">
      {/* Selectiebalk: verschijnt zodra je iets aanvinkt */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <span className="text-sm font-medium text-brand-900">
            {selectedRows.length} geselecteerd
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            Selectie wissen
          </button>
          <form action={sendSelected} className="ml-auto">
            <input type="hidden" name="ids" value={ids} />
            <input type="hidden" name="week" value={week} />
            <input type="hidden" name="q" value={q} />
            <SubmitButton size="sm" pendingLabel="Versturen…">
              <Send className="h-4 w-4" /> Verstuur geselecteerde ({selectedRows.length})
            </SubmitButton>
          </form>
        </div>
      )}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH className="w-10">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={allSendableSelected}
                disabled={sendableIds.length === 0}
                onChange={toggleAll}
                aria-label="Alles selecteren"
              />
            </TH>
            <TH>Nummer</TH>
            <TH>Klant</TH>
            <TH>Week</TH>
            <TH>E-mail</TH>
            <TH className="text-right">Bedrag</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id} className={selected.has(row.id) ? "bg-brand-50/50" : undefined}>
              <TD>
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={selected.has(row.id)}
                  disabled={!row.email}
                  onChange={() => toggle(row.id)}
                  aria-label={`Factuur ${row.number} selecteren`}
                  title={row.email ? undefined : "Geen e-mailadres — kan niet verstuurd worden"}
                />
              </TD>
              <TD className="font-medium text-ink-900">{row.number}</TD>
              <TD className="text-ink-700">{row.recipientName}</TD>
              <TD className="whitespace-nowrap text-sm text-ink-500">{weekShort(row.weekKeys)}</TD>
              <TD>
                {row.email ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink-600">
                    <Mail className="h-3.5 w-3.5 text-ink-400" />
                    {row.email}
                  </span>
                ) : (
                  <Link
                    href={row.fixHref}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:underline"
                  >
                    <MailWarning className="h-3.5 w-3.5" /> Geen e-mailadres — toevoegen
                  </Link>
                )}
              </TD>
              <TD className="text-right tabular-nums text-ink-900">{formatCurrency(row.total)}</TD>
              <TD className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <InvoicePreviewButton id={row.id} number={row.number} />
                  {row.email ? (
                    <form action={sendSalesInvoice}>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="week" value={week} />
                      <input type="hidden" name="q" value={q} />
                      <SubmitButton size="sm" pendingLabel="Versturen…">
                        <Send className="h-4 w-4" /> Versturen
                      </SubmitButton>
                    </form>
                  ) : (
                    <Button type="button" size="sm" variant="outline" disabled>
                      <Send className="h-4 w-4" /> Versturen
                    </Button>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
