import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { ContractForm } from "../../ContractForm";
import { createContract } from "../../actions";

export const metadata = { title: "Nieuw contract" };

/** Een overeenkomst van opdracht invullen en opslaan (met controle op ontbrekende gegevens). */
export default function NieuwContractPage() {
  return (
    <div className="space-y-5">
      <BackLink href="/contracten/nieuw">Terug naar nieuw contract</BackLink>
      <PageHeader
        title="Overeenkomst van opdracht"
        description="Vul de overeenkomst van opdracht in, sla op en print hem. Ontbreekt er iets, dan krijg je een melding."
      />
      <ContractForm action={createContract} cancelHref="/contracten" />
    </div>
  );
}
