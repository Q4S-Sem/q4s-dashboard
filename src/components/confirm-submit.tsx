"use client";

import { Button, type ButtonProps } from "./ui/button";

/**
 * Renders a small form that submits a (server) action after a confirm() prompt.
 * Pass an optional `id` (added as a hidden field) and the destructive `action`.
 */
export function ConfirmSubmit({
  action,
  id,
  message = "Weet je het zeker?",
  children,
  variant = "danger",
  size = "md",
  hidden,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id?: string;
  message?: string;
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  /** Extra hidden fields to include in the submission. */
  hidden?: Record<string, string>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {id && <input type="hidden" name="id" value={id} />}
      {hidden &&
        Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <Button type="submit" variant={variant} size={size}>
        {children}
      </Button>
    </form>
  );
}
