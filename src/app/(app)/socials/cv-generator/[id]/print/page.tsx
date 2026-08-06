import { notFound } from "next/navigation";
import { CvSheet } from "@/components/cv/CvSheet";
import { loadCvSheet } from "@/lib/cv-render";
import { PrintBar } from "./PrintBar";

export const metadata = { title: "Q4S-CV printen" };
export const dynamic = "force-dynamic";

export default async function CvPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vel = await loadCvSheet(id);
  if (!vel) notFound();

  return (
    <div className="cv-print-pagina">
      <PrintBar terug={`/socials/cv-generator/${id}`} />

      {/* Het vel staat gecentreerd op het scherm met een lichte schaduw; bij
          printen valt die omlijsting weg en blijft precies de A4 over. */}
      <div className="flex justify-center pb-10">
        <CvSheet
          doc={vel.doc}
          template={vel.template}
          logoSrc={vel.logoSrc}
          photoSrc={vel.photoSrc}
          className="cv-schaduw"
        />
      </div>

      <style>{`
        .cv-schaduw > .cv-vel {
          box-shadow: 0 18px 50px -24px rgb(0 0 0 / 0.45);
          border: 1px solid #e7e7e5;
        }
        @media print {
          /* Alleen het vel drukken: de app-schil (kopbalk, zijmenu) eromheen niet. */
          body * { visibility: hidden !important; }
          .cv-print-pagina, .cv-print-pagina * { visibility: visible !important; }
          .cv-print-pagina {
            position: absolute;
            inset: 0;
            margin: 0;
            padding: 0;
          }
          .cv-schaduw > .cv-vel { box-shadow: none; border: 0; }
        }
      `}</style>
    </div>
  );
}
