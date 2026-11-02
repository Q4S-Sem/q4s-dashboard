"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Globe, Loader2, Sparkles, XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { schrijfWebsiteTekst, verversWebsite } from "./actions";

// Voortgang van "AI schrijft de website-tekst": per rij een draaiend icoon → groen
// vinkje (of rood kruis), en bij "Alles naar gereed" een groene balk "3 / 9 klaar".
// De rij-knoppen luisteren naar één window-event, zo delen bulk en rij de status.

type Stand = "bezig" | "klaar" | "fout";
const EVENT = "website-tekst";
const meld = (id: string, stand: Stand, fout?: string) =>
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id, stand, fout } }));

async function schrijf(id: string): Promise<boolean> {
  meld(id, "bezig");
  const r = await schrijfWebsiteTekst(id);
  meld(id, r.ok ? "klaar" : "fout", r.ok ? undefined : r.fout);
  return r.ok;
}

const knop =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 transition-colors hover:bg-ink-50 disabled:cursor-default";

/** De globe-knop op één concept-rij. */
export function NaarGereedKnop({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [stand, setStand] = useState<Stand | null>(null);
  const [fout, setFout] = useState<string>();
  useEffect(() => {
    const op = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; stand: Stand; fout?: string }>).detail;
      if (d.id === dealId) {
        setStand(d.stand);
        setFout(d.fout);
      }
    };
    window.addEventListener(EVENT, op);
    return () => window.removeEventListener(EVENT, op);
  }, [dealId]);

  return (
    <button
      type="button"
      className={knop}
      disabled={stand === "bezig" || stand === "klaar"}
      title={
        stand === "bezig" ? "AI schrijft de tekst…" : stand === "klaar" ? "Klaar — staat bij Gereed" : stand === "fout" ? `Mislukt: ${fout} — klik om opnieuw te proberen` : "Website-tekst laten schrijven en naar Gereed"
      }
      aria-label={stand === "bezig" ? "Bezig" : stand === "klaar" ? "Klaar" : "Naar gereed"}
      onClick={async () => {
        if (await schrijf(dealId)) {
          await verversWebsite();
          router.refresh();
        }
      }}
    >
      {stand === "bezig" ? (
        <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
      ) : stand === "klaar" ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : stand === "fout" ? (
        <XCircle className="h-4 w-4 text-red-600" />
      ) : (
        <Globe className="h-4 w-4" />
      )}
    </button>
  );
}

/** "Alles naar gereed" met een groene voortgangsbalk. Drie tegelijk. */
export function AllesNaarGereed({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [klaar, setKlaar] = useState(0);
  const [mislukt, setMislukt] = useState(0);
  const [bezig, setBezig] = useState(false);
  const totaal = ids.length;
  const gedaan = klaar + mislukt;

  async function start() {
    setBezig(true);
    setKlaar(0);
    setMislukt(0);
    const rij = [...ids];
    // ponytail: 3 tegelijk (OpenRouter-limiet/kosten); hoger als het te traag voelt.
    await Promise.all(
      Array.from({ length: Math.min(3, rij.length) }, async () => {
        for (let id = rij.shift(); id; id = rij.shift()) {
          if (await schrijf(id)) setKlaar((n) => n + 1);
          else setMislukt((n) => n + 1);
        }
      }),
    );
    setBezig(false);
    await verversWebsite();
    router.refresh();
  }

  return (
    <div className="flex min-w-[16rem] flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={start}
        disabled={bezig}
        className={buttonVariants({ variant: "primary", size: "sm" })}
      >
        {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {bezig ? `AI schrijft… ${gedaan} / ${totaal}` : `Alles naar gereed (${totaal})`}
      </button>
      {(bezig || gedaan > 0) && (
        <div className="w-full" role="progressbar" aria-valuemin={0} aria-valuemax={totaal} aria-valuenow={gedaan}>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${totaal ? (gedaan / totaal) * 100 : 0}%` }} />
          </div>
          <p className="mt-1 text-right text-xs text-ink-500">
            <span className="font-semibold text-emerald-700">{klaar} klaar</span>
            {mislukt > 0 && <span className="text-red-600"> · {mislukt} mislukt (rood kruis = opnieuw proberen)</span>}
            {bezig && ` · nog ${totaal - gedaan}`}
          </p>
        </div>
      )}
    </div>
  );
}
