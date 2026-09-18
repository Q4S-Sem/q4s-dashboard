import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { ContractForm } from "../ContractForm";
import { createContract } from "../actions";
import { getContractFormOptions } from "../data";

export const metadata = { title: "Nieuw contract" };
export const dynamic = "force-dynamic";

export default async function NieuwContractPage({
  searchParams,
}: {
  searchParams: Promise<{ consultantId?: string; placementId?: string }>;
}) {
  const { consultantId, placementId } = await searchParams;
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
        }
      : undefined;

  return (
    <div className="space-y-6">
      <BackLink href="/contracten">Terug naar contracten</BackLink>
      <PageHeader
        title="Nieuwe overeenkomst van opdracht"
        description="Vul de gegevens in. De vaste juridische tekst (de door de Belastingdienst goedgekeurde modelovereenkomst) staat al klaar — je vult alleen de variabele velden in."
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
