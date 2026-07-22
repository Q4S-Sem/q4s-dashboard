"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitNewPassword, type ResetState } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(submitNewPassword, {} as ResetState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <Field label="Nieuw wachtwoord" htmlFor="password" hint="Minimaal 8 tekens.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          minLength={8}
        />
      </Field>
      <Field label="Herhaal wachtwoord" htmlFor="confirm">
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Opslaan…">
        <KeyRound className="h-4 w-4" /> Wachtwoord opslaan
      </SubmitButton>
    </form>
  );
}
