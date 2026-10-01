"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Landmark, FileSpreadsheet, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { FileInput } from "@/components/ui/file-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BANK_MATCH_CONFIDENCES, type BankMatchRow } from "@/lib/bank-matching";
import { importBankStatement, markBankMatchesPaid, type BankImportState } from "./actions";

/** Nog niets ingelezen — een "use server"-module mag alleen functies exporteren. */
const LEEG: BankImportState = {};

/** De boekdatum als sleutel in de checkbox-waarde (jjjj-mm-dd, UTC = de boekdag). */
function bookingDay(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

function detailHref(row: BankMatchRow): string {
  return `${row.kind === "sales" ? "/facturen" : "/ontvangen-facturen"}/${row.invoiceId}`;
}

function ReviewRow({ row }: { row: BankMatchRow }) {
  const bedrag = row.entry.amount;
  const bij = bedrag >= 0;
  return (
    <tr className="align-top">
      <td className="py-2.5 pr-2">
        {row.invoiceId ? (
          <input
            type="checkbox"
            name="selectie"
            value={`${row.kind}|${row.invoiceId}|${bookingDay(row.entry.date)}`}
            defaultChecked={row.preselected}
            aria-label={`Factuur ${row.invoiceNumber ?? ""} als betaald markeren`}
            className="mt-1 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
          />
        ) : (
          <span className="sr-only">Geen voorstel</span>
        )}
      </td>
      <td className="py-2.5 px-2 text-ink-600">{formatDate(row.entry.date)}</td>
      <td className="py-2.5 px-2">
        <span className={`font-semibold tabular-nums ${bij ? "text-emerald-700" : "text-amber-700"}`}>
          {bij ? "+" : "−"}
          {formatCurrency(Math.abs(bedrag))}
        </span>
        <span className="block text-xs text-ink-400">{bij ? "Bijschrijving" : "Afschrijving"}</span>
      </td>
      <td className="py-2.5 px-2">
        <span className="text-ink-800">{row.entry.counterpartyName ?? "—"}</span>
        {row.entry.counterpartyIban && (
          <span className="block font-mono text-xs text-ink-400">{row.entry.counterpartyIban}</span>
        )}
        {row.entry.remittance && (
          <span className="mt-0.5 block text-xs text-ink-500">{row.entry.remittance}</span>
        )}
      </td>
      <td className="py-2.5 px-2">
        {row.invoiceId ? (
          <>
            <Link href={detailHref(row)} className="font-medium text-ink-900 hover:underline">
              {row.invoiceNumber ?? "(zonder nummer)"}
            </Link>
            <span className="block text-xs text-ink-500">{row.partyName}</span>
            <span className="block text-xs tabular-nums text-ink-400">
              {formatCurrency(row.invoiceAmount ?? 0)}
            </span>
          </>
        ) : (
          <span className="text-ink-400">—</span>
        )}
      </td>
      <td className="py-2.5 px-2">
        <StatusBadge options={BANK_MATCH_CONFIDENCES} value={row.confidence} />
        <span className="mt-1 block max-w-md text-xs text-ink-500">{row.reason}</span>
      </td>
    </tr>
  );
}

/**
 * Bankafschrift (CAMT.053) inlezen en de voorgestelde koppelingen nalopen.
 *
 * Twee aparte formulieren naast elkaar: het bovenste leest het bestand (puur
 * lezen, niets wordt opgeslagen of afgeboekt), het onderste boekt pas ná een
 * expliciete klik de AANGEVINKTE regels af. Alleen voorstellen met zekerheid
 * "hoog" staan voorgevinkt; de rest zet je er zelf bij.
 */
export function BankImport() {
  const [state, formAction] = useActionState(importBankStatement, LEEG);
  const result = state.result;
  const koppelbaar = result?.rows.filter((r) => r.invoiceId) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4 text-brand-600" /> Bankafschrift importeren (CAMT.053)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="min-w-72 flex-1">
            <FileInput name="file" accept=".xml,text/xml,application/xml" hint="CAMT.053-dagafschrift (.xml)" />
          </div>
          <SubmitButton variant="outline" pendingLabel="Inlezen…">
            <FileSpreadsheet className="h-4 w-4" /> Bestand inlezen
          </SubmitButton>
        </form>

        <div className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <p>
            Het bestand wordt alleen in het geheugen gelezen en <strong>niet opgeslagen</strong>. Inlezen
            boekt niets af: je ziet eerst de voorstellen en bepaalt zelf wat er op betaald gaat.
          </p>
        </div>

        {state.error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
        )}

        {result && (
          <form action={markBankMatchesPaid} className="space-y-3">
            <p className="text-sm text-ink-600">
              <strong>{result.fileName}</strong> · {result.summary.entries} boekingen
              {result.ibans.length > 0 && <> · rekening {result.ibans.join(", ")}</>} ·{" "}
              {formatCurrency(result.summary.credit)} bij, {formatCurrency(Math.abs(result.summary.debit))} af
              {" · "}
              {result.summary.hoog} hoog, {result.summary.midden} midden, {result.summary.laag} laag,{" "}
              {result.summary.geen} zonder voorstel.
            </p>
            {result.truncated && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Het afschrift bevat meer boekingen dan we in één keer tonen; alleen de eerste zijn
                ingelezen. Splits het bestand per dag of periode.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-2">
                      <span className="sr-only">Selecteren</span>
                    </th>
                    <th className="py-2 px-2">Boekdatum</th>
                    <th className="py-2 px-2">Bedrag</th>
                    <th className="py-2 px-2">Tegenpartij / omschrijving</th>
                    <th className="py-2 px-2">Voorgestelde factuur</th>
                    <th className="py-2 px-2">Zekerheid &amp; reden</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {result.rows.map((row) => (
                    <ReviewRow key={row.index} row={row} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-3">
              <p className="text-xs text-ink-500">
                Alleen aangevinkte regels worden afgeboekt: status <strong>Betaald</strong> met de
                boekdatum van het afschrift als betaaldatum. Controleer zelf wat niet op &quot;hoog&quot; staat.
              </p>
              <SubmitButton variant="success" pendingLabel="Afboeken…" disabled={koppelbaar.length === 0}>
                Geselecteerde als betaald markeren
              </SubmitButton>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
