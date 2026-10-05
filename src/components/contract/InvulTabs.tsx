"use client";

import { useState } from "react";
import { Eye, PencilLine } from "lucide-react";
import { FolderTab } from "@/components/dossier-tabs";
import { cn } from "@/lib/utils";

/**
 * Invulformulier | Voorbeeld als mapjes (zoals het plaatsingdossier), met taal en
 * downloads rechts op dezelfde lijn. Beide panelen blijven gemount: het formulier
 * houdt zijn waarden en het voorbeeld (de Word/PDF-bron) is altijd bijgewerkt.
 */
export function InvulTabs({
  formulier,
  voorbeeld,
  acties,
}: {
  formulier: React.ReactNode;
  voorbeeld: React.ReactNode;
  acties?: React.ReactNode;
}) {
  const [tab, setTab] = useState<"formulier" | "voorbeeld">("formulier");
  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end gap-3 border-b border-ink-200">
        <nav aria-label="Weergave" className="flex flex-wrap items-end gap-1">
          <FolderTab icon={<PencilLine className="h-4 w-4" />} label="Invulformulier" active={tab === "formulier"} onClick={() => setTab("formulier")} />
          <FolderTab icon={<Eye className="h-4 w-4" />} label="Voorbeeld" active={tab === "voorbeeld"} onClick={() => setTab("voorbeeld")} />
        </nav>
        {acties && <div className="mb-2 ml-auto flex flex-wrap items-center gap-2">{acties}</div>}
      </div>

      <div className={cn("no-print", tab !== "formulier" && "hidden")}>{formulier}</div>

      {/* Bij printen toont globals.css alleen .ov-print-pagina, ook als dit mapje verborgen is. */}
      <div
        className={cn(
          "ov-print-pagina rounded-lg border border-ink-200 bg-ink-100/60 py-8 print:border-0 print:bg-transparent print:py-0",
          tab !== "voorbeeld" && "hidden",
        )}
      >
        <div className="flex justify-center overflow-x-auto" data-word-bron>
          {voorbeeld}
        </div>
      </div>
      <style>{`.ov-schaduw > .ov-vel { box-shadow: 0 18px 50px -24px rgb(0 0 0 / 0.45); border: 1px solid #e7e7e5; }
        @media print { .ov-schaduw > .ov-vel { box-shadow: none; border: 0; } }`}</style>
    </div>
  );
}
