"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { cn, formatCurrency, formatHours, round2 } from "@/lib/utils";

export type InvoiceLineOption = {
  timesheetId: string;
  label: string;
  hours: number;
  amount: number;
};

export function InvoiceForm({
  action,
  clientId,
  lines,
  vatRate,
  defaultIssueDate,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  clientId: string;
  lines: InvoiceLineOption[];
  vatRate: number;
  defaultIssueDate: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(lines.map((l) => [l.timesheetId, true])),
  );

  const subtotal = round2(
    lines.filter((l) => checked[l.timesheetId]).reduce((s, l) => s + l.amount, 0),
  );
  const vatAmount = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vatAmount);
  const selectedCount = lines.filter((l) => checked[l.timesheetId]).length;

  return (
    <form action={formAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <div className="space-y-6">
        {state.error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Goedgekeurde urenstaten</CardTitle>
            <span className="text-sm text-ink-500">
              {selectedCount} van {lines.length} geselecteerd
            </span>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {lines.map((l, i) => (
              <label
                key={l.timesheetId}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-5 py-3",
                  i > 0 && "border-t border-ink-100",
                  checked[l.timesheetId] ? "bg-white" : "bg-ink-50/60",
                )}
              >
                <input
                  type="checkbox"
                  name="timesheetIds"
                  value={l.timesheetId}
                  checked={!!checked[l.timesheetId]}
                  onChange={(e) =>
                    setChecked((prev) => ({
                      ...prev,
                      [l.timesheetId]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="flex-1 text-sm text-ink-700">{l.label}</span>
                <span className="text-sm text-ink-500 tabular-nums">
                  {formatHours(l.hours)} u
                </span>
                <span className="w-28 text-right text-sm font-medium tabular-nums text-ink-900">
                  {formatCurrency(l.amount)}
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-5">
              <Field label="Factuurdatum" htmlFor="issueDate">
                <Input
                  id="issueDate"
                  name="issueDate"
                  type="date"
                  defaultValue={defaultIssueDate}
                />
              </Field>
              <Field label="Opmerking op factuur" htmlFor="notes">
                <Textarea id="notes" name="notes" placeholder="Optioneel" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-ink-500">Subtotaal (excl. BTW)</span>
                <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-500">BTW ({formatHours(vatRate)}%)</span>
                <span className="font-medium tabular-nums">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-3 text-base font-bold">
                <span>Totaal</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Annuleren
          </Link>
          <SubmitButton pendingLabel="Aanmaken…">Factuur aanmaken</SubmitButton>
        </div>
      </div>
    </form>
  );
}
