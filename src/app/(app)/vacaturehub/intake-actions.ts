"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  simulateMspDelivery,
  pullConnector,
  type PipelineResult,
} from "@/lib/msp";

// De intake-kant van de vacaturehub: platformen koppelen, leveringen ophalen en
// de meldingen die daaruit komen afvinken. Publiceren gebeurt bewust niet hier —
// dat doe je op de maken-pagina.

function countFailed(results: PipelineResult[]): number {
  return results.reduce((n, r) => n + r.steps.filter((s) => s.status === "failed").length, 0);
}

function back(formData: FormData, fallback = "/vacaturehub"): string {
  const b = String(formData.get("back") ?? "").trim();
  return b.startsWith("/vacaturehub") ? b : fallback;
}

function withQuery(path: string, params: Record<string, string | number>): string {
  const [base, existing] = path.split("?");
  const qs = new URLSearchParams(existing);
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return `${base}?${qs.toString()}`;
}

function revalidate() {
  revalidatePath("/vacaturehub", "layout");
  revalidatePath("/vacatures");
  revalidatePath("/", "layout");
}

/** Draai een gesimuleerde levering door de volledige pijplijn (om te testen). */
export async function simulateDelivery(formData: FormData) {
  const r = await simulateMspDelivery("magnit");
  const relevant = r.results.filter((x) => x.relevant === true).length;
  revalidate();
  redirect(
    withQuery(back(formData, "/vacaturehub/instroom"), {
      sim: r.created,
      skipped: r.skipped,
      rel: relevant,
      failed: countFailed(r.results),
    }),
  );
}

/** Haal nu op via de API van een platform (werkt zodra sleutel + URL staan). */
export async function pullNow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const target = back(formData, "/vacaturehub/instroom");
  if (!id) redirect(target);

  const r = await pullConnector(id);
  revalidate();
  if (!r) redirect(withQuery(target, { pull: "no-config" }));
  if (!r.ok) redirect(withQuery(target, { pull: "error", msg: r.error ?? "onbekende fout" }));
  redirect(withQuery(target, { pull: "ok", received: r.received, created: r.created }));
}

/**
 * Koppel een platform aan het dashboard: API-adres + sleutel opslaan. Staan ze
 * er allebei, dan gaat de koppeling op "Gekoppeld (API)" en kan er opgehaald
 * worden; leeg maken zet 'm terug op handmatig/webhook.
 */
export async function connectApi(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const target = back(formData, "/vacaturehub/koppelingen");
  if (!id) redirect(target);

  const current = await db.vmsConnector.findUnique({ where: { id } });
  if (!current) redirect(target);

  const apiBaseUrl = String(formData.get("apiBaseUrl") ?? "").trim();
  const typedKey = String(formData.get("apiKey") ?? "").trim();
  const clear = String(formData.get("clearKey") ?? "") === "on";
  // Leeg gelaten = huidige sleutel behouden (die tonen we nooit terug).
  const apiKey = clear ? null : typedKey || current.apiKey;

  if (apiBaseUrl && !/^https:\/\//i.test(apiBaseUrl)) {
    redirect(withQuery(target, { conn: "url" }));
  }

  await db.vmsConnector.update({
    where: { id },
    data: {
      apiBaseUrl: apiBaseUrl || null,
      apiKey,
      status: apiBaseUrl && apiKey ? "CONNECTED" : "MANUAL",
    },
  });

  revalidate();
  revalidatePath("/connectors");
  redirect(withQuery(target, { conn: apiBaseUrl && apiKey ? "ok" : "saved" }));
}

/** Markeer één melding als gelezen. */
export async function markAlertRead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.recruiterAlert.update({ where: { id }, data: { read: true } });
  revalidate();
}

/** Markeer alle meldingen als gelezen. */
export async function markAllAlertsRead() {
  await db.recruiterAlert.updateMany({ where: { read: false }, data: { read: true } });
  revalidate();
}
