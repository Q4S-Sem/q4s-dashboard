"use client";

import { DIALOOG, dialoogIcoon } from "./ui/dialoog";
import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "./ui/button";

/**
 * Opslaan-knop met een bevestiging vóóraf.
 *
 * Verschil met `ConfirmSubmit`: die verstuurt zijn eigen mini-formulier (prima
 * voor "verwijder rij X"), maar hier moet juist het formulier eromheen mét alle
 * ingevulde velden weg. Daarom roept deze knop bij bevestigen `onConfirm` aan —
 * in de praktijk `form.requestSubmit()` — en blijft het echte formulier de
 * server-actie doen. Voor formulieren waarvan de gevolgen buiten dit scherm
 * zichtbaar worden, zoals bedrijfsgegevens die op elke factuur belanden.
 *
 * Huisstijl van de vensters: doorgaan = groen, terug = rood.
 */
export function ConfirmSave({
  onConfirm,
  message = "Weet je het zeker?",
  description,
  confirmLabel = "Ja, opslaan",
  pendingLabel = "Bezig…",
  children,
}: {
  /** Aangeroepen bij bevestigen, bijv. `() => formRef.current?.requestSubmit()`. */
  onConfirm: () => void;
  /** De vraag in het venster. */
  message?: string;
  /** Toelichting onder de vraag — leg uit wat er verandert. */
  description?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  children: React.ReactNode;
}) {
  // Staat de knop in het formulier, dan weet hij zelf wanneer het opslaan loopt.
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

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
      <Button type="button" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? pendingLabel : children}
      </Button>

      {/* Het venster verschijnt pas na een klik, dus na hydratie — geen mismatch. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={DIALOOG.laag}>
            <div className={DIALOOG.achter} aria-hidden onClick={() => setOpen(false)} />
            <div role="alertdialog" aria-modal="true" className={DIALOOG.paneel}>
              <span className={dialoogIcoon("amber")}>
                <TriangleAlert />
              </span>
              <h2 className={DIALOOG.titel}>{message}</h2>
              {description && <p className={DIALOOG.uitleg}>{description}</p>}

              <div className={DIALOOG.knoppen}>
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
                  onClick={() => {
                    setOpen(false);
                    onConfirm();
                  }}
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
