"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Mirrors `fieldBase` in field.tsx (kept local to avoid a circular import).
const base =
  "block w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-ink-50";

function selectAll(el: HTMLInputElement) {
  // Number inputs reject setSelectionRange in some browsers; .select() is safe
  // but guard anyway.
  try {
    el.select();
  } catch {
    /* no-op */
  }
}

/**
 * A number `<input>` that selects its whole value the moment you focus OR click
 * it, so typing replaces the existing value (e.g. a pre-filled 0) instead of
 * appending to it ("0" + "8" → "08"). Handles both keyboard (focus) and mouse
 * (mousedown, where the default caret placement would otherwise clear the
 * selection). Drop-in for any number input.
 */
export const NumberInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function NumberInput({ className, onFocus, onMouseDown, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="number"
      onFocus={(e) => {
        selectAll(e.currentTarget);
        onFocus?.(e);
      }}
      onMouseDown={(e) => {
        // First click on an unfocused field: focus + select all, and skip the
        // default caret placement that would deselect it. Once focused, normal
        // click behaviour (caret positioning) is kept.
        if (document.activeElement !== e.currentTarget) {
          e.preventDefault();
          e.currentTarget.focus();
          selectAll(e.currentTarget);
        }
        onMouseDown?.(e);
      }}
      className={cn(base, className)}
      {...props}
    />
  );
});
