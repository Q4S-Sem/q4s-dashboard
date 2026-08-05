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
  revalidatePath("/vacaturehub", "layout");
  revalidatePath("/vacatures");
  revalidatePath("/website");
  revalidatePath("/recruitment");
}

/** Waar de gebruiker vandaan kwam — zo landt hij terug in hetzelfde mapje. */
function backTo(formData: FormData, fallback = "/vacaturehub"): string {
  const back = String(formData.get("back") ?? "").trim();
  return back.startsWith("/vacaturehub") ? back : fallback;
}

function withQuery(path: string, params: Record<string, string | number>): string {
  const [base, existing] = path.split("?");
  const qs = new URLSearchParams(existing);
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return `${base}?${qs.toString()}`;
}

/** Alleen de vacatures van één bron (connector-id, of "overig" = zonder koppeling). */
function sourceFilter(source: string) {
  if (!source) return {};
  return source === "overig" ? { vmsConnectorId: null } : { vmsConnectorId: source };
}

/** AI-filter de nog niet beoordeelde vacatures (per batch, evt. per bron). */
export async function bulkFilterVacancies(formData: FormData) {
  const source = String(formData.get("source") ?? "");
  const where = { relevance: "UNKNOWN", ...sourceFilter(source) };

  const pending = await db.vacancy.findMany({
    where,
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
      // Sla deze over (bijv. AI-fout) en ga door met de batch.
    }
  }

  const remaining = await db.vacancy.count({ where });
  revalidate();
  redirect(withQuery(backTo(formData, "/vacaturehub/beoordelen"), { filtered: done, remaining }));
}

/** Verbeter + publiceer de relevante vacatures (per batch, evt. per bron). */
export async function bulkPublishRelevant(formData: FormData) {
  const source = String(formData.get("source") ?? "");
  const where = {
    relevance: "RELEVANT",
    status: { not: "PUBLISHED" },
    ...sourceFilter(source),
  };

  const pending = await db.vacancy.findMany({
    where,
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
      // Sla over en ga door.
    }
  }

  const remaining = await db.vacancy.count({ where });
  revalidate();
  redirect(withQuery(backTo(formData, "/vacaturehub/relevant"), { published: done, remaining }));
}

/** Eén vacature volledig door de molen: filteren (indien nodig) → uitschrijven → publiceren. */
export async function processVacancy(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = backTo(formData);
  if (!id) redirect(back);

  const v = await db.vacancy.findUnique({
    where: { id },
    select: { relevance: true, improvedText: true },
  });
  if (!v) redirect(back);

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
    revalidate();
    redirect(withQuery(back, { error: "ai" }));
  }

  revalidate();
  redirect(back);
}

/** Eén vacature door de AI-filter halen (alleen beoordelen, niet publiceren). */
export async function aiFilterOne(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = backTo(formData, "/vacaturehub/beoordelen");
  if (!id) redirect(back);

  try {
    await aiFilterVacancy(id);
  } catch {
    revalidate();
    redirect(withQuery(back, { error: "ai" }));
  }
  revalidate();
  redirect(back);
}

/** Zelf het oordeel geven (of dat van de AI terugdraaien). */
export async function setRelevance(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const value = String(formData.get("relevance") ?? "");
  const back = backTo(formData);
  if (!id || !["RELEVANT", "IRRELEVANT", "UNKNOWN"].includes(value)) redirect(back);

  await db.vacancy.update({
    where: { id },
    data: {
      relevance: value,
      relevanceReason:
        value === "UNKNOWN" ? null : "Handmatig beoordeeld door een recruiter.",
    },
  });
  revalidate();
  redirect(back);
}
