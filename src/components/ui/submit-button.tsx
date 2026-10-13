"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

/** A submit button that shows a pending state while its form action runs.
 *  `confirm` = eerst "Weet je het zeker?" (bijv. vóór een mail naar buiten). */
export function SubmitButton({
  children,
  pendingLabel = "Bezig…",
  disabled,
  confirm,
  ...props
}: ButtonProps & { pendingLabel?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
      {...props}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
