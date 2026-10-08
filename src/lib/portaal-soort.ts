// Soort portaal in Wachtwoorden — bepaalt wat de MSP-agent ermee kan:
//   MSP    — MSP/VMS/inhuurplatform: hier staan vacatures/aanvragen
//   KLANT  — portaal van een opdrachtgever (leveranciers-/inkoop-/toegangsportaal)
//   OVERIG — eigen administratie, overheid, tools
// Alleen naam, link en notitie tellen mee — nooit gebruikersnaam of wachtwoord.

export type PortaalSoort = "MSP" | "KLANT" | "OVERIG";

export const PORTAAL_SOORTEN: { value: PortaalSoort; label: string }[] = [
  { value: "MSP", label: "MSP / VMS" },
  { value: "KLANT", label: "Bedrijfsportaal" },
  { value: "OVERIG", label: "Overig" },
];

const MSP = /\b(vms|msp)\b|icims|n[eé]tive|fieldglass|magnit|beeline|striive|headfirst|flexoord|inhuur|mercell|tenderned|coupa|workday|sap ?ariba|\bariba\b|bullhorn|deprojectbox|jobdiva|recruit/i;
const OVERIG = /belasting|kvk|uwv|\bbank\b|\bing\b|rabo|abn|exact|moneybird|google|microsoft|office|linkedin|indeed|adobe|canva|vercel|github|digid|eherkenning/i;

/** Snelle inschatting zonder AI (ook de terugval als AI uit staat). */
export function raadPortaalSoort(p: { name: string; url: string; notes: string }): PortaalSoort {
  const tekst = `${p.name} ${p.url} ${p.notes}`;
  if (MSP.test(tekst)) return "MSP";
  if (OVERIG.test(tekst)) return "OVERIG";
  return "KLANT";
}

export function portaalSoort(v: string | null | undefined): PortaalSoort | null {
  return v === "MSP" || v === "KLANT" || v === "OVERIG" ? v : null;
}

/** Link uit de notitie halen als het link-veld leeg is ("Portaal: … https://…"). */
export function portaalLink(p: { url: string; notes: string }): string {
  if (p.url) return p.url;
  const m = p.notes.match(/https?:\/\/[^\s)]+/);
  return m ? m[0] : "";
}

/** Stabiele connector-sleutel uit een portaalnaam ("Damen Access" → "damen-access"). */
export function connectorKey(naam: string): string {
  return naam
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "portaal";
}
