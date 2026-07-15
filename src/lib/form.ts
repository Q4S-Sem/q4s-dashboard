import { z } from "zod";

/** Return shape of a server action used with React's useActionState. */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const emptyFormState: FormState = {};

/**
 * Parse FormData against a Zod schema. Empty strings are treated as undefined
 * so `.optional()` and `.default()` behave intuitively for HTML forms.
 * Returns the typed data on success, or a FormState with fieldErrors on failure.
 */
export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
):
  | { success: true; data: z.infer<T> }
  | { success: false; state: FormState } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      raw[key] = trimmed === "" ? undefined : trimmed;
    } else {
      raw[key] = value;
    }
  }

  const result = schema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { success: false, state: { fieldErrors } };
}
