"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runDailySync } from "@/lib/sync";

/** Manually trigger the daily sourcing/filter/match job from the UI. */
export async function runSyncNow() {
  const run = await runDailySync("MANUAL");
  revalidatePath("/sourcing");
  revalidatePath("/vacaturehub");
  revalidatePath("/recruitment");
  redirect(`/sourcing?ran=${run.id}`);
}
