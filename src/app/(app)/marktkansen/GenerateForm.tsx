"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { emptyFormState, type FormState } from "@/lib/form";

export function GenerateForm({
  action,
  aiReady,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  aiReady: boolean;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink-900">
                Genereer marktkansen met AI
              </h3>
              <p className="mt-0.5 text-sm text-ink-500">
                Laat AI nieuwe groeikansen voorstellen voor de sectoren van Q4S.
              </p>
            </div>
          </div>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Field label="Waar wil je op focussen? (optioneel)" htmlFor="focus">
            <Textarea
              id="focus"
              name="focus"
              placeholder="Bijv. offshore wind in Noord-Holland, of NDT in de petrochemie"
            />
          </Field>
        </CardContent>
        <CardFooter className="flex justify-end">
          {aiReady ? (
            <SubmitButton pendingLabel="AI denkt na…">
              <Sparkles className="h-4 w-4" /> Genereer kansen met AI
            </SubmitButton>
          ) : (
            <p className="w-full rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Stel ANTHROPIC_API_KEY in je .env in om AI-functies te gebruiken.
            </p>
          )}
        </CardFooter>
      </Card>
    </form>
  );
}
