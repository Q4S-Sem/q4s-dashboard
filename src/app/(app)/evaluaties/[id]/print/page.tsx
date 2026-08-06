import { notFound } from "next/navigation";
import { EvaluatieVel } from "@/components/evaluatie/EvaluatieVel";
import { loadEvaluatieVel } from "@/lib/evaluatie-render";
import { PrintBar } from "./PrintBar";

export const metadata = { title: "Evaluatie printen" };
export const dynamic = "force-dynamic";

export default async function EvaluatiePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vel = await loadEvaluatieVel(id);
  if (!vel) notFound();

  return (
    <div className="ev-print-pagina">
      <PrintBar terug={`/evaluaties/${id}`} />

      <div className="flex justify-center pb-10">
        <EvaluatieVel
          def={vel.def}
          accent={vel.accent}
          logoSrc={vel.logoSrc}
          bedrijfsregel={vel.bedrijfsregel}
          waarden={vel.waarden}
          className="ev-schaduw"
        />
      </div>

      <style>{`
        .ev-schaduw > .ev-vel {
          box-shadow: 0 18px 50px -24px rgb(0 0 0 / 0.45);
          border: 1px solid #e7e7e5;
        }
        @media print {
          /* Alleen het vel drukken: de app-schil (kopbalk, zijmenu) eromheen niet. */
          body * { visibility: hidden !important; }
          .ev-print-pagina, .ev-print-pagina * { visibility: visible !important; }
          .ev-print-pagina { position: absolute; inset: 0; margin: 0; padding: 0; }
          .ev-schaduw > .ev-vel { box-shadow: none; border: 0; }
        }
      `}</style>
    </div>
  );
}
