"use client";

import { useEffect, useRef, useState } from "react";
import { EXPENSE_STATUSES } from "@/lib/domain";
import { Select } from "@/components/ui/field";
import { setExpenseStatus } from "./actions";

/** Inline status picker — changing it saves immediately. Gebruikt de gedeelde
 *  Select; de status-kleur zit in het gekleurde stipje (data-color). */
export function ExpenseStatusSelect({ id, value }: { id: string; value: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState(value);
  const first = useRef(true);

  // Verzend het formulier PAS nadat de nieuwe status in het verborgen veld staat
  // (na re-render), zodat de juiste waarde meegaat i.p.v. de vorige.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    formRef.current?.requestSubmit();
  }, [status]);

  return (
    <form ref={formRef} action={setExpenseStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Select
        aria-label="Status"
        defaultValue={value}
        onValueChange={setStatus}
        className="w-40"
      >
        {EXPENSE_STATUSES.map((s) => (
          <option key={s.value} value={s.value} data-color={s.color}>
            {s.label}
          </option>
        ))}
      </Select>
    </form>
  );
}
