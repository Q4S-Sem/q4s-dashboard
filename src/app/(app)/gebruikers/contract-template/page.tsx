import Link from "next/link";
import type { Contract } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { ContractVel } from "@/components/contract/ContractVel";
import { PersoonsgegevensVel } from "@/components/contract/PersoonsgegevensVel";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { UrenstaatVel } from "@/components/contract/UrenstaatVel";
import { OfferteVel, type Offerte } from "@/components/contract/OfferteVel";
import { getCompanySettings } from "@/lib/settings";
import { buildContractDoc } from "@/lib/contract-doc";
import { contractLogoDataUri } from "@/lib/contract-render";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, PencilLine } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PrintBar } from "../../contracten/[id]/print/PrintBar";

export const metadata = { title: "Vormgeving & blanco — Contracten" };
export const dynamic = "force-dynamic";

/** Voorbeeldinhoud, zodat je de vormgeving beoordeelt zonder een echt contract. */
const VOORBEELD = {
  number: "Q4S-OVO-2026-001",
  contractorName: "Jan Jansen, Jansen Inspections",
  contractorAddress: "Voorbeeldstraat 1, 1234 AB Rotterdam",
  contractorKvk: "12345678",
  contractorVat: "NL001234567B01",
  contractorIban: "NL00 BANK 0123 4567 89",
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

/** Voorbeeldofferte (zoals Q4S-Q-HOL-006). */
const OFFERTE: Offerte = {
  ref: "Q4S-Q-HOL-006",
  revision: "00",
  issueDate: "28-06-2021",
  to: "Hollandia Infra",
  address: "Schaardijk 23",
  postalCode: "2921LG",
  place: "Krimpen a/d IJssel",
  country: "The Netherlands",
  attn: "M. Dijkstra",
  attnEmail: "M.Dijkstra@hollandia.biz",
  cc: "J.Schipperen@hollandiastructures.nl",
  tel: "+31 6 53389355",
  subject: "Provision of QA/QC services",
  project: "TBA",
  yourRef: "TBA",
  from: "Simon van Houten",
  fromPhone: "+31 6 85 782 6818",
  fromMobile: "+31 6 81599581",
  salutation: "Dear Mr. Dijkstra,",
  inspector: "Mr. R. Krowinkel",
  location: "Krimpen a/d IJssel",
  hourlyRate: "€ 72,50",
  surcharges: "Shift hours +10%, overtime +10%, Saturday and Sunday +15%",
  travel: "€ 0,40 per kilometre from Krimpen a/d IJssel",
  availability: "Week 28",
  duration: "Week 28 until 34, with possible extension",
};

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
  const doc = ["persoonsgegevens", "urenstaat", "offerte"].includes(sp.doc ?? "") ? sp.doc! : "overeenkomst";
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
          title="Vormgeving & blanco formulieren"
          description="Zo komen de overeenkomst van opdracht, het persoonsgegevens-formulier en de Q4S-Timesheet en de offerte op papier. Blauw = wat per contract wordt ingevuld."
        />
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 border-b border-ink-200 pb-3">
        {[
          ["overeenkomst", "Overeenkomst van opdracht"],
          ["persoonsgegevens", "Persoonsgegevens"],
          ["urenstaat", "Q4S-Timesheet"],
          ["offerte", "Offerte"],
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

      {doc === "urenstaat" && (
        <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          <p className="mr-auto text-sm text-ink-600">
            Q4S-Timesheet in Excel (A4 liggend) om naar ZZP&apos;ers te sturen — hieronder precies zoals hij eruitziet — alleen het weeknummer invullen; Van, Tot en alle datums (ook bij de omschrijving) rekenen vanzelf.
          </p>
          {(["NL", "EN"] as const).map((l) => (
            <a
              key={l}
              href={`/templates/urenstaat/Q4S-Timesheet-${l}.xlsx`}
              download
              className={buttonVariants({ variant: l.toLowerCase() === taal ? "secondary" : "outline", size: "sm" })}
            >
              <Download className="h-4 w-4" /> Excel {l}
            </a>
          ))}
        </div>
      )}

      {doc === "overeenkomst" && (
        <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3">
          <PencilLine className="h-5 w-5 text-brand-600" />
          <p className="mr-auto text-sm text-ink-600">
            Dit is het blanco voorbeeld. Wil je een echte overeenkomst invullen, opslaan en printen? Ook voor een nieuw persoon die nog niet in het dashboard staat.
          </p>
          <Link href="/contracten/nieuw" className={buttonVariants({ size: "sm" })}>
            <PencilLine className="h-4 w-4" /> Contract invullen
          </Link>
        </div>
      )}

      <div className="ov-print-pagina">
        <PrintBar terug="/contracten" />
        <div className="flex justify-center overflow-x-auto pb-10">
          {doc === "overeenkomst" ? (
            <ContractVel doc={voorbeeld} logoSrc={logo} taal={taal} className="ov-schaduw" />
          ) : doc === "persoonsgegevens" ? (
            <PersoonsgegevensVel logoSrc={logo} footerLine={voorbeeld.footerLine} taal={taal} className="ov-schaduw" />
          ) : doc === "urenstaat" ? (
            <UrenstaatVel logoSrc={logo} footerLine={voorbeeld.footerLine} taal={taal} className="ov-schaduw" />
          ) : (
            <OfferteVel logoSrc={logo} footerLine={voorbeeld.footerLine} taal={taal} q={OFFERTE} className="ov-schaduw" />
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
