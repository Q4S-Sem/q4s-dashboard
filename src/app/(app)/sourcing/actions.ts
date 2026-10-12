"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runDailySync } from "@/lib/sync";

/** Manually trigger the daily sourcing/filter/match job from the UI. */
export async function runSyncNow(formData?: FormData) {
  const run = await runDailySync("MANUAL");
  const back = String(formData?.get("back") ?? "");
  revalidatePath("/sourcing");
  revalidatePath("/vacaturehub");
  revalidatePath("/recruitment");
  if (back === "/vacaturehub") redirect(`/vacaturehub?gezocht=${run.sourced}`);
  redirect(`/sourcing?ran=${run.id}`);
}
