"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { TargetClient } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { TARGET_STATUSES } from "@/lib/domain";

export function TargetClientForm({
  action,
  target,
  connectors,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  target?: TargetClient;
  connectors: { id: string; name: string }[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {target && <input type="hidden" name="id" value={target.id} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Field label="Naam" htmlFor="name" required error={e.name}>
            <Input
              id="name"
              name="name"
              defaultValue={target?.name ?? ""}
              placeholder="Bijv. Tata Steel B.V."
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Prioriteit" htmlFor="priority" error={e.priority}>
              <Select id="priority" name="priority" defaultValue={String(target?.priority ?? 3)}>
                <option value="1">1 — Laag</option>
                <option value="2">2</option>
                <option value="3">3 — Gemiddeld</option>
                <option value="4">4</option>
                <option value="5">5 — Hoog</option>
              </Select>
            </Field>
            <Field label="Status" htmlFor="status" error={e.status}>
              <Select id="status" name="status" defaultValue={target?.status ?? "PROSPECT"}>
                {TARGET_STATUSES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="VMS-koppeling" htmlFor="vmsConnectorId" error={e.vmsConnectorId}>
              <Select
                id="vmsConnectorId"
                name="vmsConnectorId"
                defaultValue={target?.vmsConnectorId ?? ""}
              >
                <option value="">— geen —</option>
                {connectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sector" htmlFor="sector" error={e.sector}>
              <Input
                id="sector"
                name="sector"
                placeholder="Bijv. Staal, Offshore, Energie"
                defaultValue={target?.sector ?? ""}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Contactpersoon" htmlFor="contactName" error={e.contactName}>
              <Input
                id="contactName"
                name="contactName"
                defaultValue={target?.contactName ?? ""}
              />
            </Field>
            <Field label="Contact-e-mail" htmlFor="contactEmail" error={e.contactEmail}>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={target?.contactEmail ?? ""}
              />
            </Field>
          </div>

          <Field label="Notities" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={target?.notes ?? ""} />
          </Field>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Annuleren
          </Link>
          <SubmitButton>{submitLabel}</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
