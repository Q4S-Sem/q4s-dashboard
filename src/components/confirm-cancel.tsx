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
              className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-start gap-3 px-6 pb-5 pt-6">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold leading-snug text-slate-900">
                    {message}
                  </h2>
                  {description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
                  )}
                </div>
              </div>

              {/* Huisstijl van de vensters: doorgaan = groen, terug/annuleren = rood. */}
              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
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
                  Terug
                </button>
                <button
                  type="button"
                  onClick={() => router.push(href)}
                  className={buttonVariants({ variant: "success", size: "md" })}
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
