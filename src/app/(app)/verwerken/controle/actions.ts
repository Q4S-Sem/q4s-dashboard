"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { confirmInboxItem } from "@/lib/inbox-confirm";
import { timesheetGateReview } from "@/lib/timesheet-gate-review";
import { weekParam } from "@/lib/timesheets";

// ---------------------------------------------------------------------------
// "Keur alle groene goed" — alle weekstaten die de auto-gate zonder opmerkingen
// doorlaat (AUTO_APPROVE) in één klik omzetten in echte urenstaten.
//
// De lijst wordt hier OPNIEUW op de server bepaald: wat de browser meestuurt
// telt niet mee. Alleen wat op dít moment nog AUTO_APPROVE is gaat door;
// twijfelgevallen (NEEDS_REVIEW) blijven onaangeroerd.
//
// Er wordt niets verstuurd en er worden geen facturen gemaakt — factureren is en
// blijft een aparte stap bij /verwerken.
// ---------------------------------------------------------------------------

export async function approveAllAutoApproved(_formData: FormData) {
  // Vers ophalen: de gate opnieuw draaien, niet vertrouwen op het scherm.
  const { autoApprove } = await timesheetGateReview();

  let approved = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of autoApprove) {
    // Onvolledig (geen plaatsing, week of dag-uren) → laat staan voor een mens.
    if (!row.canApprove) {
      skipped++;
      continue;
    }

    const result = await confirmInboxItem({
      id: row.id,
      // Ondertussen al bevestigd of afgewezen? Dan overslaan, niet dubbel doen.
      requirePending: true,
      placementId: row.placementId,
      weekStart: row.weekStart ? weekParam(row.weekStart) : "",
      kilometers: row.kilometers,
      overtimeHours: row.overtimeHours,
      hours: row.dayHours,
    });

    if (result.ok) {
      approved++;
    } else if (result.error === "state" || result.error === "missing" || result.error === "exists") {
      // Niets misgegaan: er was al een urenstaat, of het item is intussen weg.
      skipped++;
    } else {
      failed++;
    }
  }

  revalidatePath("/verwerken/controle");
  revalidatePath("/inbox");
  revalidatePath("/uren");
  revalidatePath("/", "layout");
  redirect(
    `/verwerken/controle?goedgekeurd=${approved}&overgeslagen=${skipped}&mislukt=${failed}`,
  );
}
