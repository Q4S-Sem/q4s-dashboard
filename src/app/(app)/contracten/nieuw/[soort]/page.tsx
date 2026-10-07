import { notFound } from "next/navigation";
import { db } from "@/lib/db";
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
  searchParams: Promise<{ taal?: string; doc?: string }>;
}) {
  const soort = (await params).soort as Soort;
  if (!(soort in TITELS)) notFound();
  const sp = await searchParams;
  const taal = sp.taal === "en" ? "en" : sp.taal === "nl" ? "nl" : soort === "offerte" ? "en" : "nl";
  const footerLine = contractFooterLine(await getCompanySettings());
  const doc = sp.doc ? await db.docConcept.findFirst({ where: { id: sp.doc, soort } }) : null;
  let opgeslagen: { id: string; waarden: Record<string, string> } | null = null;
  if (doc) {
    try {
      opgeslagen = { id: doc.id, waarden: JSON.parse(doc.data) as Record<string, string> };
    } catch {
      opgeslagen = null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="no-print space-y-4">
        <BackLink href="/contracten/nieuw">Terug naar nieuw contract</BackLink>
        <PageHeader
          title={TITELS[soort]}
          description="Vul het formulier in en bekijk het document onder Voorbeeld. Klik Opslaan om het te bewaren (staat dan bij Nieuw contract). Download Word of print / sla op als PDF."
        />
      </div>
      <DocInvullen taalKeuze={<TaalSchakelaar taal={taal} href={(t) => `/contracten/nieuw/${soort}?taal=${t}${doc ? `&doc=${doc.id}` : ""}`} />} opgeslagen={opgeslagen} key={doc?.id ?? "nieuw"} soort={soort} taal={taal} logoSrc={contractLogoDataUri()} handtekening={q4sHandtekeningDataUri()} footerLine={footerLine} />
    </div>
  );
}
