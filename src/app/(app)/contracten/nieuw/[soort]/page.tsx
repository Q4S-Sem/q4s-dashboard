import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { getCompanySettings } from "@/lib/settings";
import { contractFooterLine } from "@/lib/contract-doc";
import { contractLogoDataUri } from "@/lib/contract-render";
import { DocInvullen, type Soort } from "./DocInvullen";

export const dynamic = "force-dynamic";

const TITELS: Record<Soort, string> = { persoonsgegevens: "Persoonsgegevens", offerte: "Offerte" };

export default async function DocInvullenPage({
  params,
  searchParams,
}: {
  params: Promise<{ soort: string }>;
  searchParams: Promise<{ taal?: string }>;
}) {
  const { soort } = await params;
  if (soort !== "persoonsgegevens" && soort !== "offerte") notFound();
  const sp = await searchParams;
  const taal = sp.taal === "en" ? "en" : sp.taal === "nl" ? "nl" : soort === "offerte" ? "en" : "nl";
  const footerLine = contractFooterLine(await getCompanySettings());

  return (
    <div className="space-y-5">
      <div className="no-print space-y-4">
        <BackLink href="/contracten/nieuw">Terug naar nieuw contract</BackLink>
        <PageHeader
          title={TITELS[soort]}
          description="Vul links in, rechts zie je direct het document. Wat je typt blijft als concept bewaard; klaar? Print of sla op als PDF."
          actions={<TaalSchakelaar taal={taal} href={(t) => `/contracten/nieuw/${soort}?taal=${t}`} />}
        />
      </div>
      <DocInvullen soort={soort} taal={taal} logoSrc={contractLogoDataUri()} footerLine={footerLine} />
    </div>
  );
}
