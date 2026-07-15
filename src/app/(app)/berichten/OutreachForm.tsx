"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { OutreachMessage } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { OUTREACH_CHANNELS } from "@/lib/domain";

type VacancyOption = { id: string; title: string };

export function OutreachForm({
  action,
  message,
  vacancies,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  message?: OutreachMessage;
  vacancies: VacancyOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {message && <input type="hidden" name="id" value={message.id} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Field
            label="Naam ontvanger"
            htmlFor="recipientName"
            required
            error={e.recipientName}
          >
            <Input
              id="recipientName"
              name="recipientName"
              defaultValue={message?.recipientName ?? ""}
              placeholder="Bijv. Jan de Vries"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Headline / rol"
              htmlFor="recipientHeadline"
              hint="LinkedIn-headline of functie"
              error={e.recipientHeadline}
            >
              <Input
                id="recipientHeadline"
                name="recipientHeadline"
                defaultValue={message?.recipientHeadline ?? ""}
                placeholder="Bijv. Senior NDT-inspecteur"
              />
            </Field>
            <Field label="Bedrijf" htmlFor="company" error={e.company}>
              <Input
                id="company"
                name="company"
                defaultValue={message?.company ?? ""}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Kanaal" htmlFor="channel" error={e.channel}>
              <Select
                id="channel"
                name="channel"
                defaultValue={message?.channel ?? "LINKEDIN"}
              >
                {OUTREACH_CHANNELS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Onderwerp"
              htmlFor="subject"
              hint="Alleen voor e-mail"
              error={e.subject}
            >
              <Input
                id="subject"
                name="subject"
                defaultValue={message?.subject ?? ""}
              />
            </Field>
          </div>

          <Field
            label="Gekoppelde vacature"
            htmlFor="vacancyId"
            hint="Optioneel — wordt meegenomen in het AI-bericht"
            error={e.vacancyId}
          >
            <Select
              id="vacancyId"
              name="vacancyId"
              defaultValue={message?.vacancyId ?? ""}
            >
              <option value="">— geen —</option>
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Context / aanleiding"
            htmlFor="context"
            hint="Waarom benader je deze persoon? Wat moet de AI weten?"
            error={e.context}
          >
            <Textarea
              id="context"
              name="context"
              className="min-h-28"
              defaultValue={message?.context ?? ""}
            />
          </Field>

          <Field
            label="Bericht"
            htmlFor="draft"
            hint="Wordt door AI ingevuld; je kunt het hier aanpassen"
            error={e.draft}
          >
            <Textarea
              id="draft"
              name="draft"
              className="min-h-40"
              defaultValue={message?.draft ?? ""}
            />
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
