"use client";

import { useState } from "react";
import { Trophy, XCircle, RotateCcw, Repeat, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { closeDeal, reopenDeal, rematchDeal } from "./actions";

type Pending = null | "won" | "rematch" | "lost";

/**
 * De afsluit-acties van een deal, als één rustige balk. Elke actie vraagt eerst
 * om een bevestiging (waarschuwing) voordat hij wordt uitgevoerd:
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

  // --- Bevestigingsweergaven (waarschuwing per actie) -----------------------
  if (pending === "won") {
    return (
      <ConfirmShell
        tone="success"
        title="Deal markeren als geplaatst?"
        message="De kandidaat is geplaatst en de deal wordt gesloten als gewonnen. Je kunt de deal later heropenen als het toch nodig is."
      >
        <form action={closeDeal}>
          <input type="hidden" name="id" value={dealId} />
          <input type="hidden" name="outcome" value="WON" />
          <Button type="submit" variant="success" size="sm">
            <Trophy className="h-4 w-4" /> Ja, geplaatst
          </Button>
        </form>
        <CancelButton onClick={() => setPending(null)} />
      </ConfirmShell>
    );
  }

  if (pending === "rematch") {
    return (
      <ConfirmShell
        tone="brand"
        title="Andere vacature zoeken?"
        message="De deal wordt uit deze pipeline gehaald en je gaat terug naar de talentpool om dezelfde kandidaat op een andere vacature te zetten. De huidige deal wordt gesloten."
      >
        <form action={rematchDeal}>
          <input type="hidden" name="id" value={dealId} />
          <Button type="submit" variant="primary" size="sm">
            <Repeat className="h-4 w-4" /> Ja, andere vacature zoeken
          </Button>
        </form>
        <CancelButton onClick={() => setPending(null)} />
      </ConfirmShell>
    );
  }

  if (pending === "lost") {
    return (
      <ConfirmShell
        tone="danger"
        title="Deal sluiten als niet doorgegaan?"
        message="De deal wordt gesloten als verloren. Geef kort een reden op — die telt mee in de inzichten."
      >
        <form action={closeDeal} className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <input type="hidden" name="id" value={dealId} />
          <input type="hidden" name="outcome" value="LOST" />
          <Input
            name="lostReason"
            placeholder="Waarom ging het niet door? (bijv. prijs, geen match)…"
            className="h-10 flex-1"
            autoFocus
          />
          <div className="flex gap-2">
            <CancelButton onClick={() => setPending(null)} />
            <Button type="submit" variant="danger" size="sm">
              Ja, niet doorgegaan
            </Button>
          </div>
        </form>
      </ConfirmShell>
    );
  }

  // --- Standaardweergave: de drie knoppen -----------------------------------
  return (
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
  );
}

/** Kaart met een waarschuwingskop en de bevestig-/annuleerknoppen eronder. */
function ConfirmShell({
  tone,
  title,
  message,
  children,
}: {
  tone: "success" | "danger" | "brand";
  title: string;
  message: string;
  children: React.ReactNode;
}) {
  const toneRing = {
    success: "border-emerald-200 bg-emerald-50/50",
    danger: "border-red-200 bg-red-50/50",
    brand: "border-brand-200 bg-brand-50/50",
  }[tone];
  const iconColor = {
    success: "text-emerald-600",
    danger: "text-red-600",
    brand: "text-brand-600",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneRing}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">{title}</p>
          <p className="mt-0.5 text-sm text-ink-600">{message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      Annuleren
    </Button>
  );
}
