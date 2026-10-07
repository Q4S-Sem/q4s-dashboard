import { ICOON_GROEP } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { WordKnop } from "@/components/contract/WordKnop";
import { getCompanySettings } from "@/lib/settings";
import { contractLogoDataUri, q4sHandtekeningDataUri } from "@/lib/contract-render";
import { ContractForm } from "../../ContractForm";
import { PrintKnop } from "../../[id]/print/PrintBar";
import { createContract } from "../../actions";

export const metadata = { title: "Nieuw contract" };
export const dynamic = "force-dynamic";

/** Een overeenkomst van opdracht invullen (met live voorbeeld) en opslaan. */
export default async function NieuwContractPage({ searchParams }: { searchParams: Promise<{ taal?: string }> }) {
  const taal = (await searchParams).taal === "en" ? "en" : "nl";
  return (
    <div className="space-y-6">
      <BackLink href="/contracten/nieuw">Terug naar nieuw contract</BackLink>
      <PageHeader
        title="Overeenkomst van opdracht"
        description="Vul het formulier in en bekijk het resultaat onder Voorbeeld. Opslaan als concept, of Klaar als alles is ingevuld — ontbreekt er iets, dan krijg je een melding."
      />
      <ContractForm
        action={createContract}
        cancelHref="/contracten/nieuw"
        taalKeuze={<TaalSchakelaar taal={taal} href={(t) => `/contracten/nieuw/overeenkomst${t === "en" ? "?taal=en" : ""}`} />}
        voorbeeld={{
          settings: await getCompanySettings(),
          logoSrc: contractLogoDataUri(),
          handtekening: q4sHandtekeningDataUri(),
          taal,
          acties: (
            <>
              <div className={ICOON_GROEP}>
                <WordKnop icoon bestandsnaam="Overeenkomst van opdracht" />
                <PrintKnop icoon />
              </div>
            </>
          ),
        }}
      />
    </div>
  );
}
