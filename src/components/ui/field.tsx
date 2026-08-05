import * as React from "react";
import { cn } from "@/lib/utils";
import { DateInput } from "./date-input";
import { NumberInput } from "./number-input";

// The themed, rounded select that replaces the native one (browser popups can't
// be styled). Same import path + API, so every form keeps working.
export { Select } from "./select";

// Strak invoerveld: rechte hoeken, dunne rand, oranje focus — zoals de
// formulieren op q4s.nl.
const fieldBase =
  "block w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:bg-ink-50";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type, ...props }, ref) {
  // Date / datetime inputs get the themed custom picker (the native calendar
  // popup is un-stylable). Submits the same value via a hidden input.
  if (type === "date" || type === "datetime-local") {
    return (
      <DateInput
        withTime={type === "datetime-local"}
        id={props.id}
        name={props.name}
        required={props.required}
        disabled={props.disabled}
        defaultValue={
          typeof props.defaultValue === "string"
            ? props.defaultValue
            : typeof props.value === "string"
              ? props.value
              : undefined
        }
        className={className}
      />
    );
  }
  // Number inputs select-all on focus/click so typing replaces a pre-filled
  // value (e.g. a 0) instead of appending to it.
  if (type === "number") {
    return <NumberInput ref={ref} className={className} {...props} />;
  }
  // Alle tijden afgerond op het kwartier: een default step van 900s (15 min) laat
  // de native tijdpicker 00/15/30/45 tonen i.p.v. elke minuut. Overschrijfbaar.
  if (type === "time") {
    const { step, ...rest } = props;
    return <input ref={ref} type="time" step={step ?? 900} className={cn(fieldBase, className)} {...rest} />;
  }
  return <input ref={ref} type={type} className={cn(fieldBase, className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, "min-h-20 resize-y", className)}
      {...props}
    />
  );
});

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500",
        className,
      )}
      {...props}
    />
  );
}

/** A label + control wrapper with optional hint and error message. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-0", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-brand-600">*</span>}
        </Label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
