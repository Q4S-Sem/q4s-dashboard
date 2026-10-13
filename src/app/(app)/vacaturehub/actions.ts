"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { after } from "next/server";
import { aiFilterVacancy, aiImproveVacancy } from "@/lib/recruitment";
import { runDailySync } from "@/lib/sync";
import { MSP_WHERE, RUN_STALE_MS } from "./(hub)/data";

// AI runs synchronously inside the request, so process bounded batches and let
// the user click again for the rest (a real queue/cron is the production path).
const FILTER_BATCH = 10;

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

/**
 * Agents nu laten draaien (Web-speurder → AI-filter → Matcher) op de achtergrond:
 * de pagina komt meteen terug en ververst zichzelf, zodat je de stappen live ziet.
 * Nooit twee rondes tegelijk.
 */
export async function startAgents() {
  // Ingelogd is al afgedwongen door de proxy (elke server action).
  const bezig = await db.syncRun.findFirst({
    where: { status: "RUNNING", startedAt: { gt: new Date(Date.now() - RUN_STALE_MS) } },
    select: { id: true },
  });
  if (!bezig) after(() => runDailySync("MANUAL").then(revalidate));
  redirect("/vacaturehub");
}

/** AI-filter de nog niet beoordeelde vacatures (per batch, evt. per bron). */
export async function bulkFilterVacancies(formData: FormData) {
  const source = String(formData.get("source") ?? "");
  const where = { ...MSP_WHERE, relevance: "UNKNOWN", ...sourceFilter(source) };

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

/**
 * ✓ Oppakken: de AI schrijft de vacature uit in Q4S-stijl (incl. LinkedIn-tekst)
 * en je landt op de controlepagina, waar je hem zelf op de site en LinkedIn zet.
 */
export async function oppakken(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/vacaturehub");
  let fout = false;
  try {
    await aiImproveVacancy(id);
  } catch {
    // AI faalt → toch door naar de controlepagina; daar kun je zelf schrijven.
    fout = true;
    await db.vacancy.update({ where: { id }, data: { status: "IMPROVED" } }).catch(() => {});
  }
  revalidate();
  redirect(`/vacatures/${id}${fout ? "?error=ai" : ""}`);
}

/** ☎ Lead: zet een taak "bel dit bedrijf" klaar — dit bedrijf zoekt nú iemand. */
export async function leadMaken(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = backTo(formData);
  const v = id
    ? await db.vacancy.findUnique({
        where: { id },
        select: { title: true, companyName: true, location: true, sourceUrl: true, relevanceReason: true, _count: { select: { matches: true } } },
      })
    : null;
  if (!v) redirect(back);
  await db.task.create({
    data: {
      title: `Bel ${v.companyName ?? "opdrachtgever"}: zoekt ${v.title}`.slice(0, 200),
      notes: [
        v.location && `Locatie: ${v.location}`,
        `${v._count.matches} passende kandidaat/kandidaten in ons bestand.`,
        v.relevanceReason,
        v.sourceUrl && `Vacature: ${v.sourceUrl}`,
        `Dashboard: /vacatures/${id}`,
      ]
        .filter(Boolean)
        .join("\n"),
      dueDate: new Date(),
      priority: "HIGH",
    },
  });
  revalidatePath("/agenda/taken");
  redirect(withQuery(back, { lead: 1 }));
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
        value === "UNKNOWN"
          ? null
          : value === "IRRELEVANT"
            ? "Weggelegd door een recruiter."
            : "Teruggezet door een recruiter.",
    },
  });
  revalidate();
  redirect(back);
}
