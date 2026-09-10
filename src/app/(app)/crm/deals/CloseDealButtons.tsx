"use client";

import { useState } from "react";
import { Trophy, XCircle, RotateCcw, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { closeDeal, reopenDeal, rematchDeal } from "./actions";

/**
 * De afsluit-acties van een deal, als één rustige balk. Open deal:
 *  - Geplaatst (gewonnen) — één klik.
 *  - Andere vacature — haalt de deal uit de pipeline en stuurt je terug naar de
 *    talentpool om dezelfde kandidaat op een andere vacature te zetten.
 *  - Niet doorgegaan (verloren) — klapt een reden-veldje open (voedt de inzichten).
 * Gesloten deal: Heropenen.
 */
export function CloseDealButtons({ dealId, status }: { dealId: string; status: string }) {
  const [showLost, setShowLost] = useState(false);

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
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
      {!showLost ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-500">Rond deze plaatsing af:</p>
          <div className="flex flex-wrap gap-2">
            <form action={closeDeal}>
              <input type="hidden" name="id" value={dealId} />
              <input type="hidden" name="outcome" value="WON" />
              <Button type="submit" variant="success" size="sm">
                <Trophy className="h-4 w-4" /> Geplaatst
              </Button>
            </form>
            <form action={rematchDeal}>
              <input type="hidden" name="id" value={dealId} />
              <Button type="submit" variant="outline" size="sm">
                <Repeat className="h-4 w-4" /> Andere vacature zoeken
              </Button>
            </form>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowLost(true)}>
              <XCircle className="h-4 w-4 text-red-500" /> Niet doorgegaan
            </Button>
          </div>
        </div>
      ) : (
        <form action={closeDeal} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input type="hidden" name="id" value={dealId} />
          <input type="hidden" name="outcome" value="LOST" />
          <Input
            name="lostReason"
            placeholder="Waarom ging het niet door? (bijv. prijs, geen match)…"
            className="h-10 flex-1"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowLost(false)}>
              Annuleren
            </Button>
            <Button type="submit" variant="danger" size="sm">
              Bevestig
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
