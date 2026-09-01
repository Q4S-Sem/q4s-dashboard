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
// - GEEN inkoopfactuur. Elke ZZP'er stuurt zijn EIGEN factuur; die ontvangen
//   factuur (ReceivedInvoice) ís de inkoop. Q4S maakt er dus geen tweede,
//   zelf-gefactureerde inkoopfactuur naast — de ontvangen factuur wordt alleen
//   gecontroleerd/gematcht bij Ontvangen facturen (uren × inkooptarief);
// - niets versturen: de verkoopfactuur blijft DRAFT, verzenden doet een mens
//   (/verzenden);
// - nooit op betaald zetten of betalen.
//
// Veiligheid: de lijst met groene weken wordt HIER opnieuw op de server bepaald
// (het scherm telt niet mee), er wordt alleen bevestigd wat nog écht openstaat
// (requirePending) en er wordt alleen gefactureerd wat we in deze ronde zelf
// hebben aangemaakt én wat nog op geen enkele verkoopfactuur staat. Twee keer
// klikken maakt dus geen tweede factuur.
//
// Het factuurrekenwerk zit volledig in createSalesInvoice (src/lib/invoicing.ts)
// — hier wordt geen cent gerekend; alleen bepaald welke urenstaten samen op één
// factuur horen (src/lib/verkoop-groepering.ts).
// ---------------------------------------------------------------------------

export type AutoProcessSummary = {
  /** Inbox-items die een echte (goedgekeurde) urenstaat zijn geworden. */
  approved: number;
  /** Aangemaakte CONCEPT-verkoopfacturen (één per klant). */
  verkoopInvoices: number;
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

  // 3) Factureren: alleen de VERKOOP, en alleen voor de urenstaten die we zojuist
  //    zelf hebben aangemaakt — dan nog eens uit de DB gecontroleerd op status en
  //    een bestaande factuurregel. De inkoop komt niet van ons: dat is de factuur
  //    die de ZZP'er zelf stuurt (Ontvangen facturen).
  let verkoopInvoices = 0;
  if (timesheetIds.length > 0) {
    const fresh = await db.timesheet.findMany({
      where: { id: { in: timesheetIds } },
      select: {
        id: true,
        status: true,
        invoiceLine: { select: { id: true } },
        placement: {
          select: {
            clientId: true,
            client: { select: { companyName: true } },
          },
        },
      },
    });

    // Verkoop per klant.
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
      try {
        const res = await createSalesInvoice({
          clientId: group.clientId,
          timesheetIds: group.timesheetIds,
          issueDate: new Date(),
          notes: null,
        });
        if (res.ok) verkoopInvoices++;
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

  return { approved, verkoopInvoices, skipped, errors };
}

/**
 * Knop-variant van {@link processAutoApprovedToConcept}: draait dezelfde stappen
 * en stuurt de teller-uitkomst terug naar het controlescherm.
 */
export async function processAllAutoApproved(_formData: FormData) {
  const { approved, verkoopInvoices, skipped, errors } = await processAutoApprovedToConcept();
  redirect(
    `/verwerken/controle?goedgekeurd=${approved}&facturen=${verkoopInvoices}&overgeslagen=${skipped}&mislukt=${errors.length}`,
  );
}

// ---------------------------------------------------------------------------
// De wachtkamer — een weekstaat die niet klopt even parkeren.
//
// Parkeren verandert NIETS aan de weekstaat zelf: de status blijft EXTRACTED en
// er wordt niets goedgekeurd, afgewezen, gefactureerd of verstuurd. Het enige
// wat er gebeurt is dat de week van het weekoverzicht verdwijnt en in de
// wachtkamer komt te staan, tot de freelancer een gecorrigeerde staat of factuur
// stuurt. Dat nieuwe document is een nieuw inbox-item en komt dus vanzelf weer op
// het overzicht; deze geparkeerde week blijft staan tot iemand hem bevestigt,
// afwijst of hier terugzet.
// ---------------------------------------------------------------------------

/** Zo lang mag de bewaarde reden zijn — het is een regeltje, geen verhaal. */
const MAX_REASON = 300;

/** Alle schermen die een geparkeerde week laten zien, in één keer bijwerken. */
function revalidateWachtkamer(id: string) {
  revalidatePath("/verwerken/wachtkamer");
  revalidatePath("/verwerken/week");
  revalidatePath("/verwerken/controle");
  revalidatePath(`/inbox/${id}`);
  revalidatePath("/inbox");
}

/**
 * Parkeer één uitgelezen weekstaat in de wachtkamer, met de controlereden erbij.
 *
 * Bewust `updateMany` met een voorwaarde: alleen wat nog écht openstaat
 * (EXTRACTED, nog geen urenstaat) wordt geparkeerd. Is het item intussen
 * bevestigd, afgewezen of weg, dan gebeurt er simpelweg niets — geen fout, geen
 * halve wijziging.
 */
export async function parkeerInWachtkamer(inboxId: string, reason: string) {
  const id = String(inboxId ?? "").trim();
  if (!id) return;

  const reden = String(reason ?? "")
    .trim()
    .slice(0, MAX_REASON);

  await db.timesheetInbox.updateMany({
    where: { id, status: "EXTRACTED", timesheetId: null },
    data: { wachtkamerSince: new Date(), wachtkamerReason: reden || null },
  });

  revalidateWachtkamer(id);
}

/** Knop-variant: parkeren vanaf het weekoverzicht en meteen naar de wachtkamer. */
export async function naarWachtkamer(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await parkeerInWachtkamer(id, String(formData.get("reason") ?? ""));
  redirect("/verwerken/wachtkamer");
}

/**
 * Haal een week weer uit de wachtkamer: hij staat daarna gewoon weer tussen de te
 * controleren weken. Ook dit raakt de status niet aan.
 */
export async function uitWachtkamer(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await db.timesheetInbox.updateMany({
    where: { id },
    data: { wachtkamerSince: null, wachtkamerReason: null },
  });

  revalidateWachtkamer(id);
  redirect("/verwerken/week");
}
