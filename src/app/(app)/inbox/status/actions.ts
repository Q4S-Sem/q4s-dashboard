"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseWeekParam, timesheetWeekStatus, sendTimesheetReminder } from "@/lib/timesheets";
import { getCompanySettings } from "@/lib/settings";

// Begrens de bulk-verzending per request (SMTP sequentieel → anders timeout).
const REMIND_CAP = 50;

/** Stuur één medewerker een herinnering dat de weekstaat nog ontbreekt. */
export async function remindOne(formData: FormData) {
  const consultantId = String(formData.get("consultantId") ?? "");
  const week = String(formData.get("week") ?? "");
  const placementId = String(formData.get("placementId") ?? "") || null;
  if (!consultantId || !week) return;

  const monday = parseWeekParam(week);
  const res = await sendTimesheetReminder(consultantId, monday, placementId);

  revalidatePath("/inbox/status");
  revalidatePath("/", "layout");
  const r = res.noEmail ? "no-email" : res.ok ? (res.simulated ? "reminded-sim" : "reminded") : "error";
  redirect(`/inbox/status?week=${week}&r=${r}`);
}

/** Herinner in één keer iedereen die deze week nog ontbreekt (nog niet herinnerd). */
export async function remindAllMissing(formData: FormData) {
  const week = String(formData.get("week") ?? "");
  if (!week) return;

  const monday = parseWeekParam(week);
  const status = await timesheetWeekStatus(monday);
  const missing = status.rows.filter((r) => r.presence === "MISSING");
  const settings = await getCompanySettings();

  const seen = new Set<string>();
  let sent = 0;
  let noEmail = 0;
  let sim = 0;
  let capped = 0;
  for (const row of missing) {
    if (seen.has(row.consultantId)) continue;
    seen.add(row.consultantId);
    if (seen.size > REMIND_CAP) {
      capped++;
      continue;
    }
    const res = await sendTimesheetReminder(row.consultantId, monday, row.placementId, settings);
    if (res.noEmail) noEmail++;
    else if (res.ok) {
      sent++;
      if (res.simulated) sim++;
    }
  }

  revalidatePath("/inbox/status");
  revalidatePath("/", "layout");
  redirect(`/inbox/status?week=${week}&sent=${sent}&noEmail=${noEmail}&sim=${sim}&capped=${capped}`);
}
