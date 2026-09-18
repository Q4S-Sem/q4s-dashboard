import { notFound } from "next/navigation";
import { EvaluatieVel } from "@/components/evaluatie/EvaluatieVel";
import { loadEvaluatieSjabloon } from "@/lib/evaluatie-render";
import { EVAL_FORMS } from "@/lib/evaluation-forms";
import { PrintBar } from "../../[id]/print/PrintBar";

/**
 * Het blanco formulier om uit te printen of mee te sturen — hetzelfde vel als
 * een ingevulde evaluatie, alleen zonder inhoud. Vervangt de losse Word- en
 * Excel-sjablonen: die liepen uit de pas met wat de app zelf produceerde.
 *
 * Bereikbaar vanaf de lijst van het formuliertype zelf; de aparte
 * Templates-beheerpagina is weg.
 */

export const metadata = { title: "Blanco evaluatieformulier" };
export const dynamic = "force-dynamic";

export default async function EvaluatieSjabloonPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const sleutel = type.toUpperCase();
  if (!EVAL_FORMS[sleutel]) notFound();

  const vel = await loadEvaluatieSjabloon(sleutel);

  return (
    <div className="ev-print-pagina ev-sjabloon-shell -mx-4 -my-6 flex flex-col overflow-hidden sm:-mx-6 lg:-mx-8 lg:-my-8">
      <PrintBar
        terug={vel.def.listPath}
        uitleg="Blanco formulier — printen, of “Opslaan als PDF” om te mailen."
        iconOnly
        panel
      />

      {/* Alleen dit deel scrollt; de balk hierboven blijft staan. */}
      <div className="ev-sjabloon-scroll flex-1 overflow-y-auto">
        <div className="flex justify-center px-4 py-8">
          <EvaluatieVel
            def={vel.def}
            accent={vel.accent}
            logoSrc={vel.logoSrc}
            bedrijfsregel={vel.bedrijfsregel}
            className="ev-schaduw"
          />
        </div>
      </div>

      <style>{`
        /* Vult exact de ruimte onder de app-header (h-14 = 3.5rem), zodat de
           pagina zelf niet scrollt en de balk dus niet meebeweegt. */
        .ev-sjabloon-shell { height: calc(100dvh - 3.5rem); }
        .ev-schaduw > .ev-vel {
          box-shadow: 0 18px 50px -24px rgb(0 0 0 / 0.45);
          border: 1px solid #e7e7e5;
        }
        @media print {
          /* Bij printen valt de vaste-hoogte/scroll weg: het hele vel moet mee. */
          .ev-sjabloon-shell { height: auto !important; overflow: visible !important; display: block !important; }
          .ev-sjabloon-scroll { overflow: visible !important; }
          body * { visibility: hidden !important; }
          .ev-print-pagina, .ev-print-pagina * { visibility: visible !important; }
          .ev-print-pagina { position: absolute; inset: 0; margin: 0; padding: 0; }
          .ev-schaduw > .ev-vel { box-shadow: none; border: 0; }
        }
      `}</style>
    </div>
  );
}
