"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trophy, XCircle, RotateCcw, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { closeDeal, reopenDeal, rematchDeal } from "./actions";

type Pending = null | "won" | "rematch" | "lost";

/**
 * De afsluit-acties van een deal, als één rustige balk. Elke actie opent eerst
 * een pop-up (modal) ter bevestiging voordat hij wordt uitgevoerd:
 *  - Geplaatst (gewonnen)
 *  - Andere vacature — haalt de deal uit de pipeline en stuurt je terug naar de
 *    talentpool om dezelfde kandidaat op een andere vacature te zetten.
 *  - Niet doorgegaan (verloren) — met reden-veld (voedt de inzichten).
 * Gesloten deal: Heropenen.
 */
export function CloseDealButtons({ dealId, status }: { dealId: string; status: string }) {
  const [pending, setPending] = useState<Pending>(null);

  if (status !== "OPEN") {
    return (
      <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
        <form action={reopenDeal} className="flex items-center justify-between gap-3">
          <input type="hidden" name="id" value={dealId} />
          <p className="text-sm text-ink-500">Deze deal is afgesloten.</p>
          <Button type="submit" variant="outline" size="sm">
            <RotateCcw className="h-4 w-4" /> Heropenen
          </Button>
        </form>
      </div>
    );
  }

  return (
    <>
      {/* Standaardweergave: de drie knoppen */}
      <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-500">Rond deze plaatsing af:</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="success" size="sm" onClick={() => setPending("won")}>
              <Trophy className="h-4 w-4" /> Geplaatst
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPending("rematch")}>
              <Repeat className="h-4 w-4" /> Andere vacature zoeken
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPending("lost")}>
              <XCircle className="h-4 w-4 text-red-500" /> Niet doorgegaan
            </Button>
          </div>
        </div>
      </div>

      {/* Pop-up meldingen (modal) per actie */}
      {pending === "won" && (
        <ConfirmModal
          tone="success"
          title="Deal markeren als geplaatst?"
          message="De kandidaat is geplaatst en de deal wordt gesloten als gewonnen. Je kunt de deal later heropenen als het toch nodig is."
          onClose={() => setPending(null)}
        >
          <form action={closeDeal}>
            <input type="hidden" name="id" value={dealId} />
            <input type="hidden" name="outcome" value="WON" />
            <Button type="submit" variant="success" size="sm">
              <Trophy className="h-4 w-4" /> Ja, geplaatst
            </Button>
          </form>
        </ConfirmModal>
      )}

      {pending === "rematch" && (
        <ConfirmModal
          tone="brand"
          title="Andere vacature zoeken?"
          message="De deal wordt uit deze pipeline gehaald en je gaat terug naar de talentpool om dezelfde kandidaat op een andere vacature te zetten. De huidige deal wordt gesloten."
          onClose={() => setPending(null)}
        >
          <form action={rematchDeal}>
            <input type="hidden" name="id" value={dealId} />
            <Button type="submit" variant="primary" size="sm">
              <Repeat className="h-4 w-4" /> Ja, andere vacature zoeken
            </Button>
          </form>
        </ConfirmModal>
      )}

      {pending === "lost" && (
        <ConfirmModal
          tone="danger"
          title="Deal sluiten als niet doorgegaan?"
          message="De deal wordt gesloten als verloren. Geef kort een reden op — die telt mee in de inzichten."
          onClose={() => setPending(null)}
          hideDefaultCancel
        >
          <form action={closeDeal} className="flex w-full flex-col gap-3">
            <input type="hidden" name="id" value={dealId} />
            <input type="hidden" name="outcome" value="LOST" />
            <Input
              name="lostReason"
              placeholder="Waarom ging het niet door? (bijv. prijs, geen match)…"
              className="h-10 w-full"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPending(null)}>
                Annuleren
              </Button>
              <Button type="submit" variant="danger" size="sm">
                Ja, niet doorgegaan
              </Button>
            </div>
          </form>
        </ConfirmModal>
      )}
    </>
  );
}

/**
 * Bevestig-pop-up: een gecentreerde modal met overlay. Sluit via de knop, de
 * achtergrond, of Escape.
 */
function ConfirmModal({
  tone,
  title,
  message,
  children,
  onClose,
  hideDefaultCancel,
}: {
  tone: "success" | "danger" | "brand";
  title: string;
  message: string;
  children: React.ReactNode;
  onClose: () => void;
  /** Verberg de standaard Annuleren-knop (form regelt z'n eigen knoppen). */
  hideDefaultCancel?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const iconBg = {
    success: "bg-emerald-50 text-emerald-600",
    danger: "bg-red-50 text-red-600",
    brand: "bg-brand-50 text-brand-600",
  }[tone];
  const Icon = tone === "success" ? Trophy : tone === "danger" ? XCircle : Repeat;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="animate-overlay-in fixed inset-0 bg-ink-900/50 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-dialog-in relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-[0_24px_60px_-15px_rgb(0_0_0/0.35)]"
      >
        <div className="flex items-start gap-3.5 px-6 pb-5 pt-6">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-base font-semibold leading-snug text-ink-900">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{message}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-ink-100 bg-ink-50/60 px-6 py-4">
          {!hideDefaultCancel && (
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Annuleren
            </Button>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
