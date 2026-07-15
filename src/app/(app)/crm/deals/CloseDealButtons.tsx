"use client";

import { useState } from "react";
import { Trophy, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { closeDeal, reopenDeal } from "./actions";

/** Won = één klik. Verloren = klap een reden-veldje open (voedt de inzichten). */
export function CloseDealButtons({ dealId, status }: { dealId: string; status: string }) {
  const [showLost, setShowLost] = useState(false);

  if (status !== "OPEN") {
    return (
      <form action={reopenDeal}>
        <input type="hidden" name="id" value={dealId} />
        <Button type="submit" variant="outline">
          <RotateCcw className="h-4 w-4" /> Heropenen
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={closeDeal}>
        <input type="hidden" name="id" value={dealId} />
        <input type="hidden" name="outcome" value="WON" />
        <Button type="submit" variant="success">
          <Trophy className="h-4 w-4" /> Gewonnen
        </Button>
      </form>

      {!showLost ? (
        <Button type="button" variant="danger" onClick={() => setShowLost(true)}>
          <XCircle className="h-4 w-4" /> Verloren
        </Button>
      ) : (
        <form action={closeDeal} className="flex items-center gap-2">
          <input type="hidden" name="id" value={dealId} />
          <input type="hidden" name="outcome" value="LOST" />
          <Input
            name="lostReason"
            placeholder="Reden (bijv. prijs, geen match)…"
            className="h-10 w-56"
            autoFocus
          />
          <Button type="submit" variant="danger">
            Bevestig verlies
          </Button>
        </form>
      )}
    </div>
  );
}
