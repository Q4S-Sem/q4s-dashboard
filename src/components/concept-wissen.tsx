"use client";

import { usePathname } from "next/navigation";
import { Eraser } from "lucide-react";
import { ConfirmSubmit } from "./confirm-submit";

// "Wis alles" bovenaan een nieuw-formulier: haalt het bewaarde concept weg
// (FormAutosave in localStorage, en/of een serverconcept via `wisServer`) en
// begint met een leeg formulier. Altijd eerst een waarschuwing.
export function ConceptWissen({
  wat,
  wisServer,
  leegUrl,
}: {
  /** "deze klant" / "deze medewerker" — komt in de waarschuwing. */
  wat: string;
  /** Optioneel: serverconcept verwijderen (bv. plaatsing-concept). */
  wisServer?: () => Promise<void>;
  /** Waarheen na het wissen (default: dezelfde pagina, leeg). */
  leegUrl?: string;
}) {
  const pad = usePathname();
  return (
    <ConfirmSubmit
      action={async () => {
        try {
          const prefix = `q4s-draft:${pad}::`;
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k?.startsWith(prefix)) localStorage.removeItem(k);
          }
        } catch {
          // geen opslag beschikbaar → niets te wissen
        }
        if (wisServer) await wisServer();
        // Harde navigatie: React-state van het formulier moet ook leeg.
        window.location.href = leegUrl ?? pad;
      }}
      message={`Alles van ${wat} wissen?`}
      description={`Alle ingevulde gegevens van ${wat} worden gewist en je begint met een leeg formulier. Dit kun je niet terugdraaien.`}
      confirmLabel="Alles wissen"
      icon={<Eraser className="h-4 w-4" />}
    >
      Formulier wissen
    </ConfirmSubmit>
  );
}
