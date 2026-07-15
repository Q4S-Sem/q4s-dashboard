"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { aiFilterVacancy, aiImproveVacancy } from "@/lib/recruitment";

// AI runs synchronously inside the request, so process bounded batches and let
// the user click again for the rest (a real queue/cron is the production path).
const FILTER_BATCH = 10;
const PUBLISH_BATCH = 3;

function revalidate() {
  revalidatePath("/vacaturehub");
  revalidatePath("/vacatures");
  revalidatePath("/website");
  revalidatePath("/recruitment");
}

/** AI-filter all not-yet-judged vacancies (bounded batch). */
export async function bulkFilterVacancies() {
  const pending = await db.vacancy.findMany({
    where: { relevance: "UNKNOWN" },
    orderBy: { createdAt: "asc" },
    take: FILTER_BATCH,
    select: { id: true },
  });

  let done = 0;
  for (const v of pending) {
    try {
      await aiFilterVacancy(v.id);
      done++;
    } catch {
      // Skip this one (e.g. AI error) and continue the batch.
    }
  }

  const remaining = await db.vacancy.count({ where: { relevance: "UNKNOWN" } });
  revalidate();
  redirect(`/vacaturehub?filtered=${done}&remaining=${remaining}`);
}

/** Improve + publish RELEVANT, not-yet-published vacancies (bounded batch). */
export async function bulkPublishRelevant() {
  const pending = await db.vacancy.findMany({
    where: { relevance: "RELEVANT", status: { not: "PUBLISHED" } },
    orderBy: { createdAt: "asc" },
    take: PUBLISH_BATCH,
    select: { id: true, improvedText: true },
  });

  let done = 0;
  for (const v of pending) {
    try {
      if (!v.improvedText) await aiImproveVacancy(v.id);
      await db.vacancy.update({
        where: { id: v.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      done++;
    } catch {
      // Skip and continue.
    }
  }

  const remaining = await db.vacancy.count({
    where: { relevance: "RELEVANT", status: { not: "PUBLISHED" } },
  });
  revalidate();
  redirect(`/vacaturehub?published=${done}&remaining=${remaining}`);
}

/** Process ONE vacancy end-to-end: filter (if needed) -> improve -> publish if relevant. */
export async function processVacancy(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const v = await db.vacancy.findUnique({
    where: { id },
    select: { relevance: true, improvedText: true },
  });
  if (!v) redirect("/vacaturehub");

  try {
    let relevance = v.relevance;
    if (relevance === "UNKNOWN") relevance = await aiFilterVacancy(id);
    if (relevance === "RELEVANT") {
      if (!v.improvedText) await aiImproveVacancy(id);
      await db.vacancy.update({
        where: { id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
    }
  } catch {
    redirect(`/vacaturehub?error=ai`);
  }

  revalidate();
  redirect("/vacaturehub");
}
