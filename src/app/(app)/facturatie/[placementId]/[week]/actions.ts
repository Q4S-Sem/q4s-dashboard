"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { akkoordWeek } from "@/lib/facturatie-akkoord";
import {
  ACCEPT_KEY,
  ACK_PREFIX,
  FACTURATIE_ENTITY,
  getWeekDossier,
  getWeekOverview,
  resolveWeek,
  weekEntityId,
} from "@/lib/facturatie-week";
import { deleteInboxUpload, deleteReceivedUpload } from "@/lib/uploads";
import { resetWeekForReceivedInvoice, resetWeekForTimesheet } from "@/lib/week-reset";
import { currentUser } from "@/lib/session";
import { volgendePersoon, wekenInPeriode } from "@/lib/facturatie-volgende";

// ---------------------------------------------------------------------------
// De acties van het dossier (/facturatie/[placementId]/[week]).
//
// Alles hier is MENSENWERK met een expliciete knop. Er wordt niets automatisch
// gemaild, goedgekeurd of betaald, en geen enkele status verandert zonder dat
// iemand erop klikt.
//
// De zware actie — "Akkoord → verkoopfactuur" — doet dit bestand zelf niet: die
// loopt via `akkoordWeek` (src/lib/facturatie-akkoord.ts), dat de controle
// SERVER-SIDE opnieuw draait en de bestaande functies gebruikt (confirmInboxItem,
// createSalesInvoice). Zo kan de browser nooit een week groen praten.
// ---------------------------------------------------------------------------

/** Zo lang mag een reden/aantekening zijn: een alinea, geen brief. */
const MAX_REDEN = 2000;

