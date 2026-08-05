"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants, type ButtonProps } from "./ui/button";
import { SubmitButton } from "./ui/submit-button";
import { cn } from "@/lib/utils";

/**
 * Delete-/bevestig-knop met een NETTE in-app modal (geen native confirm()).
 * De trigger toont `children`; na bevestigen wordt de (server)action verzonden.
 * `id` + `hidden` worden als verborgen velden meegestuurd.
 */
export function ConfirmSubmit({
  action,
  id,
  message = "Weet je het zeker?",
  description,
  children,
  variant = "danger",
  size = "md",
  hidden,
  confirmLabel,
  confirmVariant,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id?: string;
  /** De vraag/titel in de modal. */
  message?: string;
  /** Optionele toelichting onder de vraag. */
  description?: string;
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  /** Extra hidden fields to include in the submission. */
  hidden?: Record<string, string>;
  /** Tekst op de bevestig-knop in de modal (default afgeleid van de variant). */
  confirmLabel?: string;
  /** Stijl van de bevestig-knop in de modal (default = `variant`). Zo kan de
   *  trigger een subtiel ghost-icoon zijn terwijl de bevestiging rood/danger is. */
  confirmVariant?: ButtonProps["variant"];
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // De knoppen ín de pop-up volgen één huisstijl: doorgaan = groen, annuleren =
  // rood. `variant`/`confirmVariant` bepalen alleen nog de trigger + het icoon
  // (rood waarschuwingsrondje bij iets onomkeerbaars).
  const cv = confirmVariant ?? variant;
  const isDanger = cv === "danger";
  const confirmText = confirmLabel ?? (isDanger ? "Verwijderen" : "Bevestigen");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {children}
      </Button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              role="alertdialog"
              aria-modal="true"
              className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/5"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    isDanger ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600",
                  )}
                >
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-base font-semibold text-slate-900">{message}</h2>
                  {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
                </div>
              </div>

              <form action={action} className="mt-5 flex justify-end gap-2">
                {id && <input type="hidden" name="id" value={id} />}
                {hidden &&
                  Object.entries(hidden).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className={buttonVariants({ variant: "danger", size: "md" })}
                >
                  Annuleren
                </button>
                <SubmitButton variant="success" size="md" pendingLabel="Bezig…">
                  {confirmText}
                </SubmitButton>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
