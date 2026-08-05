"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestReset, type ResetRequestState } from "./actions";

export function ForgotForm() {
  const [state, action] = useActionState(requestReset, {} as ResetRequestState);

  if (state.sent) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een e-mail met een
            link om je wachtwoord opnieuw in te stellen. Kijk ook even in je spam.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" /> Terug naar inloggen
        </Link>
      </div>
    );
  }

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
      <SubmitButton className="w-full" pendingLabel="Versturen…">
        <Mail className="h-4 w-4" /> Stuur herstel-link
      </SubmitButton>
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar inloggen
      </Link>
    </form>
  );
}
