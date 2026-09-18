import { notFound } from "next/navigation";
import { ContractVel } from "@/components/contract/ContractVel";
import { loadContractSheet } from "@/lib/contract-render";
import { PrintBar } from "./PrintBar";

export const metadata = { title: "Contract printen" };
export const dynamic = "force-dynamic";

export default async function ContractPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sheet = await loadContractSheet(id);
  if (!sheet) notFound();

  return (
    <div className="ov-print-pagina">
      <PrintBar terug={`/contracten/${id}`} />

      <div className="flex justify-center pb-10">
        <ContractVel doc={sheet.doc} logoSrc={sheet.logoSrc} className="ov-schaduw" />
      </div>

      <style>{`
        .ov-schaduw > .ov-vel {
          box-shadow: 0 18px 50px -24px rgb(0 0 0 / 0.45);
          border: 1px solid #e7e7e5;
        }
        @media print {
          body * { visibility: hidden !important; }
          .ov-print-pagina, .ov-print-pagina * { visibility: visible !important; }
          .ov-print-pagina { position: absolute; inset: 0; margin: 0; padding: 0; }
          .ov-schaduw > .ov-vel { box-shadow: none; border: 0; }
        }
      `}</style>
    </div>
  );
}
