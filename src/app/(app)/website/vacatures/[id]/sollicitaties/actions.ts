"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { APPLICATION_STATUS_VALUES } from "@/lib/domain";
import { createSuccessPostForPlacement } from "@/lib/socials";

/**
 * Zet de status van een sollicitatie en keer terug naar de sollicitaties-pagina
 * van de vacature (de beheerweergave in de Vacatures-hub).
 */
export async function setVacancyApplicationStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !vacancyId) redirect("/website");
  if (!APPLICATION_STATUS_VALUES.includes(status)) {
    redirect(`/website/vacatures/${vacancyId}/sollicitaties?error=status`);
  }

  const prev = await db.application.findUnique({
    where: { id },
    select: { status: true },
  });
  await db.application.update({ where: { id }, data: { status } });

  // Verse plaatsing → concept-succespost (best-effort, blokkeert nooit).
  if (status === "PLACED" && prev?.status !== "PLACED") {
    await createSuccessPostForPlacement(id).catch(() => {});
    revalidatePath("/posts");
    revalidatePath("/socials");
  }

  revalidatePath(`/website/vacatures/${vacancyId}/sollicitaties`);
  revalidatePath("/sollicitaties");
  redirect(`/website/vacatures/${vacancyId}/sollicitaties`);
}
