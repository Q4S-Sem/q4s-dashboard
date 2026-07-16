import type { CvProfile } from "@prisma/client";
import type { CompanySettings } from "./settings";
import {
  cvCertificateSchema,
  cvEducationSchema,
  cvExperienceSchema,
  cvLanguageSchema,
  parseSection,
  type CvCertificate,
  type CvEducation,
  type CvExperience,
  type CvLanguage,
  type CvProfileData,
} from "./cv-profile";

/**
 * De laatste bewerking vóór het papier: CvProfile (database) → CvDoc (wat er
 * letterlijk op het CV komt te staan). Hier wordt geanonimiseerd.
 *
 * PDF (cv-pdf.ts) en Word (cv-docx.ts) renderen ALLEBEI uit deze ene CvDoc. Dat
 * is bewust: anders lopen twee layouts uit elkaar en stuur je een klant een Word
 * met gegevens die de PDF juist verbergt.
 */

export type CvDoc = {
  /** Weergavenaam: volledig, of "Jan D." bij anonimiseren. */
  displayName: string;
  headline: string;
  /** Regels onder de naam: locatie · beschikbaar · X jaar ervaring. */
  metaLine: string;
  summary: string;
  skills: string[];
  languages: CvLanguage[];
  experience: CvExperience[];
  education: CvEducation[];
  certificates: CvCertificate[];
  /** Kop boven het contactblok ("Contact" of "Contact via Q4S"). */
  contactLabel: string;
  contactLines: string[];
  companyName: string;
  footerLine: string;
  anonymized: boolean;
};

function compact(items: (string | null | undefined)[]): string[] {
  return items.filter((x): x is string => Boolean(x && x.trim())).map((x) => x.trim());
}

/**
 * "Jan de Vries" → "Jan D.". Tussenvoegsels (de/van/der…) horen bij de achternaam
 * en verdwijnen dus mee; anders lekt "Jan de V." alsnog een stukje identiteit.
 * Eén naamdeel → onveranderd (er valt niets te verbergen).
 */
export function anonymizeName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return fullName.trim();
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

// Contactgegevens die in vrije tekst kunnen zitten. Een geanonimiseerd CV waar de
// AI het 06-nummer in de profielschets heeft gezet, is niet geanonimiseerd — dus
// schrobben we ook summary en bullets, niet alleen de contactvelden.
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
// Telefoonnummers: 9+ cijfers, eventueel met spaties/streepjes/haakjes/landcode.
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\(0\)[\s-]?)?(?:\d[\s-]?){9,}\d/g;

/** Haal e-mail, telefoon en links uit vrije tekst (alleen bij anonimiseren). */
export function scrubContacts(value: string): string {
  return value
    .replace(EMAIL_RE, "[contact via Q4S]")
    .replace(URL_RE, "[link verwijderd]")
    .replace(PHONE_RE, "[contact via Q4S]")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** CvProfile-record → het bewerkbare profiel (voor het review-scherm). */
export function profileToData(p: CvProfile): CvProfileData {
  let skills: string[] = [];
  try {
    const raw: unknown = JSON.parse(p.skillsJson || "[]");
    if (Array.isArray(raw)) skills = raw.filter((s): s is string => typeof s === "string");
  } catch {
    skills = [];
  }
  return {
    fullName: p.fullName,
    headline: p.headline ?? "",
    location: p.location ?? "",
    availability: p.availability ?? "",
    summary: p.summary ?? "",
    yearsExperience: p.yearsExperience,
    skills,
    languages: parseSection(p.languagesJson, cvLanguageSchema),
    experience: parseSection(p.experienceJson, cvExperienceSchema),
    education: parseSection(p.educationJson, cvEducationSchema),
    certificates: parseSection(p.certificatesJson, cvCertificateSchema),
  };
}

type CandidateContact = {
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
};

/**
 * Bouw het CV zoals het naar de opdrachtgever gaat.
 *
 * Bij `anonymize` (standaard aan, zie het CvProfile-model): achternaam → initiaal,
 * kandidaat-contactgegevens eruit, Q4S als enige contact, en vrije tekst geschrobd.
 * Zonder anonimiseren staan naam en contactgegevens van de kandidaat er gewoon op.
 */
export function buildCvDoc(
  profile: CvProfile,
  settings: CompanySettings,
  candidate?: CandidateContact | null,
): CvDoc {
  const data = profileToData(profile);
  const anon = profile.anonymize;

  const clean = (s: string) => (anon ? scrubContacts(s) : s);

  const metaParts = compact([
    data.location,
    data.availability ? `Beschikbaar: ${data.availability}` : "",
    data.yearsExperience != null ? `${data.yearsExperience} jaar ervaring` : "",
  ]);

  const companyName = settings.companyName || "Q4S";

  const contactLines = anon
    ? compact([settings.email, settings.phone, settings.website])
    : compact([candidate?.email, candidate?.phone, candidate?.linkedinUrl]);

  return {
    displayName: anon ? anonymizeName(data.fullName) : data.fullName,
    headline: data.headline,
    metaLine: metaParts.join("  ·  "),
    summary: clean(data.summary),
    skills: data.skills,
    languages: data.languages,
    experience: data.experience.map((e) => ({
      ...e,
      bullets: e.bullets.map(clean).filter(Boolean),
    })),
    education: data.education,
    certificates: data.certificates,
    contactLabel: anon ? `Contact via ${companyName}` : "Contact",
    // Zonder anonimiseren kan de kandidaat gewoon geen e-mail/telefoon hebben; val
    // dan terug op Q4S, zodat er nooit een CV zonder enig contact uitgaat.
    contactLines: contactLines.length
      ? contactLines
      : compact([settings.email, settings.phone, settings.website]),
    companyName,
    footerLine: compact([
      companyName,
      [settings.email, settings.phone, settings.website].filter(Boolean).join("  ·  "),
    ]).join("  ·  "),
    anonymized: anon,
  };
}

/**
 * Bestandsnaam voor de download: "Q4S-CV-Jan-D.pdf".
 *
 * Een Content-Disposition-header is ASCII, dus accenten moeten eruit. Wél éérst
 * translitereren: kaal filteren maakte van "Michał W." het rare "Micha-W..pdf" —
 * de ł verdween en de punt van de initiaal plakte tegen de extensie.
 */
export function cvFileName(doc: CvDoc, ext: "pdf" | "docx"): string {
  const safe = doc.displayName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .replace(/[^\w]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `Q4S-CV-${safe || "kandidaat"}.${ext}`;
}
