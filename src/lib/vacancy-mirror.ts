import "server-only";
import { db } from "@/lib/db";

/** URL-veilige slug uit een titel (diacritics weg, spaties → streepjes). */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "vacature"
  );
}

/** Zorg voor een unieke Vacancy.slug (voegt -2, -3… toe bij een botsing). */
async function uniqueVacancySlug(base: string): Promise<string> {
  const root = slugify(base);
  let slug = root;
  let n = 1;
  // Kleine, begrensde lus — botsingen zijn zeldzaam.
  while (await db.vacancy.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1;
    slug = `${root}-${n}`;
  }
  return slug;
}

/** Bouw de ruwe vacaturetekst uit de gestructureerde Deal-velden (voor de AI-uitwerking). */
function buildRawText(d: {
  title: string;
  company: string;
  discipline: string | null;
  location: string | null;
  employmentType: string | null;
  hoursPerWeek: number | null;
  durationText: string | null;
  rateText: string | null;
  experienceText: string | null;
  educationLevel: string | null;
  responsibilities: string | null;
  requirements: string | null;
  niceToHave: string | null;
  certificates: string | null;
}): string {
  const lines: string[] = [`Functie: ${d.title}`, `Opdrachtgever: ${d.company}`];
  if (d.discipline) lines.push(`Discipline: ${d.discipline}`);
  if (d.location) lines.push(`Standplaats: ${d.location}`);
  if (d.employmentType) lines.push(`Dienstverband: ${d.employmentType}`);
  if (d.hoursPerWeek) lines.push(`Uren per week: ${d.hoursPerWeek}`);
  if (d.durationText) lines.push(`Duur: ${d.durationText}`);
  if (d.rateText) lines.push(`Tarief/salaris: ${d.rateText}`);
  if (d.experienceText) lines.push(`Ervaring: ${d.experienceText}`);
  if (d.educationLevel) lines.push(`Opleidingsniveau: ${d.educationLevel}`);
  if (d.responsibilities) lines.push(`\nWerkzaamheden:\n${d.responsibilities}`);
  if (d.requirements) lines.push(`\nFunctie-eisen:\n${d.requirements}`);
  if (d.niceToHave) lines.push(`\nPré:\n${d.niceToHave}`);
  if (d.certificates) lines.push(`\nCertificaten:\n${d.certificates}`);
  return lines.join("\n");
}

/**
 * Spiegel een recruitment-vacature (Deal zonder kandidaat) naar een website-
 * `Vacancy` als CONCEPT, zodat hij automatisch verschijnt in "Op de website".
 * De recruitment-hub is leidend: hier hoeft niets geïmporteerd te worden.
 *
 * - Draait alleen voor vacature-deals (`candidateId == null`); een plaatsing
 *   (deal mét kandidaat) is géén website-vacature.
 * - Idempotent: als de deal al aan een Vacancy hangt (`vacancyId`) gebeurt er
 *   niets. Koppelt de nieuwe Vacancy terug via `Deal.vacancyId`.
 * - Vult de praktische velden vast in; de wervende website-tekst + LinkedIn-post
 *   maakt de recruiter later met de "Genereer"-knop op de vacaturepagina.
 * - Faalt zacht: een fout hier mag het aanmaken van de deal nooit blokkeren.
 */
export async function mirrorDealToVacancy(dealId: string): Promise<string | null> {
  try {
    const deal = await db.deal.findUnique({ where: { id: dealId } });
    if (!deal) return null;
    // Alleen echte vacatures (zonder kandidaat) spiegelen, en niet dubbel.
    if (deal.candidateId) return null;
    if (deal.vacancyId) return null;

    const slug = await uniqueVacancySlug(deal.title);
    const rawText = buildRawText(deal);

    const vacancy = await db.vacancy.create({
      data: {
        title: deal.title,
        discipline: deal.discipline,
        location: deal.location,
        employmentType: deal.employmentType,
        salary: deal.rateText,
        clientId: deal.clientId,
        companyName: deal.company,
        rawText,
        // Praktische secties alvast overnemen; AI werkt ze straks wervend uit.
        responsibilities: deal.responsibilities,
        requirements: deal.requirements,
        niceToHave: deal.niceToHave,
        status: "CONCEPT",
        slug,
        source: "MANUAL",
        relevance: "RELEVANT",
      },
      select: { id: true },
    });

    // Koppel de deal aan zijn website-mirror (zowel voor dedup als navigatie).
    await db.deal.update({ where: { id: dealId }, data: { vacancyId: vacancy.id } });
    return vacancy.id;
  } catch (err) {
    // Nooit het aanmaken van de deal laten falen op de mirror.
    console.error("mirrorDealToVacancy mislukt:", err);
    return null;
  }
}
