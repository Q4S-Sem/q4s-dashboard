"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { SocialPost } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { SOCIAL_PLATFORMS } from "@/lib/domain";

type VacancyOption = { id: string; title: string };

/** Format a Date to the value a <input type="datetime-local"> expects. */
function toLocalInput(value: Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostForm({
  action,
  post,
  vacancies,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  post?: SocialPost;
  vacancies: VacancyOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {post && <input type="hidden" name="id" value={post.id} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Field label="Titel" htmlFor="title" required error={e.title}>
            <Input
              id="title"
              name="title"
              defaultValue={post?.title ?? ""}
              placeholder="Bijv. Vacature lasser 6G — Gorinchem"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Platform" htmlFor="platform" error={e.platform}>
              <Select
                id="platform"
                name="platform"
                defaultValue={post?.platform ?? "LINKEDIN"}
              >
                {SOCIAL_PLATFORMS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Inplannen op"
              htmlFor="scheduledFor"
              hint="Optioneel — wanneer de post de deur uit moet"
              error={e.scheduledFor}
            >
              <Input
                id="scheduledFor"
                name="scheduledFor"
                type="datetime-local"
                defaultValue={toLocalInput(post?.scheduledFor)}
              />
            </Field>
          </div>

          <Field
            label="Gekoppelde vacature"
            htmlFor="vacancyId"
            hint="Optioneel — wordt meegenomen in de AI-post"
            error={e.vacancyId}
          >
            <Select
              id="vacancyId"
              name="vacancyId"
              defaultValue={post?.vacancyId ?? ""}
            >
              <option value="">— geen —</option>
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Aanleiding / context"
              htmlFor="topic"
              hint="Wat moet de AI weten?"
              error={e.topic}
            >
              <Input
                id="topic"
                name="topic"
                defaultValue={post?.topic ?? ""}
                placeholder="Bijv. nieuwe opdracht offshore wind"
              />
            </Field>
            <Field
              label="Hashtags"
              htmlFor="hashtags"
              hint="Bijv. #lassen #vacature"
              error={e.hashtags}
            >
              <Input
                id="hashtags"
                name="hashtags"
                defaultValue={post?.hashtags ?? ""}
              />
            </Field>
          </div>

          <Field
            label="Posttekst"
            htmlFor="content"
            hint="Wordt door AI ingevuld; je kunt het hier aanpassen"
            error={e.content}
          >
            <Textarea
              id="content"
              name="content"
              className="min-h-40"
              defaultValue={post?.content ?? ""}
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
