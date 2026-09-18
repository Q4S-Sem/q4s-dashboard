import type { Deal } from "@prisma/client";
import { labelFor, DISCIPLINES } from "@/lib/domain";

/** De velden die op de LinkedIn-kaart komen. Alles is tekst zodat de editor
 *  ze vrij kan aanpassen voordat de afbeelding wordt gegenereerd. */
export type LinkedInCardData = {
  discipline: string;
  title: string;
  location: string;
  hours: string;
  duration: string;
  intro: string;
  points: string[];
  cta: string;
  badge: string;
};

/** Standaard oproep-regel onderaan de kaart (door de gebruiker aanpasbaar). */
export const DEFAULT_CTA = "Interesse of ken je iemand? Reageer via Q4S Project Partners";
export const DEFAULT_BADGE = "NIEUWE OPDRACHT";

/** Vaste afmeting: LinkedIn feed-vierkant. */
export const CARD_W = 1080;
export const CARD_H = 1080;

function fmtDateNL(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Splits een tekstblok (één item per regel, of met bullets) in losse punten. */
export function splitPoints(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-–*·]+/, "").trim())
    .filter((l) => l.length > 0);
}

/** Leidt de standaard kaart-inhoud af uit een vacature (Deal). De gebruiker kan
 *  dit daarna nog aanpassen in de editor. Toont 3–4 punten. */
export function cardDefaultsFromDeal(deal: Pick<
  Deal,
  "title" | "company" | "discipline" | "location" | "employmentType" | "hoursPerWeek" | "durationText" | "responsibilities" | "expectedCloseDate"
>): LinkedInCardData {
  const disc = deal.discipline ? labelFor(DISCIPLINES, deal.discipline) : "Opdracht";
  const hoursParts: string[] = [];
  if (deal.hoursPerWeek) hoursParts.push(`${deal.hoursPerWeek} uur/week`);
  if (deal.employmentType) hoursParts.push(deal.employmentType);
  const points = splitPoints(deal.responsibilities).slice(0, 4);
  return {
    discipline: disc,
    title: deal.title,
    location: deal.location || deal.company || "",
    hours: hoursParts.join(" · "),
    duration: deal.durationText || (deal.expectedCloseDate ? `Start ${fmtDateNL(deal.expectedCloseDate)}` : ""),
    intro: "",
    points,
    cta: DEFAULT_CTA,
    badge: DEFAULT_BADGE,
  };
}

/** Leidt kaart-inhoud af uit een website-vacature (Vacancy-model). */
export function cardDefaultsFromVacancy(v: {
  title: string;
  discipline?: string | null;
  location?: string | null;
  employmentType?: string | null;
  salary?: string | null;
  responsibilities?: string | null;
  summary?: string | null;
}): LinkedInCardData {
  const disc = v.discipline ? labelFor(DISCIPLINES, v.discipline) : "Opdracht";
  const points = splitPoints(v.responsibilities).slice(0, 4);
  const intro = (v.summary || "").trim();
  return {
    discipline: disc,
    title: v.title,
    location: v.location || "",
    hours: v.employmentType || "",
    duration: v.salary || "",
    intro: intro.length > 220 ? intro.slice(0, 217).trimEnd() + "…" : intro,
    points,
    cta: DEFAULT_CTA,
    badge: DEFAULT_BADGE,
  };
}

/** Zet de kaart-data om in URL-query params voor de OG-route. */
export function cardToParams(d: LinkedInCardData): URLSearchParams {
  const p = new URLSearchParams();
  p.set("discipline", d.discipline);
  p.set("title", d.title);
  p.set("location", d.location);
  p.set("hours", d.hours);
  p.set("duration", d.duration);
  p.set("intro", d.intro);
  p.set("cta", d.cta);
  p.set("badge", d.badge);
  d.points.forEach((pt) => p.append("point", pt));
  return p;
}

/** Lees de kaart-data terug uit URL-query params (in de OG-route). */
export function cardFromParams(sp: URLSearchParams): LinkedInCardData {
  return {
    discipline: sp.get("discipline") || "Opdracht",
    title: sp.get("title") || "Nieuwe opdracht",
    location: sp.get("location") || "",
    hours: sp.get("hours") || "",
    duration: sp.get("duration") || "",
    intro: sp.get("intro") || "",
    points: sp.getAll("point").filter(Boolean).slice(0, 4),
    cta: sp.get("cta") || DEFAULT_CTA,
    badge: sp.get("badge") || DEFAULT_BADGE,
  };
}
