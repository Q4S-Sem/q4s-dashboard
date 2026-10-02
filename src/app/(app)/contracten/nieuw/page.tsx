import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { getCompanySettings } from "@/lib/settings";
import { contractFooterLine } from "@/lib/contract-doc";
import { contractLogoDataUri } from "@/lib/contract-render";
import { cn } from "@/lib/utils";
import { ContractForm } from "../ContractForm";
import { createContract } from "../actions";
import { getContractFormOptions } from "../data";
import { DocumentInvullen, type InvulDoc } from "./DocumentInvullen";

export const metadata = { title: "Nieuw contract" };
export const dynamic = "force-dynamic";

const SOORTEN: [string, string][] = [
  ["overeenkomst", "Overeenkomst van opdracht"],
  ["persoonsgegevens", "Persoonsgegevens"],
  ["urenstaat", "Q4S-Timesheet"],
  ["offerte", "Offerte"],
];

/**
 * Eén plek om elk Q4S-document te maken: kies bovenaan welk document, vul het
 * in en print/bewaar het. De overeenkomst wordt opgeslagen (met controle op
 * ontbrekende gegevens); de andere drie vul je in en bewaar je als PDF.
 */
export default async function NieuwContractPage({
  searchParams,
}: {
  searchParams: Promise<{ consultantId?: string; placementId?: string; doc?: string; taal?: string }>;
}) {
  const { consultantId, placementId, doc: d, taal: t } = await searchParams;
  const doc = SOORTEN.some(([k]) => k === d) ? d! : "overeenkomst";
  const taal = t === "en" ? "en" : "nl";
  const url = (x: string, tl: string) => `/contracten/nieuw?doc=${x}${tl === "en" ? "&taal=en" : ""}`;

  return (
    <div className="space-y-5">
      <div className="no-print space-y-4">
        <BackLink href="/contracten">Terug naar contracten</BackLink>
        <PageHeader
          title="Nieuw document"
          description="Kies welk document je maakt, vul het in en print of bewaar het als PDF."
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 pb-3">
          {SOORTEN.map(([k, label]) => (
            <Link
              key={k}
              href={url(k, taal)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                k === doc ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              {label}
            </Link>
          ))}
          {doc !== "overeenkomst" && (
            <div className="ml-auto">
              <TaalSchakelaar taal={taal} href={(tl) => url(doc, tl)} />
            </div>
          )}
        </div>
      </div>

      {doc === "overeenkomst" ? (
        await Overeenkomst({ consultantId, placementId })
      ) : (
        <DocumentInvullen
          key={doc}
          doc={doc as InvulDoc}
          taal={taal}
          logoSrc={contractLogoDataUri()}
          footerLine={contractFooterLine(await getCompanySettings())}
        />
      )}
    </div>
  );
}

async function Overeenkomst({ consultantId, placementId }: { consultantId?: string; placementId?: string }) {
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
    <ContractForm
      action={createContract}
      defaults={defaults}
      consultants={consultants}
      placements={placements}
      cancelHref="/contracten"
    />
  );
}
