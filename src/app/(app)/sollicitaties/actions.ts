"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { APPLICATION_STATUS_VALUES } from "@/lib/domain";
import { createSuccessPostForPlacement } from "@/lib/socials";

// Move an application to an explicit status from the workflow buttons.
export async function setApplicationStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const status = String(formData.get("status") ?? "");
  if (!APPLICATION_STATUS_VALUES.includes(status)) {
    redirect(`/sollicitaties/${id}?error=status`);
  }

  const prev = await db.application.findUnique({
    where: { id },
    select: { status: true },
  });
  await db.application.update({ where: { id }, data: { status } });

  // Proof loop: a fresh placement drafts an anonymous success post (best-effort,
  // never blocks). Only on the transition INTO placed, so re-saves don't spam.
  if (status === "PLACED" && prev?.status !== "PLACED") {
    await createSuccessPostForPlacement(id);
    revalidatePath("/posts");
    revalidatePath("/socials");
  }

  revalidatePath("/sollicitaties");
  revalidatePath(`/sollicitaties/${id}`);
  redirect(`/sollicitaties/${id}`);
}

// Propose a candidate to an opdrachtgever (TargetClient).
export async function submitApplication(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const submittedToId = String(formData.get("submittedToId") ?? "");
  if (!submittedToId) {
    redirect(`/sollicitaties/${id}?error=opdrachtgever`);
  }

  await db.application.update({
    where: { id },
    data: {
      submittedToId,
      submittedAt: new Date(),
      status: "PROPOSED",
    },
  });
  revalidatePath("/sollicitaties");
  revalidatePath(`/sollicitaties/${id}`);
  redirect(`/sollicitaties/${id}`);
}

// Re-open a closed application back to the start of the pipeline.
export async function reopenApplication(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.application.update({ where: { id }, data: { status: "NEW" } });
  revalidatePath("/sollicitaties");
  revalidatePath(`/sollicitaties/${id}`);
  redirect(`/sollicitaties/${id}`);
}

export async function deleteApplication(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.application.delete({ where: { id } });
  } catch {
    redirect(`/sollicitaties/${id}?error=in-use`);
  }
  revalidatePath("/sollicitaties");
  redirect("/sollicitaties");
}
