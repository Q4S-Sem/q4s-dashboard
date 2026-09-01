"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { confirmInboxItem } from "@/lib/inbox-confirm";
import { createSalesInvoice } from "@/lib/invoicing";
import { timesheetGateReview } from "@/lib/timesheet-gate-review";
import { weekParam } from "@/lib/timesheets";
import { groupVerkoopByClient, type VerkoopbareWeek } from "@/lib/verkoop-groepering";

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

// ---------------------------------------------------------------------------
// "Verwerk alles groen" — dezelfde goedkeuring als hierboven, maar dan helemaal
// doorgetrokken: elke weekstaat die de auto-gate schoon doorkomt wordt een echte
// urenstaat én belandt meteen op een CONCEPT-verkoopfactuur per klant.
//
// Wat hier bewust NIET gebeurt:
// - niets versturen: de factuur blijft DRAFT, verzenden doet een mens (/verzenden);
// - nooit op betaald zetten of betalen;
// - de INKOOP-kant blijft ongemoeid — die loopt gewoon via /verwerken.
//
// Veiligheid: de lijst met groene weken wordt HIER opnieuw op de server bepaald
// (het scherm telt niet mee), er wordt alleen bevestigd wat nog écht openstaat
// (requirePending) en er wordt alleen gefactureerd wat we in deze ronde zelf
// hebben aangemaakt én wat nog op geen enkele verkoopfactuur staat. Twee keer
// klikken maakt dus geen tweede factuur.
//
// Het factuurrekenwerk zit volledig in createSalesInvoice (src/lib/invoicing.ts);
// hier wordt alleen bepaald welke urenstaten samen op één factuur horen
// (src/lib/verkoop-groepering.ts).
// ---------------------------------------------------------------------------

export type AutoProcessSummary = {
  /** Inbox-items die een echte (goedgekeurde) urenstaat zijn geworden. */
  approved: number;
  /** Aangemaakte CONCEPT-verkoopfacturen (één per klant). */
  invoicesCreated: number;
  /** Overgeslagen: intussen al verwerkt, niet compleet, of niet te factureren. */
  skipped: number;
  errors: string[];
};

export async function processAutoApprovedToConcept(): Promise<AutoProcessSummary> {
  // 1) Gate vers draaien op de server — nooit vertrouwen op wat de browser stuurt.
  const { autoApprove } = await timesheetGateReview();

  let approved = 0;
  let skipped = 0;
  const errors: string[] = [];
  const timesheetIds: string[] = [];

  // 2) Bevestigen: van uitgelezen weekstaat naar echte urenstaat (APPROVED).
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
      timesheetIds.push(result.timesheetId);
    } else if (result.error === "state" || result.error === "missing" || result.error === "exists") {
      // Niets misgegaan: er was al een urenstaat, of het item is intussen weg.
      skipped++;
    } else {
      errors.push(`${row.name}: weekstaat niet bevestigd (${result.error}).`);
    }
  }

  // 3) Factureren: alleen de urenstaten die we zojuist zelf hebben aangemaakt, en
  //    dan nog eens uit de DB gecontroleerd op status en bestaande factuurregel.
  let invoicesCreated = 0;
  if (timesheetIds.length > 0) {
    const fresh = await db.timesheet.findMany({
      where: { id: { in: timesheetIds } },
      select: {
        id: true,
        status: true,
        invoiceLine: { select: { id: true } },
        placement: {
          select: { clientId: true, client: { select: { companyName: true } } },
        },
      },
    });

    const weeks: VerkoopbareWeek[] = fresh.map((t) => ({
      timesheetId: t.id,
      status: t.status,
      hasSales: !!t.invoiceLine,
      clientId: t.placement.clientId,
      clientName: t.placement.client?.companyName ?? null,
    }));

    const { groups, skipped: notInvoiceable } = groupVerkoopByClient(weeks);
    // Urenstaat aangemaakt maar (nog) niet te factureren — bijv. een plaatsing
    // zonder gekoppeld bedrijf. De uren staan er wel; factureren blijft handwerk.
    skipped += notInvoiceable;

    for (const group of groups) {
      // Eén factuur die faalt mag de rest niet wegvagen (elke factuur is atomair
      // in invoicing.ts), maar een echte DB-fout WERPT — vang die af en ga door.
      try {
        const res = await createSalesInvoice({
          clientId: group.clientId,
          timesheetIds: group.timesheetIds,
          issueDate: new Date(),
          notes: null,
        });
        if (res.ok) invoicesCreated++;
        else errors.push(`Verkoopfactuur → ${group.clientName}: ${res.error}`);
      } catch (e) {
        errors.push(
          `Verkoopfactuur → ${group.clientName}: ${e instanceof Error ? e.message : "onbekende fout"}`,
        );
      }
    }
  }

  revalidatePath("/verwerken/controle");
  revalidatePath("/verwerken");
  revalidatePath("/inbox");
  revalidatePath("/uren");
  revalidatePath("/facturen");
  revalidatePath("/verzenden");
  revalidatePath("/", "layout");

  return { approved, invoicesCreated, skipped, errors };
}

/**
 * Knop-variant van {@link processAutoApprovedToConcept}: draait dezelfde stappen
 * en stuurt de teller-uitkomst terug naar het controlescherm.
 */
export async function processAllAutoApproved(_formData: FormData) {
  const { approved, invoicesCreated, skipped, errors } = await processAutoApprovedToConcept();
  redirect(
    `/verwerken/controle?goedgekeurd=${approved}&facturen=${invoicesCreated}&overgeslagen=${skipped}&mislukt=${errors.length}`,
  );
}
