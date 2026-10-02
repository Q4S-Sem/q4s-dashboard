"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Dropzone } from "@/components/ui/dropzone";
import { SubmitButton } from "@/components/ui/submit-button";
import { leesContractTarieven, neemContractTarievenOver, type ContractTariefVoorstel } from "../../../actions";

/**
 * Sleep een getekend contract (PDF/Word/foto) erin → de AI leest de tarieven,
 * je ziet wat er verandert en zet ze met "Overnemen" op de plaatsing.
 */
export function ContractTarievenUpload({ placementId }: { placementId: string }) {
  const [kant, setKant] = useState<"inkoop" | "verkoop">("inkoop");
  const [bezig, setBezig] = useState(false);
  const [voorstel, setVoorstel] = useState<ContractTariefVoorstel | null>(null);

  async function lees(f: File | null) {
    setVoorstel(null);
    if (!f) return;
    setBezig(true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      fd.set("kant", kant);
      setVoorstel(await leesContractTarieven(fd));
    } catch {
      setVoorstel({ ok: false, error: "Het contract kon niet uitgelezen worden. Probeer het opnieuw." });
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Sparkles className="h-4 w-4 text-brand-600" /> Tarieven uit een contract halen
        </p>
        <div className="inline-flex overflow-hidden rounded-md border border-ink-200 text-xs font-medium">
          {(["inkoop", "verkoop"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKant(k);
                setVoorstel(null);
              }}
              className={kant === k ? "bg-ink-900 px-3 py-1.5 text-white" : "px-3 py-1.5 text-ink-600 hover:bg-ink-50"}
            >
              {k === "inkoop" ? "Contract met ZZP'er (inkoop)" : "Contract met klant (verkoop)"}
            </button>
          ))}
        </div>
      </div>

      <Dropzone
        name="contractTarievenFile"
        accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf"
        label="Sleep het contract hierheen of klik om te selecteren"
        hint="PDF, Word (.docx) of een duidelijke foto — er wordt niets opgeslagen tot je op Overnemen klikt"
        onFilesChange={(files) => void lees(files[0] ?? null)}
      />

      {bezig && (
        <p className="inline-flex items-center gap-1.5 text-sm text-ink-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Tarieven uitlezen…
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
