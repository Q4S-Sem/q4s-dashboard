"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { APPLICATION_STATUS_VALUES } from "@/lib/domain";
import { createSuccessPostForPlacement } from "@/lib/socials";

/**
 * Sollicitaties zijn op twee plekken zichtbaar: /sollicitaties (Recruitment)
 * en /website/sollicitaties (Website). Elk formulier stuurt zijn `base` mee
 * zodat je na een actie in dezelfde werkplek blijft.
 */
function baseOf(formData: FormData): string {
  const base = String(formData.get("base") ?? "");
  return base === "/website/sollicitaties" ? base : "/sollicitaties";
}

function revalidateBoth(id?: string) {
  for (const b of ["/sollicitaties", "/website/sollicitaties"]) {
    revalidatePath(b);
    if (id) revalidatePath(`${b}/${id}`);
  }
}

// Move an application to an explicit status from the workflow buttons.
export async function setApplicationStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const base = baseOf(formData);

  const status = String(formData.get("status") ?? "");
  if (!APPLICATION_STATUS_VALUES.includes(status)) {
    redirect(`${base}/${id}?error=status`);
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

  revalidateBoth(id);
  redirect(`${base}/${id}`);
}

// Propose a candidate to an opdrachtgever (TargetClient).
export async function submitApplication(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const base = baseOf(formData);

  const submittedToId = String(formData.get("submittedToId") ?? "");
  if (!submittedToId) {
    redirect(`${base}/${id}?error=opdrachtgever`);
  }

  await db.application.update({
    where: { id },
    data: {
      submittedToId,
      submittedAt: new Date(),
      status: "PROPOSED",
    },
  });
  revalidateBoth(id);
  redirect(`${base}/${id}`);
}

// Re-open a closed application back to the start of the pipeline.
export async function reopenApplication(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const base = baseOf(formData);
  await db.application.update({ where: { id }, data: { status: "NEW" } });
  revalidateBoth(id);
  redirect(`${base}/${id}`);
}

export async function deleteApplication(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const base = baseOf(formData);
  try {
    await db.application.delete({ where: { id } });
  } catch {
    redirect(`${base}/${id}?error=in-use`);
  }
  revalidateBoth();
  redirect(base);
}
