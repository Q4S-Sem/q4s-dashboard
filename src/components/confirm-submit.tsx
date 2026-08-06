"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button, buttonVariants, type ButtonProps } from "./ui/button";
import { SubmitButton } from "./ui/submit-button";
import { cn } from "@/lib/utils";

/**
 * Verwijder-/bevestigknop met een rustige in-app bevestiging (geen native
 * confirm()). Onomkeerbare acties krijgen standaard een klein prullenbak-icoon
 * als trigger — een grote rode knop is te makkelijk per ongeluk aan te klikken.
 * In het venster geldt de huisstijl: doorgaan = groen, annuleren = rood.
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
  trigger,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** De vraag/titel in het venster. */
  message?: string;
  /** Optionele toelichting onder de vraag. */
  description?: string;
  children: React.ReactNode;
  id?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  /** Extra verborgen velden die meegestuurd worden. */
  hidden?: Record<string, string>;
  /** Tekst op de bevestigknop (default afgeleid van de variant). */
  confirmLabel?: string;
  /** Stijl van de bevestigknop — alleen nog voor het icoon in de kop. */
  confirmVariant?: ButtonProps["variant"];
  /** Forceer de triggervorm; standaard: icoon bij een gevaarlijke actie. */
  trigger?: "icon" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cv = confirmVariant ?? variant;
  const isDanger = cv === "danger";
  const confirmText = confirmLabel ?? (isDanger ? "Verwijderen" : "Bevestigen");

  // Een gevaarlijke actie in "gewone knop"-vorm wordt een klein icoon, tenzij de
  // aanroeper expliciet iets anders vraagt (bijv. al een ghost-icoonknop).
  const asIcon = trigger === "icon" || (trigger === undefined && variant === "danger" && size === "md");
  const label = typeof children === "string" ? children : "Verwijderen";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus({ preventScroll: true });
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
      {asIcon ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={label}
          aria-label={label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
          {children}
        </Button>
      )}

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-ink-900/50"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              role="alertdialog"
              aria-modal="true"
              className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-ink-200 bg-white shadow-2xl"
            >
              <div className="flex items-start gap-3 px-6 pb-5 pt-6">
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    isDanger ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600",
                  )}
                >
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold leading-snug text-ink-900">
                    {message}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                    {description ?? "Dit kun je hierna niet meer terugdraaien."}
                  </p>
                </div>
              </div>

              <form
                action={action}
                className="flex justify-end gap-2 border-t border-ink-100 bg-ink-50/60 px-6 py-4"
              >
                {id && <input type="hidden" name="id" value={id} />}
                {hidden &&
                  Object.entries(hidden).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className={buttonVariants({
                    variant: "outline",
                    size: "md",
                    className: "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800",
                  })}
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
