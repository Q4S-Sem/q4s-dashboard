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
    <form action={action} className="space-y-5">
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
          className="h-13 px-4 text-base"
        />
      </Field>
      <Field label="Wachtwoord" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-13 px-4 text-base"
        />
      </Field>
      <SubmitButton
        size="lg"
        className="h-13 w-full text-base"
        pendingLabel="Bezig met inloggen…"
      >
        <LogIn className="h-5 w-5" /> Inloggen
      </SubmitButton>
    </form>
  );
}
