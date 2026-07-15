"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { disciplineValueOf } from "@/lib/domain";
import { aiImproveVacancy, aiFilterVacancy } from "@/lib/recruitment";
import { rematchVacancy } from "@/lib/matching";
import { aiRefineMatches } from "@/lib/msp";

const VacancySchema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  discipline: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  salary: z.string().optional(),
  clientId: z.string().optional(),
  companyName: z.string().optional(),
  summary: z.string().optional(),
  responsibilities: z.string().optional(),
  requirements: z.string().optional(),
  niceToHave: z.string().optional(),
  improvedText: z.string().optional(),
  linkedinPost: z.string().optional(),
  rawText: z.string().min(1, "Vacaturetekst is verplicht"),
});

// Build the DB payload, turning undefined/empty optionals into null so that
// clearing a field on edit actually clears it.
function toData(data: z.infer<typeof VacancySchema>) {
  const orNull = (v: string | undefined) => (v && v.trim() ? v : null);
  return {
    title: data.title,
    discipline: disciplineValueOf(data.discipline),
    location: orNull(data.location),
    employmentType: orNull(data.employmentType),
    salary: orNull(data.salary),
    clientId: data.clientId ?? null,
    companyName: orNull(data.companyName),
    summary: orNull(data.summary),
    responsibilities: orNull(data.responsibilities),
    requirements: orNull(data.requirements),
    niceToHave: orNull(data.niceToHave),
    improvedText: orNull(data.improvedText),
    linkedinPost: orNull(data.linkedinPost),
    rawText: data.rawText,
  };
}

/** Where to return after a publish/pause/resume — back to the list, the website
 *  hub or the vacancy detail, depending on where the action was triggered. */
function backTo(formData: FormData, id: string): string {
  const from = formData.get("from");
  if (from === "website") return "/website";
  if (from === "list") return "/vacatures";
  return `/vacatures/${id}`;
}

/** Make a URL-safe slug from a title with a short random suffix. */
function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "vacature"}-${suffix}`;
}

export async function createVacancy(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(VacancySchema, formData);
  if (!parsed.success) return parsed.state;

  const created = await db.vacancy.create({
    data: {
      ...toData(parsed.data),
      status: "CONCEPT",
      slug: makeSlug(parsed.data.title),
    },
  });
  revalidatePath("/vacatures");
  redirect(`/vacatures/${created.id}`);
}

export async function updateVacancy(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende vacature." };

  const parsed = parseForm(VacancySchema, formData);
  if (!parsed.success) return parsed.state;

  await db.vacancy.update({ where: { id }, data: toData(parsed.data) });
  revalidatePath("/vacatures");
  revalidatePath(`/vacatures/${id}`);
  redirect(`/vacatures/${id}`);
}

export async function deleteVacancy(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.vacancy.delete({ where: { id } });
  } catch {
    redirect(`/vacatures/${id}?error=in-use`);
  }
  revalidatePath("/vacatures");
  redirect("/vacatures");
}

/** AI: rewrite the raw vacancy into a professional text + LinkedIn post. */
export async function improveVacancy(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await aiImproveVacancy(id);
  } catch {
    redirect(`/vacatures/${id}?error=ai`);
  }
  revalidatePath("/vacatures");
  revalidatePath(`/vacatures/${id}`);
  redirect(`/vacatures/${id}`);
}

/** AI: judge whether this vacancy fits the Q4S niche (sets relevance). */
export async function filterRelevance(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await aiFilterVacancy(id);
  } catch {
    redirect(`/vacatures/${id}?error=ai`);
  }
  revalidatePath("/vacatures");
  revalidatePath(`/vacatures/${id}`);
  redirect(`/vacatures/${id}`);
}

/** (Her)bereken de kandidaat-matches voor deze vacature (regels + AI-scores). */
export async function rematchVacancyMatches(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const count = await rematchVacancy(id);
  if (count > 0) await aiRefineMatches(id);
  revalidatePath(`/vacatures/${id}`);
  revalidatePath("/msp");
  redirect(`/vacatures/${id}`);
}

export async function publishVacancy(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.vacancy.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  revalidatePath("/vacatures");
  revalidatePath(`/vacatures/${id}`);
  revalidatePath("/website");
  redirect(backTo(formData, id));
}

/** Pause a live vacancy: instantly off the public site, keeps it ready to resume. */
export async function pauseVacancy(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.vacancy.update({ where: { id }, data: { status: "PAUSED" } });
  revalidatePath("/vacatures");
  revalidatePath(`/vacatures/${id}`);
  revalidatePath("/website");
  redirect(backTo(formData, id));
}

/** Resume a paused vacancy back onto the public site. */
export async function resumeVacancy(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const vacancy = await db.vacancy.findUnique({ where: { id } });
  await db.vacancy.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: vacancy?.publishedAt ?? new Date() },
  });
  revalidatePath("/vacatures");
  revalidatePath(`/vacatures/${id}`);
  revalidatePath("/website");
  redirect(backTo(formData, id));
}

export async function unpublishVacancy(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const vacancy = await db.vacancy.findUnique({ where: { id } });
  if (!vacancy) redirect("/vacatures");

  await db.vacancy.update({
    where: { id },
    data: {
      status: vacancy.improvedText ? "IMPROVED" : "CONCEPT",
      publishedAt: null,
    },
  });

  revalidatePath("/vacatures");
  revalidatePath(`/vacatures/${id}`);
  redirect(`/vacatures/${id}`);
}

/**
 * Bulk-import raw vacancies: one per line. Optional "Titel | tekst" split,
 * otherwise the whole line is both title and rawText. Source = CSV.
 */
export async function importVacancies(formData: FormData) {
  const text = String(formData.get("text") ?? "");
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const sepIndex = line.indexOf(" | ");
    const title =
      sepIndex === -1 ? line : line.slice(0, sepIndex).trim() || line;
    const rawText =
      sepIndex === -1 ? line : line.slice(sepIndex + 3).trim() || line;

    await db.vacancy.create({
      data: {
        title,
        rawText,
        source: "CSV",
        status: "CONCEPT",
        slug: makeSlug(title),
      },
    });
  }

  revalidatePath("/vacatures");
  revalidatePath("/vacaturehub");
  redirect("/vacaturehub");
}
