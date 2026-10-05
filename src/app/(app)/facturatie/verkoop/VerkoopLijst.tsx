"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, ExternalLink, Pencil, Send, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { InvoicePreviewButton } from "@/components/invoice-preview-button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { INVOICE_STATUSES } from "@/lib/domain";
import {
  MAX_OPEN_TABS,
  capOpen,
  invoicePdfHref,
  isDeletableInvoice,
  isReleasableInvoice,
  isSendableInvoice,
} from "@/lib/factuur-bulk";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { vervalLabel, type VervalLabel } from "@/lib/facturatie-lijsten";

const VERVAL_KLEUR: Record<VervalLabel["toon"], string> = {
  rood: "text-red-700",
  oranje: "text-amber-700",
  grijs: "text-ink-600",
  groen: "text-emerald-700",
};
import { bulkDeleteInvoices, bulkReleaseInvoices, bulkSendInvoices, sendInvoiceReminder } from "./actions";

// ---------------------------------------------------------------------------
// De lijst met verkoopfacturen: aanvinken + een balk met wat je met die selectie
// kunt doen. De knoppen tellen met EXACT dezelfde guards als de server-actions
// (src/lib/factuur-bulk.ts), dus "Verzenden (3)" betekent precies drie facturen —
// niet vier die er stiekem bij glippen of twee die stilletjes afvallen.
//
// Er gebeurt hier niets vanzelf: elke knop is een klik, en versturen vraagt
// bovendien om een bevestiging.
// ---------------------------------------------------------------------------

export type VerkoopFactuurRij = {
  id: string;
  number: string;
  clientName: string;
  /** ISO-datums; de server heeft ze al geformatteerd doorgegeven als Date-string. */
  issueDate: string;
  dueDate: string;
  /** Excl. btw. */
  subtotal: number;
  total: number;
  /** Wanneer de klant betaalde (ISO), of null. */
  paidDate: string | null;
  /** De RUWE status — de guards rekenen hiermee. */
  status: string;
  /** De status zoals hij in de badge hoort ("OVERDUE" bij een te late factuur). */
  weergave: string;
  /** Heeft de klant een factuur-e-mailadres? Zonder adres kan er niets uit. */
  heeftMail: boolean;
  herinneringen: number;
  herinnerdOp: string | null;
  /** Te laat en (nog nooit / ≥ 7 dagen geleden) herinnerd. */
  herinnerenNu: boolean;
};

