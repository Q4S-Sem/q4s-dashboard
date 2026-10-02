import Link from "next/link";
import type { Contract } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { ContractVel } from "@/components/contract/ContractVel";
import { PersoonsgegevensVel } from "@/components/contract/PersoonsgegevensVel";
import { OfferteVel } from "@/components/contract/OfferteVel";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { getCompanySettings } from "@/lib/settings";
import { buildContractDoc } from "@/lib/contract-doc";
import { contractLogoDataUri } from "@/lib/contract-render";
import { cn } from "@/lib/utils";
import { PrintBar } from "../[id]/print/PrintBar";

export const metadata = { title: "Blanco — Contracten" };
export const dynamic = "force-dynamic";

const SOORTEN: [string, string][] = [
  ["overeenkomst", "Overeenkomst van opdracht"],
  ["persoonsgegevens", "Persoonsgegevens"],
  ["offerte", "Offerte"],
];

/** Lege overeenkomst: alleen de vaste standaarden, de rest blijft een invullijn. */
const LEEG = {
  vatReverseCharge: true,
  paymentTermDays: 30,
  includeConfidentiality: true,
  includeGdpr: true,
  includeIp: true,
} as unknown as Contract;

/**
 * Blanco Q4S-documenten zoals ze op papier komen — niets invullen, alleen
 * printen of als PDF bewaren. Een echt contract invullen doe je via Contracten.
 */
export default async function BlancoPage({ searchParams }: { searchParams: Promise<{ doc?: string; taal?: string }> }) {
  const sp = await searchParams;
  const doc = SOORTEN.some(([k]) => k === sp.doc) ? sp.doc! : "overeenkomst";
  const taal = sp.taal === "en" ? "en" : "nl";
  const url = (d: string, t: string) => `/contracten/blanco?doc=${d}${t === "en" ? "&taal=en" : ""}`;
  const leeg = buildContractDoc(LEEG, await getCompanySettings());
  const logo = contractLogoDataUri();

  return (
    <div className="space-y-4">
      <div className="no-print space-y-4">
        <PageHeader title="Blanco" description="Lege Q4S-documenten om te printen of als PDF te bewaren." />
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
          <div className="ml-auto">
            <TaalSchakelaar taal={taal} href={(t) => url(doc, t)} />
          </div>
        </div>
      </div>

      <div className="ov-print-pagina">
        <PrintBar terug="/contracten" />
        <div className="flex justify-center overflow-x-auto pb-10">
          {doc === "overeenkomst" ? (
            <ContractVel doc={leeg} logoSrc={logo} taal={taal} className="ov-schaduw" />
          ) : doc === "persoonsgegevens" ? (
            <PersoonsgegevensVel logoSrc={logo} footerLine={leeg.footerLine} taal={taal} className="ov-schaduw" />
          ) : (
            <OfferteVel logoSrc={logo} footerLine={leeg.footerLine} taal={taal} className="ov-schaduw" />
          )}
        </div>
      </div>
      <style>{`.ov-schaduw > .ov-vel { box-shadow: 0 18px 50px -24px rgb(0 0 0 / 0.45); border: 1px solid #e7e7e5; }
        @media print { .ov-schaduw > .ov-vel { box-shadow: none; border: 0; } }`}</style>
    </div>
  );
}
