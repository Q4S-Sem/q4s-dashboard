"use client";

import { useActionState } from "react";
import { KeyRound, MailCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import {
  requestPasswordChange,
  confirmPasswordCode,
  type PwState,
} from "./actions";

const leeg: PwState = {};

/**
 * Wachtwoord wijzigen in twee stappen: eerst het nieuwe wachtwoord kiezen (met
 * je huidige ter controle), daarna de code uit de e-mail. Pas na de code wordt
 * het nieuwe wachtwoord actief.
 */
export function PasswordForm({ email }: { email: string }) {
  const [aanvraag, vraagAan] = useActionState(requestPasswordChange, leeg);
  const [bevestig, bevestigAan] = useActionState(confirmPasswordCode, leeg);

  // Stap 2 zodra er een code is verstuurd en de bevestiging nog niet rond is.
  const wachtOpCode = (aanvraag.sent || bevestig.sent) && !bevestig.done;

  if (bevestig.done) {
    return (
      <Card>
        <CardContent className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink-900">
              Je wachtwoord is gewijzigd
            </p>
            <p className="mt-1 text-sm text-ink-500">
              Gebruik vanaf nu je nieuwe wachtwoord om in te loggen. Openstaande
              herstel-links zijn ongeldig gemaakt.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (wachtOpCode) {
    return (
      <form action={bevestigAan}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="h-4 w-4 text-brand-600" /> Stap 2 — code uit je e-mail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-500">
              We hebben een code van 6 cijfers gestuurd naar{" "}
              <strong className="font-semibold text-ink-900">{email}</strong>. De
              code is 15 minuten geldig.
            </p>

            {aanvraag.simulated && (
              <p className="rounded-sm bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Let op: er is geen mailserver ingesteld, dus de e-mail is niet
                echt verstuurd.
              </p>
            )}
            {bevestig.error && (
              <p className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700">
                {bevestig.error}
              </p>
            )}

            <Field label="Verificatiecode" htmlFor="code" required>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                required
                autoFocus
                className="max-w-[12rem] text-center text-lg font-semibold tracking-[0.35em]"
              />
            </Field>
          </CardContent>
          <CardFooter className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Opnieuw beginnen
            </Button>
            <SubmitButton pendingLabel="Controleren…">
              Wachtwoord activeren
            </SubmitButton>
          </CardFooter>
        </Card>
      </form>
    );
  }

  return (
    <form action={vraagAan}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-brand-600" /> Stap 1 — kies een nieuw wachtwoord
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="flex items-start gap-2 text-sm text-ink-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />
            Na het opslaan sturen we een code naar {email}. Je nieuwe wachtwoord
            werkt pas als je die code hier invult.
          </p>

          {aanvraag.error && (
            <p className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700">
              {aanvraag.error}
            </p>
          )}

          <Field label="Huidig wachtwoord" htmlFor="current" required>
            <Input
              id="current"
              name="current"
              type="password"
              autoComplete="current-password"
              required
              className="max-w-md"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nieuw wachtwoord"
              htmlFor="next"
              hint="Minimaal 8 tekens"
              required
            >
              <Input
                id="next"
                name="next"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field label="Herhaal nieuw wachtwoord" htmlFor="repeat" required>
              <Input
                id="repeat"
                name="repeat"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <SubmitButton pendingLabel="Code versturen…">
            Code naar mijn e-mail sturen
          </SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
