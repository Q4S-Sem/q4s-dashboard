"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { CRM_NOTE_TYPE_VALUES } from "@/lib/domain";

/** Alleen interne paden toestaan voor revalidatie. */
function safePath(p: string): string {
  return p.startsWith("/") && !p.startsWith("//") ? p : "/";
}

/** Leg een notitie (LOG) of een geplande taak (TODO, als er een datum is) vast. */
export async function addActivity(formData: FormData) {
  const entityType = String(formData.get("entityType") ?? "").trim();
  const entityId = String(formData.get("entityId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const path = safePath(String(formData.get("path") ?? "/"));
  if (!entityType || !entityId || !body) {
    revalidatePath(path);
    return;
  }
  const typeRaw = String(formData.get("type") ?? "NOTE");
  const type = (CRM_NOTE_TYPE_VALUES as readonly string[]).includes(typeRaw) ? typeRaw : "NOTE";
  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  const dueAt = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? new Date(`${dueRaw}T09:00:00`) : null;

  const user = await currentUser();
  await db.activity.create({
    data: {
      entityType,
      entityId,
      kind: dueAt ? "TODO" : "LOG",
      type,
      body,
      dueAt,
      authorId: user?.id ?? null,
    },
  });
  revalidatePath(path);
}

export async function completeActivity(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const path = safePath(String(formData.get("path") ?? "/"));
  if (id) await db.activity.update({ where: { id }, data: { done: true, doneAt: new Date() } });
  revalidatePath(path);
}

export async function reopenActivity(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const path = safePath(String(formData.get("path") ?? "/"));
  if (id) await db.activity.update({ where: { id }, data: { done: false, doneAt: null } });
  revalidatePath(path);
}

export async function deleteActivity(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const path = safePath(String(formData.get("path") ?? "/"));
  if (id) await db.activity.delete({ where: { id } });
  revalidatePath(path);
}
