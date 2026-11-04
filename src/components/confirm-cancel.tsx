"use client";

import { DIALOOG, dialoogIcoon } from "./ui/dialoog";
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
  variant = "danger",
  className,
}: {
  href: string;
  label?: string;
  message?: string;
  description?: string;
  confirmLabel?: string;
  size?: "sm" | "md";
  variant?: "danger" | "ghost";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonVariants({ variant, size }), className)}
      >
        {label}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div className={DIALOOG.laag}>
            <div className={DIALOOG.achter} aria-hidden onClick={() => setOpen(false)} />
            <div role="alertdialog" aria-modal="true" className={DIALOOG.paneel}>
              <span className={dialoogIcoon("amber")}>
                <AlertTriangle />
              </span>
              <h2 className={DIALOOG.titel}>{message}</h2>
              {description && <p className={DIALOOG.uitleg}>{description}</p>}

              {/* Huisstijl: neutrale 'Terug' (blijf veilig werken) + rode
                  destructieve bevestiging (invoer gaat verloren). */}
              <div className={DIALOOG.knoppen}>
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
