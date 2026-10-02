import Link from "next/link";
import type { Contract } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { ContractVel } from "@/components/contract/ContractVel";
import { PersoonsgegevensVel } from "@/components/contract/PersoonsgegevensVel";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { getCompanySettings } from "@/lib/settings";
import { buildContractDoc } from "@/lib/contract-doc";
import { contractLogoDataUri } from "@/lib/contract-render";
import { cn } from "@/lib/utils";
import { PrintBar } from "../../contracten/[id]/print/PrintBar";

export const metadata = { title: "Contract-vormgeving" };
export const dynamic = "force-dynamic";

/** Voorbeeldinhoud, zodat je de vormgeving beoordeelt zonder een echt contract. */
const VOORBEELD = {
  number: "Q4S-OVO-2026-001",
  contractorName: "Jan Jansen, Jansen Inspections",
  contractorAddress: "Voorbeeldstraat 1, 1234 AB Rotterdam",
  contractorKvk: "12345678",
  contractorVat: "NL001234567B01",
  fieldOfWork: "Quality & Inspection Services",
  serviceNeed: "Quality Management & Inspection Services",
  thirdParty: "Smulders-HSM (HSI PEMAC)",
  workDescription: "Commissioning (in bedrijf stellen van), incl. einddocumentatie verzorgen, het ondersteunen en begeleiden van deze werkzaamheden.",
  startDate: new Date(2026, 4, 1),
  endDate: null,
  projectDuration: "Eind project (schatting: eind 2027)",
  noticePeriod: "twee (2) weken",
  rateDay: "€ 70,-",
  rateShift: "+ 40 %",
  rateSaturday: "+ 50 %",
  rateSunday: "+ 50 %",
  rateOffshore: "+ 0 %",
  rateOvertime: "9e & 10e uur + 15 %, overige uren + 25 %",
  overtimeApplies: "8 uur per dag",
  rateDayFixed: "—",
  dayBasedOnHours: "—",
  kmRate: "€ 0,45",
  vatReverseCharge: true,
  invoiceEmail: "admin@q4s.nl",
  paymentTermDays: 30,
  insuranceCover: "€ 2.500.000,-",
  includeConfidentiality: true,
  includeGdpr: true,
  includeIp: true,
  signerClient: "P. Boomsma",
  signPlaceClient: "Barendrecht",
  signerContractor: "J. Jansen",
  signPlaceContractor: "Rotterdam",
  signDate: null,
} as unknown as Contract;

/**
 * Instellingen → Contract-vormgeving: de twee Q4S-documenten (overeenkomst van
 * opdracht en persoonsgegevens) in de huisstijl, in NL of EN. Hetzelfde vel
 * als bij elk contract; vanaf hier print je ook een blanco formulier.
 */
export default async function ContractTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; taal?: string }>;
}) {
  const sp = await searchParams;
  const doc = sp.doc === "persoonsgegevens" ? "persoonsgegevens" : "overeenkomst";
  const taal = sp.taal === "en" ? "en" : "nl";
  const url = (d: string, t: string) =>
    `/gebruikers/contract-template?doc=${d}${t === "en" ? "&taal=en" : ""}`;

  const settings = await getCompanySettings();
  const voorbeeld = buildContractDoc(VOORBEELD, settings);
  const logo = contractLogoDataUri();

  return (
    <div className="space-y-4">
      <div className="no-print">
        <PageHeader
          title="Contract-vormgeving"
          description="Zo komen de overeenkomst van opdracht en het persoonsgegevens-formulier op papier. Blauw = wat per contract wordt ingevuld."
        />
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 border-b border-ink-200 pb-3">
        {[
          ["overeenkomst", "Overeenkomst van opdracht"],
          ["persoonsgegevens", "Persoonsgegevens"],
        ].map(([d, label]) => (
          <Link
            key={d}
            href={url(d, taal)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              d === doc ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:text-ink-900",
            )}
          >
            {label}
          </Link>
        ))}
        <div className="ml-auto">
          <TaalSchakelaar taal={taal} href={(t) => url(doc, t)} />
        </div>
      </div>

      <div className="ov-print-pagina">
        <PrintBar terug="/gebruikers" />
        <div className="flex justify-center overflow-x-auto pb-10">
          {doc === "overeenkomst" ? (
            <ContractVel doc={voorbeeld} logoSrc={logo} taal={taal} className="ov-schaduw" />
          ) : (
            <PersoonsgegevensVel logoSrc={logo} footerLine={voorbeeld.footerLine} taal={taal} className="ov-schaduw" />
          )}
        </div>
      </div>

      <style>{`
        .ov-schaduw > .ov-vel { box-shadow: 0 18px 50px -24px rgb(0 0 0 / 0.45); border: 1px solid #e7e7e5; }
        @media print {
          body * { visibility: hidden !important; }
          .ov-print-pagina, .ov-print-pagina * { visibility: visible !important; }
          .ov-print-pagina { position: absolute; inset: 0; margin: 0; padding: 0; }
          .ov-schaduw > .ov-vel { box-shadow: none; border: 0; }
        }
      `}</style>
    </div>
  );
}
