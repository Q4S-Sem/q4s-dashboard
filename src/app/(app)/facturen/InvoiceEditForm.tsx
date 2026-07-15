"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea, Label } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, round2 } from "@/lib/utils";
import { emptyFormState, type FormState } from "@/lib/form";

type LineState = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

const num = (s: string) => {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function InvoiceEditForm({
  action,
  invoice,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  invoice: {
    id: string;
    number: string;
    issueDate: string;
    dueDate: string;
    vatRate: number;
    notes: string | null;
    lines: { id: string; description: string; quantity: number; unitPrice: number }[];
  };
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  const [vatRate, setVatRate] = useState(String(invoice.vatRate));
  const [lines, setLines] = useState<LineState[]>(() =>
    invoice.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: String(l.quantity),
      unitPrice: String(l.unitPrice),
    })),
  );

  const lineAmount = (l: LineState) => round2(num(l.quantity) * num(l.unitPrice));
  const subtotal = round2(lines.reduce((s, l) => s + lineAmount(l), 0));
  const vat = round2((subtotal * num(vatRate)) / 100);
  const total = round2(subtotal + vat);

  const setLine = (i: number, patch: Partial<LineState>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  // Serialized for the server action (recomputes amounts + totals itself).
  const linesJson = JSON.stringify(
    lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
    })),
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={invoice.id} />
      <input type="hidden" name="lines" value={linesJson} />
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Field
            label="Factuurnummer"
            htmlFor="number"
            required
            error={e.number}
            hint="Pas alleen aan als er een fout in zit — de automatische nummering loopt daarna gewoon door."
          >
            <Input id="number" name="number" defaultValue={invoice.number} required />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Factuurdatum" htmlFor="issueDate" required error={e.issueDate}>
              <Input id="issueDate" name="issueDate" type="date" defaultValue={invoice.issueDate} required />
            </Field>
            <Field label="Vervaldatum" htmlFor="dueDate" required error={e.dueDate}>
              <Input id="dueDate" name="dueDate" type="date" defaultValue={invoice.dueDate} required />
            </Field>
          </div>

          {/* Editable lines */}
          <div>
            <Label>Factuurregels</Label>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[1fr_5rem_6.5rem_6.5rem] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <span>Omschrijving</span>
                <span className="text-right">Aantal</span>
                <span className="text-right">Tarief</span>
                <span className="text-right">Bedrag</span>
              </div>
              {lines.map((l, i) => (
                <div
                  key={l.id}
                  className="grid grid-cols-[1fr_5rem_6.5rem_6.5rem] items-center gap-2 border-t border-slate-50 px-3 py-2 first:border-t-0"
                >
                  <Input
                    aria-label="Omschrijving"
                    value={l.description}
                    onChange={(ev) => setLine(i, { description: ev.target.value })}
                  />
                  <NumberInput
                    aria-label="Aantal"
                    min={0}
                    step="any"
                    className="px-2 text-right"
                    value={l.quantity}
                    onChange={(ev) => setLine(i, { quantity: ev.target.value })}
                  />
                  <NumberInput
                    aria-label="Tarief"
                    min={0}
                    step="0.01"
                    className="px-2 text-right"
                    value={l.unitPrice}
                    onChange={(ev) => setLine(i, { unitPrice: ev.target.value })}
                  />
                  <div className="text-right text-sm tabular-nums text-slate-700">
                    {formatCurrency(lineAmount(l))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Pas omschrijving, aantal of tarief aan — het bedrag, subtotaal, BTW en
              totaal worden automatisch herberekend.
            </p>
          </div>

          {/* Live totals */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <Field label="BTW-tarief (%)" htmlFor="vatRate" required error={e.vatRate} className="sm:max-w-[12rem]">
              <NumberInput
                id="vatRate"
                name="vatRate"
                min={0}
                max={100}
                step="0.01"
                value={vatRate}
                onChange={(ev) => setVatRate(ev.target.value)}
              />
            </Field>
            <div className="w-full space-y-1.5 text-sm sm:w-64">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotaal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">BTW ({num(vatRate)}%)</span>
                <span className="tabular-nums">{formatCurrency(vat)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-900">
                <span>Totaal</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <Field label="Notitie" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={invoice.notes ?? ""} />
          </Field>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Annuleren
          </Link>
          <SubmitButton>Wijzigingen opslaan</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
