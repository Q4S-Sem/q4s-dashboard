"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { leesContractTarieven, neemContractTarievenOver, type ContractTariefVoorstel } from "../../../actions";

/**
 * Is het geüploade document een contract, dan leest de AI (sterk model) meteen
 * de tarieven + looptijd. Je ziet wat er verandert en zet ze met "Overnemen" op
 * de plaatsing — er wordt niets opgeslagen zonder die klik.
 */
export function ContractTarieven({ placementId, file }: { placementId: string; file: File }) {
  const [kant, setKant] = useState<"inkoop" | "verkoop">("inkoop");
  // Resultaat hoort bij één kant; wissel je van kant, dan is het oude resultaat niet meer geldig.
  const [res, setRes] = useState<{ kant: string; v: ContractTariefVoorstel } | null>(null);
  const voorstel = res?.kant === kant ? res.v : null;

  useEffect(() => {
    let weg = false;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kant", kant);
    leesContractTarieven(fd)
      .catch(() => ({ ok: false as const, error: "Het contract kon niet uitgelezen worden. Probeer het opnieuw." }))
      .then((v) => !weg && setRes({ kant, v }));
    return () => {
      weg = true;
    };
  }, [file, kant]);

  return (
    <div className="space-y-3 rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Sparkles className="h-4 w-4 text-brand-600" /> Tarieven uit dit contract
        </p>
        <div className="inline-flex overflow-hidden rounded-md border border-ink-200 text-xs font-medium">
          {(["inkoop", "verkoop"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKant(k)}
              className={kant === k ? "bg-ink-900 px-3 py-1.5 text-white" : "px-3 py-1.5 text-ink-600 hover:bg-ink-50"}
            >
              {k === "inkoop" ? "Contract met ZZP'er (inkoop)" : "Contract met klant (verkoop)"}
            </button>
          ))}
        </div>
      </div>

      {!voorstel && (
        <p className="inline-flex items-center gap-1.5 text-sm text-ink-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Contract grondig uitlezen…
        </p>
      )}
      {voorstel && !voorstel.ok && (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {voorstel.error}
        </p>
      )}
      {voorstel?.ok && (
        <form action={neemContractTarievenOver} className="space-y-3 rounded-md bg-emerald-50/60 p-3">
          <input type="hidden" name="placementId" value={placementId} />
          <input type="hidden" name="kant" value={kant} />
          <input type="hidden" name="tarieven" value={JSON.stringify(voorstel.tarieven)} />
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Gevonden{voorstel.naam ? ` in het contract van ${voorstel.naam}` : ""}:
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-800">
            {voorstel.regels.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <SubmitButton size="sm">Overnemen in de plaatsing</SubmitButton>
        </form>
      )}
    </div>
  );
}
