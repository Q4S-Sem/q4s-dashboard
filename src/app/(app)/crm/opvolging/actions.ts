"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentRecruiterId, logNote } from "@/lib/crm";

/** Rond een opvolging af, ongeacht of hij op een deal of op een notitie staat. */
export async function completeFollowUp(formData: FormData) {
  const source = String(formData.get("source") ?? "");
  const id = String(formData.get("rawId") ?? "");
  if (!id) return;

  if (source === "deal") {
    const recruiterId = await currentRecruiterId();
    await db.deal.update({ where: { id }, data: { nextFollowUpAt: null } });
    await logNote({ type: "SYSTEM", dealId: id, authorId: recruiterId, body: "Opvolging afgerond." });
    revalidatePath(`/crm/deals/${id}`);
  } else if (source === "note") {
    await db.crmNote.update({ where: { id }, data: { followUpDone: true } });
  }

  revalidatePath("/crm/opvolging");
  revalidatePath("/crm");
}

/** Vink een taak af (Admin. Tasks). */
export async function completeTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.task.update({ where: { id }, data: { done: true, doneAt: new Date() } });
  revalidatePath("/crm/opvolging");
  revalidatePath("/agenda/taken");
}
