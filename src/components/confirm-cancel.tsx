"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

/**
 * Rode "Annuleren"-knop met een NETTE in-app bevestiging. Bij bevestigen
 * navigeert hij naar `href` (de ingevoerde gegevens gaan dan verloren). Puur
 * navigatie — geen server-actie — dus veilig voor een formulier waarin nog niets
 * is opgeslagen. Voorkomt dat je per ongeluk je werk kwijtraakt.
 */
export function ConfirmCancel({
  href,
  label = "Annuleren",
  message = "Weet je zeker dat je wilt annuleren?",
  description = "Alles wat je hebt ingevuld gaat verloren en wordt niet opgeslagen.",
  confirmLabel = "Ja, annuleren",
  size = "md",
  className,
}: {
  href: string;
  label?: string;
  message?: string;
  description?: string;
  confirmLabel?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonVariants({ variant: "danger", size }), className)}
      >
        {label}
      </button>

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
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-base font-semibold text-slate-900">{message}</h2>
                  {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className={buttonVariants({ variant: "outline", size: "md" })}
                >
                  Terug
                </button>
                <button
                  type="button"
                  onClick={() => router.push(href)}
                  className={buttonVariants({ variant: "danger", size: "md" })}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
