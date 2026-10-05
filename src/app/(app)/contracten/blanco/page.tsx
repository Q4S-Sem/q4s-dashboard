import Link from "next/link";
import type { Contract } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { ContractVel } from "@/components/contract/ContractVel";
import { PersoonsgegevensVel } from "@/components/contract/PersoonsgegevensVel";
import { OfferteVel } from "@/components/contract/OfferteVel";
import { ArbeidsovereenkomstVel } from "@/components/contract/ArbeidsovereenkomstVel";
import { UrenstaatVel } from "@/components/contract/UrenstaatVel";
import { BriefcaseBusiness, Clock, Download, FileSignature, Receipt, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants, mapTabVariants } from "@/components/ui/button";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { getCompanySettings } from "@/lib/settings";
import { buildContractDoc } from "@/lib/contract-doc";
import { contractLogoDataUri, q4sHandtekeningDataUri } from "@/lib/contract-render";
import { PrintKnop } from "../[id]/print/PrintBar";
import { WordKnop } from "@/components/contract/WordKnop";

export const metadata = { title: "Blanco — Contracten" };
export const dynamic = "force-dynamic";

const SOORTEN: [string, string, LucideIcon][] = [
  ["overeenkomst", "Overeenkomst van opdracht", FileSignature],
  ["persoonsgegevens", "Persoonsgegevens", UserRound],
  ["offerte", "Offerte", Receipt],
  ["arbeidsovereenkomst", "Arbeidsovereenkomst", BriefcaseBusiness],
  ["timesheet", "Timesheet", Clock],
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
  const handtekening = q4sHandtekeningDataUri();

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader title="Blanco" description="Lege Q4S-documenten om te printen, als PDF te bewaren of als Word te bewerken." />
      </div>

      {/* Mapjes zoals bij een plaatsing; taal en downloads rechts op dezelfde lijn. */}
      <div className="no-print flex flex-wrap items-end gap-3 border-b border-ink-200">
        <nav aria-label="Document" className="flex flex-wrap items-end gap-1">
          {SOORTEN.map(([k, label, Icon]) => (
            <Link key={k} href={url(k, taal)} aria-current={k === doc ? "page" : undefined} className={mapTabVariants(k === doc)}>
              <Icon className={cn("h-4 w-4", k === doc ? "text-brand-600" : "text-ink-400")} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mb-2 ml-auto flex flex-wrap items-center gap-2">
          <TaalSchakelaar taal={taal} href={(t) => url(doc, t)} />
          {doc === "timesheet" ? (
            <a href={`/templates/urenstaat/Q4S-Timesheet-${taal.toUpperCase()}.xlsx`} download className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download className="h-4 w-4" /> Excel
            </a>
          ) : (
            <WordKnop bestandsnaam={`Q4S ${SOORTEN.find(([k]) => k === doc)?.[1] ?? doc} (${taal.toUpperCase()})`} />
          )}
          <PrintKnop />
        </div>
      </div>

      <div className="ov-print-pagina rounded-lg border border-ink-200 bg-ink-100/60 py-8 print:border-0 print:bg-transparent print:py-0">
        <div className="flex justify-center overflow-x-auto" data-word-bron>
          {doc === "overeenkomst" ? (
            <ContractVel doc={leeg} logoSrc={logo} handtekening={handtekening} taal={taal} className="ov-schaduw" />
          ) : doc === "persoonsgegevens" ? (
            <PersoonsgegevensVel logoSrc={logo} footerLine={leeg.footerLine} taal={taal} className="ov-schaduw" />
          ) : doc === "arbeidsovereenkomst" ? (
            <ArbeidsovereenkomstVel logoSrc={logo} footerLine={leeg.footerLine} handtekening={handtekening} taal={taal} className="ov-schaduw" />
          ) : doc === "timesheet" ? (
            <UrenstaatVel logoSrc={logo} taal={taal} className="ov-schaduw" />
          ) : (
            <OfferteVel logoSrc={logo} footerLine={leeg.footerLine} handtekening={handtekening} taal={taal} className="ov-schaduw" />
          )}
        </div>
      </div>
      <style>{`.ov-schaduw > .ov-vel { box-shadow: 0 18px 50px -24px rgb(0 0 0 / 0.45); border: 1px solid #e7e7e5; }
        @media print { .ov-schaduw > .ov-vel { box-shadow: none; border: 0; } }`}</style>
    </div>
  );
}
