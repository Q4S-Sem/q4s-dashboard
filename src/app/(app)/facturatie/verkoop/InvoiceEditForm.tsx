"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea, Label } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button, buttonVariants } from "@/components/ui/button";
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

/** Uniek tijdelijk id voor een nieuwe regel (server ziet dit niet als bestaand). */
let tmpSeq = 0;
const newLineId = () => `new-${Date.now()}-${tmpSeq++}`;

export function InvoiceEditForm({
  action,
  invoice,
  cancelHref,
  previewUrl,
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
  /** POST-route die de live factuur-PDF rendert uit de concept-gegevens.
   *  Weglaten = geen voorbeeld (bijv. legacy inkoopfacturen). */
  previewUrl?: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  const [number, setNumber] = useState(invoice.number);
  const [issueDate, setIssueDate] = useState(invoice.issueDate);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [notes, setNotes] = useState(invoice.notes ?? "");
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
  const addLine = () =>
    setLines((prev) => [...prev, { id: newLineId(), description: "", quantity: "1", unitPrice: "0" }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  // Serialized for the server action (recomputes amounts + totals itself).
  const linesJson = JSON.stringify(
    lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
    })),
  );

  // --- Live voorbeeld: debounced POST → blob → iframe -----------------------
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const lastUrl = useRef<string>("");

  useEffect(() => {
    if (!previewUrl) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setPreviewBusy(true);
      try {
        const res = await fetch(previewUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number,
            issueDate,
            dueDate,
            vatRate: num(vatRate),
            notes,
            lines: lines.map((l) => ({
              description: l.description,
              quantity: num(l.quantity),
              unitPrice: num(l.unitPrice),
            })),
          }),
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        // De oude blob-url opruimen zodra de nieuwe klaarstaat.
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        lastUrl.current = url;
        setPreviewSrc(`${url}#toolbar=0&navpanes=0&view=FitH`);
      } catch {
        /* stil: het voorbeeld is hulpmiddel, geen blokkade */
      } finally {
        if (!cancelled) setPreviewBusy(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number, issueDate, dueDate, vatRate, notes, linesJson, previewUrl]);

  // Laatste blob-url opruimen bij unmount.
  useEffect(() => {
    return () => {
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    };
  }, []);

  return (
    <div className={previewUrl ? "grid gap-6 lg:grid-cols-2" : "mx-auto max-w-3xl"}>
      {/* Links: het bewerkbare formulier */}
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
              <Input
                id="number"
                name="number"
                value={number}
                onChange={(ev) => setNumber(ev.target.value)}
                required
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Factuurdatum" htmlFor="issueDate" required error={e.issueDate}>
                <Input
                  id="issueDate"
                  name="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(ev) => setIssueDate(ev.target.value)}
                  required
                />
              </Field>
              <Field label="Vervaldatum" htmlFor="dueDate" required error={e.dueDate}>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(ev) => setDueDate(ev.target.value)}
                  required
                />
              </Field>
            </div>

            {/* Editable lines */}
            <div>
              <Label>Factuurregels</Label>
              <div className="overflow-hidden rounded-lg border border-ink-200">
                <div className="grid grid-cols-[1fr_5rem_6.5rem_6.5rem_2rem] gap-2 border-b border-ink-100 bg-ink-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">
                  <span>Omschrijving</span>
                  <span className="text-right">Aantal</span>
                  <span className="text-right">Tarief</span>
                  <span className="text-right">Bedrag</span>
                  <span></span>
                </div>
                {lines.map((l, i) => (
                  <div
                    key={l.id}
                    className="grid grid-cols-[1fr_5rem_6.5rem_6.5rem_2rem] items-center gap-2 border-t border-ink-50 px-3 py-2 first:border-t-0"
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
                    <div className="text-right text-sm tabular-nums text-ink-700">
                      {formatCurrency(lineAmount(l))}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      disabled={lines.length === 1}
                      title={lines.length === 1 ? "Een factuur heeft minstens één regel" : "Regel verwijderen"}
                      aria-label="Regel verwijderen"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4" /> Regel toevoegen
                </Button>
                <p className="text-xs text-ink-400">
                  Bedrag, subtotaal, BTW en totaal worden automatisch herberekend.
                </p>
              </div>
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
                  <span className="text-ink-500">Subtotaal</span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">BTW ({num(vatRate)}%)</span>
                  <span className="tabular-nums">{formatCurrency(vat)}</span>
                </div>
                <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-bold text-ink-900">
                  <span>Totaal</span>
                  <span className="tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <Field label="Notitie" htmlFor="notes" error={e.notes}>
              <Textarea
                id="notes"
                name="notes"
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
              />
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

      {/* Rechts: het live factuurvoorbeeld (echte Q4S-PDF) */}
      {previewUrl && (
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between px-1 pb-2">
            <Label>Voorbeeld</Label>
            <span className="text-xs text-ink-400" aria-live="polite">
              {previewBusy ? "Voorbeeld bijwerken…" : "Werkt mee terwijl je typt"}
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-ink-200 bg-ink-100">
            {previewSrc ? (
              <iframe
                title={`Voorbeeld factuur ${number}`}
                src={previewSrc}
                className="h-[calc(100vh-190px)] min-h-[640px] w-full border-0"
              />
            ) : (
              <div className="flex h-[calc(100vh-190px)] min-h-[640px] w-full items-center justify-center text-sm text-ink-400">
                Voorbeeld wordt geladen…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
