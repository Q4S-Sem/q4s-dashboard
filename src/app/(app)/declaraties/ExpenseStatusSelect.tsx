"use client";

import { useRef } from "react";
import { EXPENSE_STATUSES } from "@/lib/domain";
import { setExpenseStatus } from "./actions";

const TONE: Record<string, string> = {
  NEW: "border-amber-300 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-300 bg-red-50 text-red-700",
  PAID: "border-blue-300 bg-blue-50 text-blue-700",
};

/** Inline status picker — changing it saves immediately. */
export function ExpenseStatusSelect({ id, value }: { id: string; value: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const tone = TONE[value] ?? TONE.NEW;

  return (
    <form ref={formRef} action={setExpenseStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={value}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Status"
        className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 ${tone}`}
      >
        {EXPENSE_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </form>
  );
}
