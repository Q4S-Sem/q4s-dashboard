import Link from "next/link";
import type { Contract } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { ContractVel } from "@/components/contract/ContractVel";
import { PersoonsgegevensVel } from "@/components/contract/PersoonsgegevensVel";
import { OfferteVel } from "@/components/contract/OfferteVel";
import { UrenstaatVel } from "@/components/contract/UrenstaatVel";
import { Download, FileText } from "lucide-react";
import { buttonVariants, SEGMENT_GROEP, segmentVariants } from "@/components/ui/button";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { getCompanySettings } from "@/lib/settings";
import { buildContractDoc } from "@/lib/contract-doc";
import { contractLogoDataUri, q4sHandtekeningDataUri } from "@/lib/contract-render";
import { PrintBar } from "../[id]/print/PrintBar";
import { WordKnop } from "@/components/contract/WordKnop";

export const metadata = { title: "Blanco — Contracten" };
export const dynamic = "force-dynamic";

const SOORTEN: [string, string][] = [
  ["overeenkomst", "Overeenkomst van opdracht"],
  ["persoonsgegevens", "Persoonsgegevens"],
  ["offerte", "Offerte"],
  ["timesheet", "Timesheet"],
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
      <div className="no-print space-y-4">
        <PageHeader title="Blanco" description="Lege Q4S-documenten (overeenkomst, persoonsgegevens, offerte, timesheet) om te printen of als PDF te bewaren." />
        <div className="flex flex-wrap items-center gap-2">
          <div className={SEGMENT_GROEP}>
          {SOORTEN.map(([k, label]) => (
            <Link
              key={k}
              href={url(k, taal)}
              className={segmentVariants(k === doc)}
            >
              {label}
            </Link>
          ))}
          </div>
          <div className="ml-auto">
            <TaalSchakelaar taal={taal} href={(t) => url(doc, t)} />
          </div>
        </div>
        {doc !== "timesheet" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3">
            <FileText className="h-5 w-5 text-brand-600" />
            <p className="mr-auto text-sm text-ink-600">
              Ook als Word-bestand ({taal.toUpperCase()}) — om buiten het dashboard te bewerken of door te sturen.
            </p>
            <WordKnop bestandsnaam={`Q4S ${SOORTEN.find(([k]) => k === doc)?.[1] ?? doc} (${taal.toUpperCase()})`} />
          </div>
        )}
        {doc === "timesheet" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3">
            <p className="mr-auto text-sm text-ink-600">
              Ook als Excel voor ZZP&apos;ers — alleen het weeknummer invullen, de datums rekenen vanzelf.
            </p>
            {(["NL", "EN"] as const).map((l) => (
              <a key={l} href={`/templates/urenstaat/Q4S-Timesheet-${l}.xlsx`} download className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Download className="h-4 w-4" /> Excel {l}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="ov-print-pagina">
        <PrintBar terug="/contracten" />
        <div className="flex justify-center overflow-x-auto pb-10" data-word-bron>
          {doc === "overeenkomst" ? (
            <ContractVel doc={leeg} logoSrc={logo} handtekening={handtekening} taal={taal} className="ov-schaduw" />
          ) : doc === "persoonsgegevens" ? (
            <PersoonsgegevensVel logoSrc={logo} footerLine={leeg.footerLine} taal={taal} className="ov-schaduw" />
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
