"use client";

import { useState, useTransition } from "react";
import { Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { sendDiscrepancyMail } from "./actions";

type Result = { ok: boolean; simulated?: boolean; reason?: string };

/**
 * Mailt de medewerker over de afwijking. Na versturen: een pop-up ("mail verzonden")
 * en de knop verdwijnt (er is al gemaild). Werkt als klein icoon (in de lijst) of als
 * volledige knop (op de detailpagina).
 */
export function DiscrepancyMailButton({
  id,
  alreadyMailed = false,
  variant = "icon",
}: {
  id: string;
  alreadyMailed?: boolean;
  variant?: "icon" | "button";
}) {
  const [hidden, setHidden] = useState(alreadyMailed);
  const [popup, setPopup] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  if (hidden) return null;

  function send() {
    start(async () => {
      const res = await sendDiscrepancyMail(id);
      setPopup(res);
      if (res.ok) setHidden(true);
    });
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={send}
          disabled={pending}
          title="Mail de medewerker over de afwijking"
          aria-label="Mail de medewerker"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-brand-600 transition-colors hover:border-brand-200 hover:bg-brand-50 disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className={buttonVariants({ variant: "danger", size: "sm" })}
        >
          <Mail className="h-4 w-4" /> {pending ? "Versturen…" : "Mail de medewerker"}
        </button>
      )}

      {popup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/40 p-4"
          onClick={() => setPopup(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
                popup.ok ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600",
              )}
            >
              {popup.ok ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <h3 className="mt-3 text-lg font-bold text-ink-900">
              {popup.ok ? "Mail verzonden" : "Niet verzonden"}
            </h3>
            <p className="mt-1 text-sm text-ink-500">
              {popup.ok
                ? popup.simulated
                  ? "De mail is klaargezet — stel SMTP in om 'm ook écht te versturen."
                  : "De medewerker heeft een mail gekregen over het verschil."
                : popup.reason === "noemail"
                  ? "Geen e-mailadres bekend voor deze medewerker — vul het eerst in."
                  : "Versturen mislukt — controleer de SMTP-instellingen."}
            </p>
            <button
              type="button"
              onClick={() => setPopup(null)}
              className="mt-5 w-full rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-700"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </>
  );
}
