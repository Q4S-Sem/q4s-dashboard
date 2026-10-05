import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { getCompanySettings } from "@/lib/settings";
import { contractFooterLine } from "@/lib/contract-doc";
import { contractLogoDataUri, q4sHandtekeningDataUri } from "@/lib/contract-render";
import { DocInvullen, type Soort } from "./DocInvullen";

export const dynamic = "force-dynamic";

const TITELS: Record<Soort, string> = {
  persoonsgegevens: "Persoonsgegevens",
  offerte: "Offerte",
  arbeidsovereenkomst: "Arbeidsovereenkomst",
};

export default async function DocInvullenPage({
  params,
  searchParams,
}: {
  params: Promise<{ soort: string }>;
  searchParams: Promise<{ taal?: string }>;
}) {
  const soort = (await params).soort as Soort;
  if (!(soort in TITELS)) notFound();
  const sp = await searchParams;
  const taal = sp.taal === "en" ? "en" : sp.taal === "nl" ? "nl" : soort === "offerte" ? "en" : "nl";
  const footerLine = contractFooterLine(await getCompanySettings());

  return (
    <div className="space-y-6">
      <div className="no-print space-y-4">
        <BackLink href="/contracten/nieuw">Terug naar nieuw contract</BackLink>
        <PageHeader
          title={TITELS[soort]}
          description="Vul het formulier in en bekijk het document onder Voorbeeld. Wat je typt blijft als concept bewaard; klaar? Download Word of print / sla op als PDF."
        />
      </div>
      <DocInvullen taalKeuze={<TaalSchakelaar taal={taal} href={(t) => `/contracten/nieuw/${soort}?taal=${t}`} />} soort={soort} taal={taal} logoSrc={contractLogoDataUri()} handtekening={q4sHandtekeningDataUri()} footerLine={footerLine} />
    </div>
  );
}
