"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm } from "@/lib/form";
import { disciplineValueOf } from "@/lib/domain";
import { matchVacancy } from "@/lib/ai-match";

/** Make a URL-safe slug from a title with a short random suffix. */
function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "vacature"}-${suffix}`;
}

const QuickVacancySchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1, "Titel is verplicht"),
  discipline: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  requirements: z.string().optional(),
});

/**
 * Snel een vacature plaatsen vanuit de bedrijfswerkruimte: het bedrijf is al
 * bekend (clientId), dus alleen titel/discipline/locatie/eisen. De vacature komt
 * direct als IMPROVED (zichtbaar bij "openstaande vacatures") en op sourcing zodat
 * je er meteen op kunt matchen.
 */
export async function quickCreateVacancy(formData: FormData) {
  const parsed = parseForm(QuickVacancySchema, formData);
  if (!parsed.success) return;
  const { clientId, title, discipline, location, employmentType, requirements } = parsed.data;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { companyName: true },
  });
  if (!client) return;

  const orNull = (v: string | undefined) => (v && v.trim() ? v : null);

  await db.vacancy.create({
    data: {
      title,
      discipline: disciplineValueOf(discipline),
      location: orNull(location),
      employmentType: orNull(employmentType),
      requirements: orNull(requirements),
      clientId,
      companyName: client.companyName,
      rawText: [title, requirements].filter(Boolean).join("\n\n") || title,
      status: "IMPROVED",
      relevance: "RELEVANT",
      sourcing: true,
      slug: makeSlug(title),
    },
  });

  revalidatePath(`/opdrachtgevers/${clientId}`);
  redirect(`/opdrachtgevers/${clientId}`);
}

const MatchSchema = z.object({
  vacancyId: z.string().min(1),
  clientId: z.string().min(1),
});

/**
 * Draai de match voor één vacature (AI, met gratis fallback) en kom terug op de
 * werkruimte met de matches ingeklapt onder die vacature.
 */
export async function runVacancyMatch(formData: FormData) {
  const parsed = parseForm(MatchSchema, formData);
  if (!parsed.success) return;
  const { vacancyId, clientId } = parsed.data;

  await matchVacancy(vacancyId);

  revalidatePath(`/opdrachtgevers/${clientId}`);
  redirect(`/opdrachtgevers/${clientId}?match=${vacancyId}#vac-${vacancyId}`);
}
