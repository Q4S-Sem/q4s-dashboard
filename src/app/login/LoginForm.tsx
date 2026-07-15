"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { login } from "./actions";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { emptyFormState } from "@/lib/form";

export function LoginForm() {
  const [state, action] = useActionState(login, emptyFormState);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <Field label="E-mailadres" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="naam@q4s.nl"
          required
          autoFocus
        />
      </Field>
      <Field label="Wachtwoord" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Bezig met inloggen…">
        <LogIn className="h-4 w-4" /> Inloggen
      </SubmitButton>
    </form>
  );
}