function tekst(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** "YYYY-MM-DD" → Date (lokale middernacht); alles anders → null. */
function parseDatum(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "8,5" / "3.146,00" → number; leeg of onleesbaar → null. */
function parseGetal(value: string): number | null {
  const s = value.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function dossierPad(placementId: string, weekKey: string, params?: Record<string, string>): string {
  // Zonder plaatsing bestaat er geen dossier — dan terug naar het weekoverzicht
  // in plaats van naar een pad met een leeg segment ("/facturatie//2026-W40").
  if (!placementId) return `/facturatie?week=${weekKey}`;
  const qs = new URLSearchParams(params ?? {}).toString();
  return `/facturatie/${placementId}/${weekKey}${qs ? `?${qs}` : ""}`;
}

function herlaad(placementId: string, weekKey: string) {
  revalidatePath(`/facturatie/${placementId}/${weekKey}`);
  revalidatePath("/facturatie");
  revalidatePath("/", "layout");
}

/** De sleutels van een actie: plaatsing + week, altijd via resolveWeek genormaliseerd. */
function sleutels(formData: FormData): { placementId: string; weekKey: string } {
  return {
    placementId: tekst(formData, "placementId"),
    weekKey: resolveWeek(tekst(formData, "week"), new Date()).key,
  };
}

// ===========================================================================
// Uitgelezen waarden corrigeren
// ===========================================================================

export type CorrectieState = { melding?: string; error?: string };

/**
 * Bewaar de uren per dag en de factuurvelden zoals de mens ze nu op het scherm
 * heeft staan, en laat de controle daarna opnieuw draaien (de pagina rendert
 * vers). De uren gaan naar `TimesheetInbox.draftJson` — hetzelfde vangnet dat de
 * bestaande wizard gebruikt, dus `confirmInboxItem` ruimt het straks zelf op.
 *
 * Dit is GEEN akkoord: er wordt geen urenstaat vastgelegd, geen status verhoogd
 * en geen factuur gemaakt. Alleen de ontvangen factuur (status NEW) wordt
 * bijgewerkt met de gecorrigeerde gegevens — dat is zijn registratie, niet zijn
 * goedkeuring. Een al betaalde of goedgekeurde factuur blijft ongemoeid.
 */
export async function bewaarCorrecties(
  _prev: CorrectieState,
  formData: FormData,
): Promise<CorrectieState> {
  const { placementId, weekKey } = sleutels(formData);
  if (!placementId) return { error: "Onbekende plaatsing." };

  const dossier = await getWeekDossier(placementId, weekKey);
  if (!dossier) return { error: "Deze week is niet meer te vinden." };
  if (dossier.row.vastgelegd) {
    return {
      error:
        "De urenstaat van deze week is al vastgelegd — corrigeer de uren hierboven, of gebruik 'Verwijderen & opnieuw'.",
    };
  }

  const dagUren = [0, 1, 2, 3, 4, 5, 6].map((i) => tekst(formData, `uren_${i}`));
  const overuren = tekst(formData, "overuren");
  const kilometers = tekst(formData, "kilometers");

  if (dossier.row.inboxId) {
    // Exact dezelfde vorm als het concept-vangnet van de bestaande wizard
    // (weekStart als "YYYY-MM-DD"), zodat beide schermen hetzelfde concept lezen.
    const maandag = dossier.week.mondayParam;
    await db.timesheetInbox.updateMany({
      where: { id: dossier.row.inboxId, timesheetId: null, status: { in: ["NEW", "EXTRACTED"] } },
      data: {
        draftJson: JSON.stringify({
          dagUren,
          overuren,
          kilometers,
          placementId,
          weekStart: maandag,
        }),
      },
    });
  }

  if (dossier.row.receivedInvoiceId) {
    const inv = await db.receivedInvoice.findUnique({
      where: { id: dossier.row.receivedInvoiceId },
      select: { id: true, status: true, extractedJson: true },
    });
    if (inv && inv.status === "NEW") {
      const bedrag = parseGetal(tekst(formData, "factuurBedrag"));
      const btw = parseGetal(tekst(formData, "factuurBtw"));
      const km = parseGetal(tekst(formData, "factuurKilometers"));
      // De controlevelden leven in de JSON-kolom; alleen de drie die het scherm
      // laat corrigeren worden overschreven, de rest blijft zoals uitgelezen.
      let gelezen: Record<string, unknown> = {};
      try {
        gelezen = inv.extractedJson ? (JSON.parse(inv.extractedJson) as Record<string, unknown>) : {};
      } catch {
        gelezen = {};
      }
      gelezen.hours = parseGetal(tekst(formData, "factuurUren")) ?? 0;
      gelezen.hourlyRate = parseGetal(tekst(formData, "factuurTarief")) ?? 0;
      gelezen.overtimeHours = parseGetal(tekst(formData, "factuurOveruren")) ?? 0;

      await db.receivedInvoice.update({
        where: { id: inv.id },
        data: {
          number: tekst(formData, "factuurNummer") || null,
          issueDate: parseDatum(tekst(formData, "factuurDatum")),
          periodStart: parseDatum(tekst(formData, "factuurPeriodeStart")),
          periodEnd: parseDatum(tekst(formData, "factuurPeriodeEind")),
          amount: bedrag ?? 0,
          vatAmount: btw !== null && btw > 0 ? btw : null,
          kilometers: km !== null && km > 0 ? km : null,
          // Verzamelfactuur blijft over al zijn weken lopen (geen vaste week).
          weekKey:
            wekenInPeriode(tekst(formData, "factuurPeriodeStart"), tekst(formData, "factuurPeriodeEind")).length > 1
              ? null
              : weekKey,
          extractedJson: JSON.stringify(gelezen),
        },
      });
    }
  }

  herlaad(placementId, weekKey);
  return { melding: "De gegevens zijn bijgewerkt en de controles zijn opnieuw gedraaid." };
}

// ===========================================================================
// Akkoord op één waarschuwing
// ===========================================================================

/** Leg vast dat een mens deze waarschuwing gezien en goedgekeurd heeft. */
export async function akkoordControle(formData: FormData) {
  const { placementId, weekKey } = sleutels(formData);
  const checkId = tekst(formData, "checkId").slice(0, 80);
  const titel = tekst(formData, "titel").slice(0, 200);
  if (!placementId || !checkId) redirect(dossierPad(placementId, weekKey));

  const user = await currentUser();
  const entityId = weekEntityId(placementId, weekKey);
  const sourceKey = `${ACK_PREFIX}${checkId}`;
  const bestaand = await db.activity.findFirst({
    where: { entityType: FACTURATIE_ENTITY, entityId, sourceKey },
    select: { id: true },
  });
  if (!bestaand) {
    await db.activity.create({
      data: {
        entityType: FACTURATIE_ENTITY,
        entityId,
        kind: "LOG",
        type: "NOTE",
        body: `Akkoord gegeven op de waarschuwing: ${titel || checkId}`,
        sourceKey,
        authorId: user?.id ?? null,
      },
    });
  }

  herlaad(placementId, weekKey);
  redirect(dossierPad(placementId, weekKey));
}

// ===========================================================================
// "Toch accepteren" — fouten bewust aanvaarden, mét reden
// ===========================================================================

/**
 * Aanvaard de fouten van deze week bewust. De reden is VERPLICHT en wordt als
 * aantekening bij de week vastgelegd; de fouten blijven zichtbaar, maar
 * blokkeren het akkoord niet meer (`acceptedErrors` in de controle-machine).
 */
export async function accepteerFouten(formData: FormData) {
  const { placementId, weekKey } = sleutels(formData);
  const reden = tekst(formData, "reden").slice(0, MAX_REDEN);
  if (!placementId) redirect("/facturatie");
  if (!reden) redirect(dossierPad(placementId, weekKey, { fout: "reden" }));

  const user = await currentUser();
  const entityId = weekEntityId(placementId, weekKey);
  const bestaand = await db.activity.findFirst({
    where: { entityType: FACTURATIE_ENTITY, entityId, sourceKey: ACCEPT_KEY },
    select: { id: true },
  });
  if (bestaand) {
    await db.activity.update({ where: { id: bestaand.id }, data: { body: reden } });
  } else {
    await db.activity.create({
      data: {
        entityType: FACTURATIE_ENTITY,
        entityId,
        kind: "LOG",
        type: "NOTE",
        body: reden,
        sourceKey: ACCEPT_KEY,
        authorId: user?.id ?? null,
      },
    });
  }

  herlaad(placementId, weekKey);
  redirect(dossierPad(placementId, weekKey, { geaccepteerd: "1" }));
}

/** De acceptatie weer intrekken — dan blokkeren de fouten opnieuw. */
export async function trekAcceptatieIn(formData: FormData) {
  const { placementId, weekKey } = sleutels(formData);
  if (!placementId) redirect("/facturatie");
  await db.activity.deleteMany({
    where: {
      entityType: FACTURATIE_ENTITY,
      entityId: weekEntityId(placementId, weekKey),
      sourceKey: ACCEPT_KEY,
    },
  });
  herlaad(placementId, weekKey);
  redirect(dossierPad(placementId, weekKey));
}

// ===========================================================================
// Wachtkamer
// ===========================================================================

/** Parkeer de week tot de freelancer iets gecorrigeerds stuurt. */
export async function naarWachtkamer(formData: FormData) {
  const { placementId, weekKey } = sleutels(formData);
  const reden = tekst(formData, "reden").slice(0, MAX_REDEN);
  const inboxId = tekst(formData, "inboxId");
  if (!placementId) redirect("/facturatie");
  if (inboxId) {
    await db.timesheetInbox.updateMany({
      where: { id: inboxId, status: "EXTRACTED", timesheetId: null },
      data: { wachtkamerSince: new Date(), wachtkamerReason: reden || null },
    });
  }
  herlaad(placementId, weekKey);
  revalidatePath("/facturatie");
  redirect(dossierPad(placementId, weekKey, { wachtkamer: "1" }));
}

/** Terug uit de wachtkamer — de week staat weer gewoon op het overzicht. */
export async function uitWachtkamer(formData: FormData) {
  const { placementId, weekKey } = sleutels(formData);
  const inboxId = tekst(formData, "inboxId");
  if (!placementId) redirect("/facturatie");
  if (inboxId) {
    await db.timesheetInbox.updateMany({
      where: { id: inboxId },
      data: { wachtkamerSince: null, wachtkamerReason: null },
    });
  }
  herlaad(placementId, weekKey);
  revalidatePath("/facturatie");
  redirect(dossierPad(placementId, weekKey));
}

// ===========================================================================
// Verwijderen & opnieuw
// ===========================================================================

/**
 * Gooi deze week helemaal weg zodat hij opnieuw gedaan kan worden. Dit is de
 * bestaande, GEGUARDE cascade uit src/lib/week-reset.ts: een verkoopfactuur die
 * al vrijgegeven of verstuurd is blokkeert de hele reset (die hoort gecrediteerd
 * te worden, niet verwijderd), en een al betaalde ontvangen factuur idem.
 *
 * Ligt er nog geen urenstaat, dan is er niets te resetten: dan verdwijnt alleen
 * de ruwe scan (dezelfde guard als /inbox: nooit een geboekte week).
 */
export async function verwijderEnOpnieuw(formData: FormData) {
  const { placementId, weekKey } = sleutels(formData);
  if (!placementId) redirect("/facturatie");

  const dossier = await getWeekDossier(placementId, weekKey);
  if (!dossier) redirect("/facturatie");

  let uitkomst: "reset" | "locked" | "missing" | "scan" = "missing";
  let reden: string | null = null;

  if (dossier.row.timesheetId) {
    const res = await resetWeekForTimesheet(dossier.row.timesheetId);
    uitkomst = res.result === "reset" ? "reset" : res.result === "locked" ? "locked" : "missing";
    reden = res.lockedReason ?? null;
  } else if (dossier.row.receivedInvoiceId) {
    const res = await resetWeekForReceivedInvoice(dossier.row.receivedInvoiceId);
    uitkomst = res.result === "reset" ? "reset" : res.result === "locked" ? "locked" : "missing";
    reden = res.lockedReason ?? null;
  } else if (dossier.row.inboxId) {
    const item = await db.timesheetInbox.findUnique({
      where: { id: dossier.row.inboxId },
      select: { fileName: true, status: true, timesheetId: true },
    });
    if (item && !item.timesheetId && ["NEW", "EXTRACTED", "REJECTED"].includes(item.status)) {
      await db.timesheetInbox.delete({ where: { id: dossier.row.inboxId } });
      await deleteInboxUpload(item.fileName).catch(() => {});
      uitkomst = "scan";
    }
  }

  // De aantekeningen van deze week horen bij de weggegooide poging, niet bij de
  // volgende — anders staat een nieuwe upload meteen op "fouten geaccepteerd".
  if (uitkomst === "reset" || uitkomst === "scan") {
    await db.activity.deleteMany({
      where: { entityType: FACTURATIE_ENTITY, entityId: weekEntityId(placementId, weekKey) },
    });
  }

  herlaad(placementId, weekKey);
  revalidatePath("/facturatie/inkoop");
  revalidatePath("/facturatie/verkoop");

  if (uitkomst === "locked") {
    redirect(dossierPad(placementId, weekKey, { geblokkeerd: reden ?? "1" }));
  }
  if (uitkomst === "reset" || uitkomst === "scan") {
    redirect(`/facturatie?week=${weekKey}&verwijderd=1`);
  }
  redirect(dossierPad(placementId, weekKey, { fout: "reset" }));
}

// ===========================================================================
// Eén stuk verwijderen (urenstaat óf factuur) — de knop op Week verwerken
// ===========================================================================

/**
 * Een foute urenstaat of factuur eruit halen, zodat de freelancer een nieuwe kan
 * sturen. Wat er weg mag komt uit het dossier op de server (nooit een id van de
 * client). Is de week al vastgelegd, dan gaat dat via de bestaande, GEGUARDE
 * reset (verstuurde/betaalde facturen blokkeren); een betaalde inkoopfactuur
 * blijft altijd staan.
 */
export async function verwijderStuk(formData: FormData) {
  const { placementId, weekKey } = sleutels(formData);
  const stuk = tekst(formData, "stuk") === "factuur" ? "factuur" : "urenstaat";
  if (!placementId) redirect("/facturatie");
  const dossier = await getWeekDossier(placementId, weekKey);
  if (!dossier) redirect("/facturatie");

  let geblokkeerd: string | null = null;
  // Al vastgelegd → de urenstaat hangt aan de (concept-)verkoopfactuur: week terugzetten.
  if (dossier.row.timesheetId) {
    const res = await resetWeekForTimesheet(dossier.row.timesheetId);
    if (res.result === "locked") geblokkeerd = res.lockedReason ?? "Deze week is al gefactureerd.";
  }

  if (!geblokkeerd) {
    const na = (await getWeekDossier(placementId, weekKey))?.row;
    if (stuk === "urenstaat" && na?.inboxId) {
      const item = await db.timesheetInbox.findUnique({
        where: { id: na.inboxId },
        select: { fileName: true, timesheetId: true },
      });
      if (item && !item.timesheetId) {
        await db.timesheetInbox.delete({ where: { id: na.inboxId } });
        await deleteInboxUpload(item.fileName).catch(() => {});
      }
    }
    if (stuk === "factuur" && na?.receivedInvoiceId) {
      const inv = await db.receivedInvoice.findUnique({
        where: { id: na.receivedInvoiceId },
        select: { status: true, fileName: true },
      });
      if (inv?.status === "PAID") {
        geblokkeerd = "Deze factuur is al betaald en blijft als administratie staan.";
      } else if (inv) {
        await db.receivedInvoice.delete({ where: { id: na.receivedInvoiceId } });
        if (inv.fileName) await deleteReceivedUpload(inv.fileName).catch(() => {});
      }
    }
  }

  // Aantekeningen (akkoord/geaccepteerd) horen bij de weggegooide poging.
  if (!geblokkeerd) {
    await db.activity.deleteMany({
      where: { entityType: FACTURATIE_ENTITY, entityId: weekEntityId(placementId, weekKey) },
    });
  }
  herlaad(placementId, weekKey);
  revalidatePath("/facturatie/inkoop");
  revalidatePath("/facturatie/verkoop");
  redirect(geblokkeerd ? dossierPad(placementId, weekKey, { geblokkeerd }) : `/facturatie?week=${weekKey}&weg=${stuk}`);
}

// ===========================================================================
// Akkoord → verkoopfactuur
// ===========================================================================

/**
 * De primaire knop. Legt deze ene week vast: urenstaat bevestigen, zijn factuur
 * als inkoop goedkeuren (Optie A) en de CONCEPT-verkoopfactuur klaarzetten.
 * Het oordeel komt vers uit de controle-machine; er gaat niets de deur uit.
 */
export async function akkoordNaarVerkoopfactuur(formData: FormData) {
  const { placementId, weekKey } = sleutels(formData);
  if (!placementId) redirect("/facturatie");

  const samenvatting = await akkoordWeek(placementId, weekKey);

  herlaad(placementId, weekKey);
  revalidatePath("/facturatie/inkoop");
  revalidatePath("/facturatie/verkoop");

  if (samenvatting.verwerkt === 0) {
    const reden = samenvatting.overgeslagen[0]?.reden ?? "de week kon niet vastgelegd worden";
    redirect(dossierPad(placementId, weekKey, { geblokkeerd: reden }));
  }
  const factuur = samenvatting.facturen[0];
  if (!factuur) redirect(dossierPad(placementId, weekKey, { vastgelegd: "1" }));
  // Klaar met deze persoon → meteen door naar de volgende die nog werk heeft.
  const { rows } = await getWeekOverview(weekKey);
  const huidig = rows.find((r) => r.placementId === placementId);
  const volgende = volgendePersoon(rows, huidig?.key);
  const qs = new URLSearchParams({ klaar: huidig?.naam ?? "Deze persoon", factuur: factuur.id }).toString();
  redirect(volgende?.href ? `${volgende.href}?${qs}` : `/facturatie?week=${weekKey}&allesklaar=${factuur.id}`);
}
