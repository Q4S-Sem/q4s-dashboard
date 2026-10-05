import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { ContractForm } from "../ContractForm";
import { createContract } from "../actions";
import { getContractFormOptions } from "../data";

export const metadata = { title: "Nieuw contract" };
export const dynamic = "force-dynamic";

/** Een overeenkomst van opdracht invullen en opslaan (met controle op ontbrekende gegevens). */
export default async function NieuwContractPage({
  searchParams,
}: {
  searchParams: Promise<{ consultantId?: string; placementId?: string; doc?: string; taal?: string }>;
}) {
  const { consultantId, placementId, doc, taal } = await searchParams;
  // Oude links (toen Blanco/Timesheet hier zaten) → hun eigen pagina.
  const tl = taal === "en" ? "taal=en" : "";
  if (doc === "urenstaat") redirect(`/contracten/blanco?doc=timesheet${tl ? `&${tl}` : ""}`);
  if (doc === "persoonsgegevens" || doc === "offerte") redirect(`/contracten/blanco?doc=${doc}${tl ? `&${tl}` : ""}`);

  const { consultants, placements } = await getContractFormOptions();

  // Voor-invullen bij aanmaken vanuit een plaatsing: opdrachtnemer + plaatsing
  // staan dan al goed, en de opdrachtnemer-gegevens worden overgenomen.
  const chosen = consultants.find((c) => c.id === consultantId);
  const defaults =
    consultantId || placementId
      ? {
          consultantId: consultantId ?? "",
          placementId: placementId ?? null,
          contractorName: chosen?.company || chosen?.name || "",
          contractorAddress: chosen?.address ?? "",
          contractorKvk: chosen?.kvk ?? "",
          contractorVat: chosen?.vat ?? "",
          contractorIban: chosen?.iban ?? "",
        }
      : undefined;

  return (
    <div className="space-y-5">
      <BackLink href="/contracten">Terug naar contracten</BackLink>
      <PageHeader
        title="Nieuw contract"
        description="Vul de overeenkomst van opdracht in, sla op en print hem. Ontbreekt er iets, dan krijg je een melding."
      />
      <ContractForm
        action={createContract}
        defaults={defaults}
        consultants={consultants}
        placements={placements}
        cancelHref="/contracten"
      />
    </div>
  );
}
