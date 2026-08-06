import type { CompanySettings } from "./settings";
import { documentAccent } from "./doc-style";

// De accentkleur en de kleurhulpjes zijn niet van het CV alleen — ze staan in
// doc-style.ts en worden hier doorgegeven, zodat bestaande imports blijven werken.
export { shade, readableOn } from "./doc-style";

/**
 * De vormgeving van het Q4S-CV, los van de inhoud.
 *
 * Eén huisstijl voor elk CV dat de deur uit gaat, maar wél instelbaar: de
 * accentkleur, de indeling en welke onderdelen meedoen. De standaard is het
 * Q4S-oranje in twee kolommen — zet niemand er iets aan, dan ziet elk CV er
 * hetzelfde uit.
 */

export const CV_SECTIONS = [
  { key: "summary", label: "Profiel" },
  { key: "certificates", label: "Certificaten" },
  { key: "experience", label: "Werkervaring" },
  { key: "education", label: "Opleidingen" },
  { key: "skills", label: "Vaardigheden" },
  { key: "languages", label: "Talen" },
] as const;

export type CvSectionKey = (typeof CV_SECTIONS)[number]["key"];

/**
 * Standaardvolgorde. Certificaten staan bewust vóór werkervaring: een
 * opdrachtgever stelt eerst de ja/nee-vraag ("mag deze man op mijn werk?") en
 * pas daarna de hoe-goed-vraag. Een ontbrekend certificaat dat pas op pagina 2
 * blijkt, kost een plaatsing van iemand die wél gekwalificeerd is.
 */
export const DEFAULT_SECTION_ORDER: CvSectionKey[] = [
  "summary",
  "certificates",
  "experience",
  "education",
  "skills",
  "languages",
];

/** Welke secties in de smalle zijkolom horen (bij de twee-koloms indeling). */
export const SIDEBAR_SECTIONS: CvSectionKey[] = ["skills", "languages", "certificates"];

export type CvLayout = "TWEE_KOLOMS" | "EEN_KOLOM";

export type CvTemplate = {
  accent: string;
  layout: CvLayout;
  showPhoto: boolean;
  showSkillBars: boolean;
  showLogo: boolean;
  sectionOrder: CvSectionKey[];
  footerNote: string;
};

/** Lees de sectievolgorde uit de instellingen; vul ontbrekende secties aan. */
function readOrder(raw: string): CvSectionKey[] {
  let uit: CvSectionKey[] = [];
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (Array.isArray(parsed)) {
      const geldig = new Set<string>(CV_SECTIONS.map((s) => s.key));
      uit = parsed.filter((k): k is CvSectionKey => typeof k === "string" && geldig.has(k));
    }
  } catch {
    uit = [];
  }
  // Nooit een sectie stilletjes laten verdwijnen doordat hij niet in de
  // opgeslagen volgorde stond (bv. na een update met een nieuwe sectie).
  for (const s of DEFAULT_SECTION_ORDER) if (!uit.includes(s)) uit.push(s);
  return uit;
}

export function cvTemplateFromSettings(s: CompanySettings): CvTemplate {
  return {
    accent: documentAccent(s),
    layout: s.cvLayout === "EEN_KOLOM" ? "EEN_KOLOM" : "TWEE_KOLOMS",
    showPhoto: s.cvShowPhoto !== false,
    showSkillBars: s.cvShowSkillBars === true,
    showLogo: s.cvShowLogo !== false,
    sectionOrder: readOrder(s.cvSectionOrder ?? ""),
    footerNote: (s.cvFooterNote ?? "").trim(),
  };
}
