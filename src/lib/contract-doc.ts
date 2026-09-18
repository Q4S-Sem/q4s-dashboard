import type { Contract } from "@prisma/client";
import type { CompanySettings } from "./settings";

/**
 * De "Overeenkomst van opdracht" zoals hij op papier komt.
 *
 * De VASTE juridische tekst (de door de Belastingdienst goedgekeurde
 * modelartikelen 1 t/m 11) staat hier hard gecodeerd en wordt NIET per contract
 * bewerkt — zo blijft elk contract woordelijk gelijkluidend aan de
 * modelovereenkomst (nr. 90821.25537.3.0) en behoudt het zijn vrijwaring tegen
 * schijnzelfstandigheid. Alleen de VARIABELE velden (opdrachtnemer, opdracht,
 * duur, tarieven, ondertekening) komen uit het Contract-record.
 *
 * De aanvullende artikelen 12–14 (geheimhouding, AVG, IE) zijn niet-conflicterende
 * toevoegingen: ze raken de modelartikelen niet en zijn per contract in/uit te
 * schakelen.
 *
 * Zowel de HTML-preview/print (ContractVel) als de PDF-download voeden zich uit
 * dit ene document, zodat wat je ziet ook is wat eruit rolt.
 */

export type ContractDoc = {
  number: string | null;
  /** Opdrachtgever (vast: Q4S), uit de bedrijfsinstellingen. */
  client: {
    name: string;
    address: string;
    kvk: string;
    signer: string;
  };
  contractor: {
    name: string;
    address: string;
    kvk: string;
    vat: string;
  };
  fieldOfWork: string;
  serviceNeed: string;
  thirdParty: string;
  workDescription: string;
  startDate: string;
  endDate: string;
  projectDuration: string;
  noticePeriod: string;
  rates: {
    day: string;
    shift: string;
    saturday: string;
    sunday: string;
    offshore: string;
    overtime: string;
    overtimeApplies: string;
    dayFixed: string;
    dayBasedOnHours: string;
    km: string;
    vatReverseCharge: boolean;
  };
  invoiceEmail: string;
  paymentTermDays: number;
  insuranceCover: string;
  extras: {
    confidentiality: boolean;
    gdpr: boolean;
    ip: boolean;
  };
  sign: {
    clientName: string;
    clientPlace: string;
    contractorName: string;
    contractorPlace: string;
    date: string;
  };
  footerLine: string;
};

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** Contract-record + bedrijfsinstellingen → het document dat op papier komt. */
export function buildContractDoc(contract: Contract, settings: CompanySettings): ContractDoc {
  const companyName = settings.companyName || "Q4S B.V.";
  const clientAddress = [settings.address, [settings.postalCode, settings.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ") || "Barendrecht, 2994LA Arnhemseweg 12";

  const footerLine = [
    `${companyName}, ${settings.address || "Arnhemseweg 12"}, ${settings.postalCode || "2994LA"} ${settings.city || "Barendrecht"}, the Netherlands`,
    settings.website || "www.q4s.nl",
    settings.email || "info@q4s.nl",
    settings.phone ? `Tel: ${settings.phone}` : "Tel: +31(0) 85 782 6818",
    `KvK: ${settings.kvkNumber || "69073287"}`,
    `Btw: ${settings.vatNumber || "NL857718137B01"}`,
    settings.iban ? `IBAN: ${settings.iban}` : "IBAN: NL96INGB0007873625",
  ].join(" · ");

  return {
    number: contract.number,
    client: {
      name: companyName,
      address: clientAddress,
      kvk: settings.kvkNumber || "69073287",
      signer: contract.signerClient || "Paul Boomsma",
    },
    contractor: {
      name: contract.contractorName,
      address: contract.contractorAddress,
      kvk: contract.contractorKvk,
      vat: contract.contractorVat,
    },
    fieldOfWork: contract.fieldOfWork,
    serviceNeed: contract.serviceNeed,
    thirdParty: contract.thirdParty,
    workDescription: contract.workDescription,
    startDate: fmtDate(contract.startDate),
    endDate: fmtDate(contract.endDate),
    projectDuration: contract.projectDuration,
    noticePeriod: contract.noticePeriod || "twee (2) weken",
    rates: {
      day: contract.rateDay,
      shift: contract.rateShift,
      saturday: contract.rateSaturday,
      sunday: contract.rateSunday,
      offshore: contract.rateOffshore,
      overtime: contract.rateOvertime,
      overtimeApplies: contract.overtimeApplies,
      dayFixed: contract.rateDayFixed,
      dayBasedOnHours: contract.dayBasedOnHours,
      km: contract.kmRate,
      vatReverseCharge: contract.vatReverseCharge,
    },
    invoiceEmail: contract.invoiceEmail || "admin@q4s.nl",
    paymentTermDays: contract.paymentTermDays,
    insuranceCover: contract.insuranceCover || "€ 2.500.000,-",
    extras: {
      confidentiality: contract.includeConfidentiality,
      gdpr: contract.includeGdpr,
      ip: contract.includeIp,
    },
    sign: {
      clientName: contract.signerClient || "P. Boomsma",
      clientPlace: contract.signPlaceClient || "Barendrecht",
      contractorName: contract.signerContractor,
      contractorPlace: contract.signPlaceContractor,
      date: fmtDate(contract.signDate),
    },
    footerLine,
  };
}

/**
 * Bestandsnaam voor de download: "Q4S-Overeenkomst-van-opdracht-Jansen.pdf".
 * ASCII-only voor de Content-Disposition-header.
 */
export function contractFileName(doc: ContractDoc): string {
  const safe = (doc.contractor.name || "opdrachtnemer")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `Q4S-Overeenkomst-van-opdracht-${safe || "opdrachtnemer"}.pdf`;
}
