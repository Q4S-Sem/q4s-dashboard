"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { processAllPending, processConsultant } from "@/lib/facturatie";
import { notifyPendingApprovals } from "@/lib/approval-notify";

/** Batch: genereer inkoop- én verkoopfacturen voor iedereen met openstaand werk. */
export async function processAll() {
  const res = await processAllPending();
  // Concept-verkoopfacturen aangemaakt → seintje naar Outlook ter goedkeuring.
  if (res.verkoop > 0) {
    try {
      await notifyPendingApprovals();
    } catch {
      // best-effort — een mailfout mag de verwerking nooit blokkeren
    }
  }
  revalidatePath("/verwerken");
  revalidatePath("/verwerken/archief");
  revalidatePath("/facturen");
  revalidatePath("/inkoopfacturen");
  revalidatePath("/verzenden");
  revalidatePath("/", "layout");
  redirect(
    `/verwerken?batch=1&inkoop=${res.inkoop}&verkoop=${res.verkoop}&appr=${res.skippedApproval}&err=${res.errors.length}`,
  );
}

function revalidateVerwerken(consultantId: string) {
  revalidatePath("/inkoopfacturen");
  revalidatePath("/facturen");
  revalidatePath("/verwerken");
  revalidatePath(`/verwerken/${consultantId}`);
  revalidatePath("/verzenden");
  revalidatePath("/", "layout");
}

/**
 * Gedeelde verwerk-helper. `okFlag` bepaalt de terugkoppeling: "alles" → done-view,
 * "inkoop"/"verkoop" → overzicht met succesbanner (de andere soort blijft dan open).
 */
async function runProcess(
  formData: FormData,
  opts: { inkoop?: boolean; verkoop?: boolean },
  okFlag: "alles" | "inkoop" | "verkoop",
) {
  const consultantId = String(formData.get("consultantId") ?? "");
  if (!consultantId) redirect("/verwerken");

  const res = await processConsultant(consultantId, opts);
  if (res && res.verkoop > 0) {
    try {
      await notifyPendingApprovals();
    } catch {
      // best-effort — mailfout mag de verwerking niet blokkeren
    }
  }
  revalidateVerwerken(consultantId);

  if (!res) redirect("/verwerken");
  const params = new URLSearchParams({
    inkoop: String(res.inkoop),
    verkoop: String(res.verkoop),
    appr: String(res.approved),
    err: String(res.errors.length),
  });
  if (okFlag === "alles") params.set("done", "1");
  else params.set("ok", okFlag);
  redirect(`/verwerken/${consultantId}?${params.toString()}`);
}

/** Eén klik: verwerk volledig — goedkeuren + inkoop + verkoop. */
export async function processConsultantFlow(formData: FormData) {
  await runProcess(formData, {}, "alles");
}

/** Alleen de inkoopfactuur maken (uren worden wel goedgekeurd). */
export async function processConsultantInkoop(formData: FormData) {
  await runProcess(formData, { inkoop: true, verkoop: false }, "inkoop");
}

/** Alleen de verkoopfactu(u)r(en) maken (uren worden wel goedgekeurd). */
export async function processConsultantVerkoop(formData: FormData) {
  await runProcess(formData, { inkoop: false, verkoop: true }, "verkoop");
}
