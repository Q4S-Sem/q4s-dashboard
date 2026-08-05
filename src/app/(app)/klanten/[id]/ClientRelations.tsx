"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { INVOICE_STATUSES, PLACEMENT_STATUSES } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/utils";

/** Diacritics-insensitive, case-insensitive fold so "muller" matches "Müller"
 *  and "jose" matches "José" — the international QA/lassen/fitter/NDO workforce
 *  this app serves has plenty of accented names. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** The themed search box (mirrors CertPeopleList). Live, client-side filtering. */
function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="border-b border-ink-100 px-5 py-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="block w-full rounded-lg border border-ink-300 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>
    </div>
  );
}

export type PlacementRow = {
  id: string;
  title: string;
  person: string;
  chargeRate: number;
  status: string;
};

/** Plaatsingen van deze klant, met een zoekfilter op werknemer of functie. */
export function PlacementsPanel({ placements }: { placements: PlacementRow[] }) {
  const [q, setQ] = useState("");
  const term = fold(q.trim());
  const filtered = useMemo(
    () =>
      term
        ? placements.filter(
            (p) => fold(p.person).includes(term) || fold(p.title).includes(term),
          )
        : placements,
    [placements, term],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plaatsingen</CardTitle>
        <Link
          href="/plaatsingen/nieuw"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Plus className="h-4 w-4" /> Nieuwe plaatsing
        </Link>
      </CardHeader>

      {placements.length === 0 ? (
        <CardContent className="text-sm text-ink-500">
          Nog geen plaatsingen voor deze klant.
        </CardContent>
      ) : (
        <>
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Zoek op werknemer of functie…"
            label="Zoek plaatsing op werknemer of functie"
          />
          {filtered.length === 0 ? (
            <CardContent className="text-sm text-ink-500">
              Geen plaatsing gevonden voor “{q}”.
            </CardContent>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Functie</TH>
                  <TH>Werknemer</TH>
                  <TH className="text-right">Tarief</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Link
                        href={`/plaatsingen/${p.id}`}
                        className="font-medium text-ink-900 hover:text-brand-700"
                      >
                        {p.title}
                      </Link>
                    </TD>
                    <TD>{p.person}</TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrency(p.chargeRate)}/u
                    </TD>
                    <TD>
                      <StatusBadge options={PLACEMENT_STATUSES} value={p.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      )}
    </Card>
  );
}

export type InvoiceRow = {
  id: string;
  number: string;
  issueDate: string;
  total: number;
  status: string;
};

/** Facturen van deze klant, met een zoekfilter op factuurnummer. */
export function InvoicesPanel({ invoices }: { invoices: InvoiceRow[] }) {
  const [q, setQ] = useState("");
  const term = fold(q.trim());
  const filtered = useMemo(
    () =>
      term
        ? invoices.filter((inv) => fold(inv.number).includes(term))
        : invoices,
    [invoices, term],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturen</CardTitle>
      </CardHeader>

      {invoices.length === 0 ? (
        <CardContent className="text-sm text-ink-500">
          Nog geen facturen voor deze klant.
        </CardContent>
      ) : (
        <>
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Zoek op factuurnummer…"
            label="Zoek factuur op nummer"
          />
          {filtered.length === 0 ? (
            <CardContent className="text-sm text-ink-500">
              Geen factuur gevonden voor “{q}”.
            </CardContent>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Nummer</TH>
                  <TH>Datum</TH>
                  <TH className="text-right">Bedrag</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((inv) => (
                  <TR key={inv.id}>
                    <TD>
                      <Link
                        href={`/facturen/${inv.id}`}
                        className="font-medium text-ink-900 hover:text-brand-700"
                      >
                        {inv.number}
                      </Link>
                    </TD>
                    <TD>{formatDate(inv.issueDate)}</TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrency(inv.total)}
                    </TD>
                    <TD>
                      <StatusBadge options={INVOICE_STATUSES} value={inv.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      )}
    </Card>
  );
}
