"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button, buttonVariants, type ButtonProps } from "./ui/button";
import { SubmitButton } from "./ui/submit-button";
import { DIALOOG, dialoogIcoon } from "./ui/dialoog";

/**
 * Verwijder-/bevestigknop met een rustige in-app bevestiging (geen native
 * confirm()). Onomkeerbare acties krijgen standaard een klein prullenbak-icoon
 * als trigger — een grote rode knop is te makkelijk per ongeluk aan te klikken.
 * In het venster geldt de huisstijl: annuleren = neutrale outline, de bevestiging
 * volgt de variant (verwijderen = rood, de actie die data kwijtraakt).
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
  icon,
  iconClassName,
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
  /** Icoon voor de icoon-trigger (default een prullenbak). */
  icon?: React.ReactNode;
  /** Eigen stijl voor de icoon-trigger (bv. ICOON_KNOP in een knoppengroep). */
  iconClassName?: string;
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
          className={
            iconClassName ??
            "inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          }
        >
          {icon ?? <Trash2 className="h-4 w-4" />}
        </button>
      ) : (
        <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
          {children}
        </Button>
      )}

      {mounted &&
        open &&
        createPortal(
          <div className={DIALOOG.laag}>
            <div className={DIALOOG.achter} aria-hidden onClick={() => setOpen(false)} />
            <div role="alertdialog" aria-modal="true" aria-labelledby="bevestig-titel" className={DIALOOG.paneel}>
              {/* Het eigen icoon van de knop (bv. doorgekruiste wereldbol), anders prullenbak/waarschuwing. */}
              <span className={dialoogIcoon(isDanger ? "rood" : "amber")}>
                {icon ?? (isDanger ? <Trash2 /> : <AlertTriangle />)}
              </span>
              <h2 id="bevestig-titel" className={DIALOOG.titel}>{message}</h2>
              <p className={DIALOOG.uitleg}>{description ?? "Dit kun je hierna niet meer terugdraaien."}</p>

              <form action={action} className={DIALOOG.knoppen}>
                {id && <input type="hidden" name="id" value={id} />}
                {hidden &&
                  Object.entries(hidden).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className={buttonVariants({ variant: "outline", size: "md" })}
                >
                  Annuleren
                </button>
                <SubmitButton variant={cv} size="md" pendingLabel="Bezig…">
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