export function VerkoopLijst({ rows, tab }: { rows: VerkoopFactuurRij[]; tab: string }) {
  // ponytail: "nu" komt van de client-klok; prima voor een dagtelling.
  const [nu] = useState(() => new Date());
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [afgetopt, setAfgetopt] = useState(0);

  const zichtbaar = new Set(rows.map((r) => r.id));
  const gekozen = rows.filter((r) => selected.has(r.id));
  const ids = gekozen.map((r) => r.id).join(",");
  const vrijgeefbaar = gekozen.filter((r) => isReleasableInvoice(r.status));
  const verzendbaar = gekozen.filter((r) => isSendableInvoice(r.status));
  const zonderMail = verzendbaar.filter((r) => !r.heeftMail).length;
  const verwijderbaar = gekozen.filter((r) => isDeletableInvoice(r.status));

  const alleGekozen = rows.length > 0 && gekozen.length === rows.length;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAlles = () =>
    setSelected(alleGekozen ? new Set() : new Set(rows.map((r) => r.id)));
  const wissen = () => {
    setSelected(new Set());
    setAfgetopt(0);
  };

  function openSelectie() {
    const res = capOpen(gekozen.map((r) => r.id));
    for (const id of res.open) window.open(invoicePdfHref(id), "_blank", "noopener");
    setAfgetopt(res.capped);
  }

  return (
    <div className="space-y-3">
      {gekozen.length > 0 && (
        <div className="rounded-sm border border-ink-200 bg-ink-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-ink-900">
              {gekozen.length} geselecteerd
            </span>
            <button
              type="button"
              onClick={wissen}
              className="text-[13px] font-medium text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
            >
              Selectie wissen
            </button>

            <span className="flex-1" />

            <Button type="button" variant="outline" size="sm" onClick={openSelectie}>
              <ExternalLink className="h-4 w-4" /> Openen ({gekozen.length})
            </Button>

            {vrijgeefbaar.length > 0 && (
              <ConfirmSubmit
                action={bulkReleaseInvoices}
                hidden={{ ids, tab }}
                trigger="button"
                variant="outline"
                size="sm"
                confirmVariant="primary"
                confirmLabel="Naar klaar"
                message={`${vrijgeefbaar.length} factu${vrijgeefbaar.length === 1 ? "ur" : "ren"} op "klaar om te verzenden" zetten?`}
                description="De concepten zijn dan nagekeken en staan klaar. Er wordt nog niets verstuurd — dat doe je daarna met de knop Verzenden."
              >
                Naar klaar ({vrijgeefbaar.length})
              </ConfirmSubmit>
            )}

            {verzendbaar.length > 0 && (
              <ConfirmSubmit
                action={bulkSendInvoices}
                hidden={{ ids, tab }}
                trigger="button"
                variant="primary"
                size="sm"
                confirmVariant="primary"
                confirmLabel="Ja, versturen"
                message={`${verzendbaar.length} factu${verzendbaar.length === 1 ? "ur" : "ren"} naar de klant versturen?`}
                description={
                  zonderMail > 0
                    ? `De factuur-PDF gaat per e-mail naar de klant. Let op: ${zonderMail} van deze facturen ${zonderMail === 1 ? "heeft" : "hebben"} geen e-mailadres bij de klant en ${zonderMail === 1 ? "blijft" : "blijven"} klaarstaan.`
                    : "De factuur-PDF gaat per e-mail naar de klant en komt daarna op 'Verzonden' te staan."
                }
              >
                <span className="inline-flex items-center gap-2">
                  <Send className="h-4 w-4" /> Verzenden ({verzendbaar.length})
                </span>
              </ConfirmSubmit>
            )}

            {verwijderbaar.length > 0 && (
              <ConfirmSubmit
                action={bulkDeleteInvoices}
                hidden={{ ids, tab }}
                trigger="button"
                variant="danger"
                size="sm"
                message={`${verwijderbaar.length} factu${verwijderbaar.length === 1 ? "ur" : "ren"} verwijderen?`}
                description="Alleen concepten en geannuleerde facturen gaan weg; hun urenstaten komen weer vrij om te factureren. Verstuurde of betaalde facturen blijven staan."
              >
                Verwijderen ({verwijderbaar.length})
              </ConfirmSubmit>
            )}
          </div>

          {(vrijgeefbaar.length + verzendbaar.length + verwijderbaar.length < gekozen.length ||
            afgetopt > 0) && (
            <p className="mt-2 text-xs text-ink-500">
              {vrijgeefbaar.length + verzendbaar.length + verwijderbaar.length < gekozen.length && (
                <>
                  Niet elke geselecteerde factuur kan elke actie: de knoppen hierboven tonen steeds
                  hoeveel er écht meegaan.{" "}
                </>
              )}
              {afgetopt > 0 && (
                <>
                  Er {afgetopt === 1 ? "is 1 PDF" : `zijn ${afgetopt} PDF's`} niet geopend: browsers
                  blokkeren meer dan {MAX_OPEN_TABS} tabbladen tegelijk.
                </>
              )}
            </p>
          )}
        </div>
      )}

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH className="w-10">
              <input
                type="checkbox"
                checked={alleGekozen}
                onChange={toggleAlles}
                aria-label="Alles selecteren"
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
              />
            </TH>
            <TH>Nummer</TH>
            <TH>Klant</TH>
            <TH>Factuurdatum</TH>
            <TH>Vervalt / betaald</TH>
            <TH className="text-right">Excl. btw</TH>
            <TH className="text-right">Totaal</TH>
            <TH>Status</TH>
            <TH className="text-right">Acties</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => {
            const teLaat = r.weergave === "OVERDUE";
            // Concept/klaar/geannuleerd hebben nog geen lopende termijn.
            const loopt = r.status === "SENT" || r.status === "PAID";
            const verval = vervalLabel(r.dueDate, r.status === "PAID", nu);
            return (
              <TR key={r.id} className={teLaat ? "bg-red-50/40" : undefined}>
                <TD>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id) && zichtbaar.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`Factuur ${r.number} selecteren`}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
                  />
                </TD>
                <TD>
                  <Link
                    href={`/facturatie/verkoop/${r.id}`}
                    className="font-medium tabular-nums text-ink-900 hover:text-brand-600"
                  >
                    {r.number}
                  </Link>
                  {!r.heeftMail && (
                    <span className="block text-xs text-amber-700">geen e-mailadres bij de klant</span>
                  )}
                </TD>
                <TD>{r.clientName}</TD>
                <TD className="whitespace-nowrap text-ink-600">{formatDate(r.issueDate)}</TD>
                <TD className="whitespace-nowrap">
                  {r.status === "PAID" ? (
                    <span className="text-[13px] font-medium text-emerald-700">
                      betaald {r.paidDate ? formatDate(r.paidDate) : ""}
                    </span>
                  ) : loopt ? (
                    <span className={cn("text-[13px] font-medium", VERVAL_KLEUR[verval.toon])}>{verval.tekst}</span>
                  ) : (
                    <span className="text-[13px] text-ink-300">—</span>
                  )}
                  <span className="block text-xs text-ink-400">{formatDate(r.dueDate)}</span>
                </TD>
                <TD className="text-right tabular-nums text-ink-500">{formatCurrency(r.subtotal)}</TD>
                <TD className="text-right font-medium tabular-nums">{formatCurrency(r.total)}</TD>
                <TD>
                  <StatusBadge options={INVOICE_STATUSES} value={r.weergave} />
                  {r.herinnerenNu && (
                    <span className="mt-1 block text-xs font-medium text-amber-700">Herinnering aan de beurt</span>
                  )}
                  {r.herinneringen > 0 && (
                    <span className="mt-1 block text-xs text-ink-400">
                      {r.herinneringen}× herinnerd
                      {r.herinnerdOp ? ` · ${formatDate(r.herinnerdOp)}` : ""}
                    </span>
                  )}
                </TD>
                <TD>
                  <div className="relative z-10 flex items-center justify-end gap-1">
                    {teLaat && (
                      <ConfirmSubmit
                        action={sendInvoiceReminder}
                        id={r.id}
                        trigger="icon"
                        icon={<BellRing className="h-4 w-4" />}
                        message={`Betalingsherinnering sturen voor ${r.number}?`}
                        description="Er gaat nu een e-mail naar de klant. De toon loopt op: 1e herinnering, 2e herinnering, daarna een aanmaning."
                        confirmLabel="Herinnering sturen"
                      >
                        Herinnering sturen
                      </ConfirmSubmit>
                    )}
                    <InvoicePreviewButton id={r.id} number={r.number} />
                    <Link
                      href={`/facturatie/verkoop/${r.id}`}
                      className={buttonVariants({ variant: "ghost", size: "icon" })}
                      title="Openen en bewerken"
                      aria-label={`Factuur ${r.number} openen`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    {isDeletableInvoice(r.status) && (
                      <ConfirmSubmit
                        action={bulkDeleteInvoices}
                        trigger="icon"
                        icon={<Trash2 className="h-4 w-4" />}
                        hidden={{ ids: r.id, tab }}
                        message={`Factuur ${r.number} verwijderen?`}
                        description="De urenstaten op deze factuur komen weer vrij om te factureren."
                      >
                        Verwijderen
                      </ConfirmSubmit>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
