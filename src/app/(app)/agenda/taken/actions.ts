"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TASK_PRIORITY_VALUES } from "@/lib/domain";

function revalidate() {
  revalidatePath("/agenda/taken");
  revalidatePath("/agenda");
}

/**
 * Only allow a same-origin internal path as a redirect target. Resolving against
 * a dummy origin rejects protocol-relative ("//evil.com") and backslash
 * ("/\\evil.com") payloads that would otherwise pass a naive startsWith("/").
 */
function safeInternalPath(raw: string, fallback = "/agenda/taken"): string {
  try {
    const u = new URL(raw, "http://x.invalid");
    return u.origin === "http://x.invalid" ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) redirect("/agenda/taken");

  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const notes = String(formData.get("notes") ?? "").trim();

  await db.task.create({
    data: {
      title,
      dueDate: dueRaw ? new Date(dueRaw) : null,
      priority: TASK_PRIORITY_VALUES.includes(priority) ? priority : "MEDIUM",
      notes: notes || null,
    },
  });

  revalidate();
  redirect("/agenda/taken");
}

/** Flip a task done/undone. `redirectTo` lets the agenda side-panel toggle in place. */
export async function toggleTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const redirectTo = safeInternalPath(
    String(formData.get("redirectTo") ?? "/agenda/taken"),
  );

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return;

  await db.task.update({
    where: { id },
    data: { done: !task.done, doneAt: !task.done ? new Date() : null },
  });

  revalidate();
  redirect(redirectTo);
}

export async function deleteTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.task.delete({ where: { id } });
  revalidate();
  redirect("/agenda/taken");
}
