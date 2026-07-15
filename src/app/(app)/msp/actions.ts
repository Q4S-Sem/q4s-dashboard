"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  simulateMspDelivery,
  runIntakePipeline,
  pullConnector,
  PROCESSABLE_VACANCY_WHERE,
  type PipelineResult,
} from "@/lib/msp";

const QUEUE_CAP = 5;

function countFailed(results: PipelineResult[]): number {
  return results.reduce((n, r) => n + r.steps.filter((s) => s.status === "failed").length, 0);
}

/** Draai een gesimuleerde Magnit-levering door de volledige pijplijn (demo). */
export async function simulateDelivery() {
  const r = await simulateMspDelivery("magnit");
  const relevant = r.results.filter((x) => x.relevant === true).length;
  const failed = countFailed(r.results);
  revalidatePath("/msp");
  revalidatePath("/", "layout");
  redirect(`/msp?sim=${r.created}&skipped=${r.skipped}&rel=${relevant}&failed=${failed}`);
}

/** Verwerk één vacature door de intake-pijplijn (knop in de werkbank). */
export async function processOne(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const r = await runIntakePipeline(id);
  const failed = r.steps.filter((s) => s.status === "failed").length;
  revalidatePath("/msp");
  revalidatePath("/", "layout");
  const rel = r.relevant === true ? "1" : r.relevant === false ? "0" : "";
  redirect(`/msp?done=1&rel=${rel}&matches=${r.matchCount}&best=${r.bestScorePct ?? ""}&failed=${failed}`);
}

/** Verwerk een batch onbeoordeelde VMS-vacatures (zelfde patroon als de Vacaturehub). */
export async function processQueue() {
  const pending = await db.vacancy.findMany({
    where: PROCESSABLE_VACANCY_WHERE,
    orderBy: { createdAt: "asc" },
    take: QUEUE_CAP,
    select: { id: true },
  });
  const results: PipelineResult[] = [];
  for (const v of pending) results.push(await runIntakePipeline(v.id));
  const relevant = results.filter((r) => r.relevant === true).length;
  const failed = countFailed(results);
  const remaining = await db.vacancy.count({ where: PROCESSABLE_VACANCY_WHERE });
  revalidatePath("/msp");
  revalidatePath("/", "layout");
  redirect(`/msp?batch=${pending.length}&rel=${relevant}&remaining=${remaining}&failed=${failed}`);
}

/** Haal nu op via de API van een connector (werkt zodra key + URL zijn ingesteld). */
export async function pullNow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const r = await pullConnector(id);
  revalidatePath("/msp");
  revalidatePath("/", "layout");
  if (!r) redirect("/msp?pull=no-config");
  if (!r.ok) redirect(`/msp?pull=error&msg=${encodeURIComponent(r.error ?? "onbekende fout")}`);
  redirect(`/msp?pull=ok&received=${r.received}&created=${r.created}`);
}

/** Markeer één melding als gelezen. */
export async function markAlertRead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.recruiterAlert.update({ where: { id }, data: { read: true } });
  revalidatePath("/msp");
  revalidatePath("/", "layout");
}

/** Markeer alle meldingen als gelezen. */
export async function markAllAlertsRead() {
  await db.recruiterAlert.updateMany({ where: { read: false }, data: { read: true } });
  revalidatePath("/msp");
  revalidatePath("/", "layout");
}
