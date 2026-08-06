import type { CompanySettings } from "./settings";

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

const HEX = /^#[0-9a-f]{6}$/i;

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
  const accent = HEX.test(String(s.cvAccent ?? "")) ? s.cvAccent : "#e8430a";
  return {
    accent,
    layout: s.cvLayout === "EEN_KOLOM" ? "EEN_KOLOM" : "TWEE_KOLOMS",
    showPhoto: s.cvShowPhoto !== false,
    showSkillBars: s.cvShowSkillBars === true,
    showLogo: s.cvShowLogo !== false,
    sectionOrder: readOrder(s.cvSectionOrder ?? ""),
    footerNote: (s.cvFooterNote ?? "").trim(),
  };
}

/** Wat lichter/donkerder maken van een hexkleur, voor tinten uit één accent. */
export function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const kanaal = (v: string) => {
    const n = parseInt(v, 16);
    const uit = amount >= 0 ? n + (255 - n) * amount : n * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(uit)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${kanaal(m[1])}${kanaal(m[2])}${kanaal(m[3])}`;
}

/** Zwarte of witte tekst, afhankelijk van wat leesbaar is op deze kleur. */
export function readableOn(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#111110" : "#ffffff";
}
