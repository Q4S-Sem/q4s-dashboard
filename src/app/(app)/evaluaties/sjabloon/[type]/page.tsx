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
    <div className="ev-print-pagina">
      <PrintBar
        terug={vel.def.listPath}
        uitleg="Blanco formulier — printen, of “Opslaan als PDF” om te mailen."
      />

      <div className="flex justify-center pb-10">
        <EvaluatieVel
          def={vel.def}
          accent={vel.accent}
          logoSrc={vel.logoSrc}
          bedrijfsregel={vel.bedrijfsregel}
          className="ev-schaduw"
        />
      </div>

      <style>{`
        .ev-schaduw > .ev-vel {
          box-shadow: 0 18px 50px -24px rgb(0 0 0 / 0.45);
          border: 1px solid #e7e7e5;
        }
        @media print {
          body * { visibility: hidden !important; }
          .ev-print-pagina, .ev-print-pagina * { visibility: visible !important; }
          .ev-print-pagina { position: absolute; inset: 0; margin: 0; padding: 0; }
          .ev-schaduw > .ev-vel { box-shadow: none; border: 0; }
        }
      `}</style>
    </div>
  );
}
