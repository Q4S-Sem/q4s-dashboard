"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/session";
import { isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { ensureAiKeysLoaded } from "@/lib/ai-keys";
import { runInboxExtraction } from "@/lib/inbox-extract";
import {
  extractReceivedInvoiceFromFile,
  toReceivedInvoiceFormValues,
  type InvoiceExtracted,
} from "@/lib/invoice-extract";
import { akkoordWeken } from "@/lib/facturatie-akkoord";
import { getWeekDossier, resolveWeek } from "@/lib/facturatie-week";
import { dubbelBesluit, weekBeslissing } from "@/lib/facturatie-volgende";
import { nameMatches } from "@/lib/name-match";
import { syncPlaatsingStatus } from "@/lib/plaatsing-status";
import { weekSlotVanDatum } from "@/lib/week-koppeling";
import {
  MAX_UPLOAD_BYTES,
  deleteInboxUpload,
  deleteReceivedUpload,
  saveInboxBytes,
  saveReceivedBytes,
} from "@/lib/uploads";

// ---------------------------------------------------------------------------
// De acties van het weekoverzicht (/facturatie).
//
// REVIEW-FIRST: uploaden en uitlezen raken de administratie niet aan behalve dat
// de factuur van een ZZP'er METEEN als `ReceivedInvoice` (status NEW) wordt
// geregistreerd — Optie A, zodat hij nooit "kwijt" is (zie de skill-notities).
// NEW = ontvangen, niet goedgekeurd en niet betaalbaar; dat wordt hij pas met de
// expliciete akkoord-knop.
//
// Er wordt NOOIT gemaild, nooit betaald en nooit een self-billing inkoopfactuur
// gemaakt. Het uitlezen gaat via de BESTAANDE paden (runInboxExtraction voor
// urenstaten, extractReceivedInvoiceFromFile voor facturen), dus de leer-lus en
// de controlevlaggen werken gewoon.
// ---------------------------------------------------------------------------

export type UploadState = {
  /** Wat er gelukt is, in gewoon Nederlands. */
  melding?: string;
  /** Wat er niet lukte — nooit stilzwijgend. */
  fouten?: string[];
  error?: string;
  /** Het bestand hoort bij een andere, nog open week: ga daarheen. */
  naarWeek?: string;
};

function tekst(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** "YYYY-MM-DD" → Date (lokale middernacht); alles anders → null. */
function parseDatum(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** NL-notatie ("3.146,00") → number; onleesbaar of leeg → null. */
function parseBedrag(value: string): number | null {
  const s = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function herlaad() {
  revalidatePath("/facturatie");
  revalidatePath("/facturatie/inkoop");
  revalidatePath("/", "layout");
}

// ===========================================================================
// Uploaden — urenstaten en facturen erbij slepen
// ===========================================================================

/**
 * Voeg handmatig bestanden toe aan deze week. `soort` bepaalt de route:
 *
 *  • TIMESHEET → precies dezelfde weg als /inbox en de mail-intake: opslaan als
 *    `TimesheetInbox` + `runInboxExtraction`. Lukt de naam-match niet, dan blijft
 *    `consultantId` leeg en komt hij op het overzicht als "Niet gekoppeld".
 *  • FACTUUR  → `extractReceivedInvoiceFromFile` en bij precies één naam-treffer
 *    direct als `ReceivedInvoice` (NEW) registreren, gekoppeld aan deze week.
 *    Geen of meerdere treffers → in de wachtrij `FacturatieUpload`, met een
 *    persoonkiezer op het overzicht.
 */
export async function uploadBestanden(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const weekKey = resolveWeek(tekst(formData, "week"), new Date()).key;
  // Twee sleepvlakken in één formulier: "file" = urenstaten, "factuur" = ZZP-facturen.
  // Elk bestand wordt op de naam die de AI leest aan de juiste persoon gekoppeld.
  const echt = (naam: string) =>
    formData.getAll(naam).filter((f): f is File => f instanceof File && f.size > 0);
  const bestanden = [
    ...echt("file").map((file) => ({ file, soort: "TIMESHEET" as const })),
    ...echt("factuur").map((file) => ({ file, soort: "FACTUUR" as const })),
  ];

  if (bestanden.length === 0) return { error: "Kies of sleep eerst één of meer bestanden." };

  await ensureAiKeysLoaded();
  const fouten: string[] = [];
  let gelukt = 0;

  for (const { file, soort } of bestanden) {
    if (file.size > MAX_UPLOAD_BYTES) {
      fouten.push(
        `${file.name}: te groot (max. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).`,
      );
      continue;
    }
    try {
      if (soort === "TIMESHEET") await voegUrenstaatToe(file);
      else await voegFactuurToe(file, weekKey);
      gelukt++;
    } catch (e) {
      fouten.push(`${file.name}: ${e instanceof Error ? e.message : "kon niet verwerkt worden"}.`);
    }
  }

  herlaad();
  return {
    melding:
      gelukt > 0
        ? `${gelukt} ${gelukt === 1 ? "bestand" : "bestanden"} toegevoegd en uitgelezen. Controleer de regels hieronder.`
        : undefined,
    fouten: fouten.length > 0 ? fouten : undefined,
  };
}

/** Eén urenstaat via het bestaande inbox-pad (inclusief AI-uitlezing).
 *  `persoon` = vanuit iemands dossier geüpload: dan hoort hij bij die persoon. */
async function voegUrenstaatToe(
  file: File,
  persoon?: { consultantId: string; placementId: string | null },
): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = await saveInboxBytes(bytes, file.name);
  const created = await db.timesheetInbox.create({
    data: {
      source: "UPLOAD",
      status: "NEW",
      fileName,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: bytes.length,
      consultantId: persoon?.consultantId ?? null,
      placementId: persoon?.placementId ?? null,
    },
  });
  if (!isAIConfigured() && !isVisionConfigured()) {
    throw new Error("er is geen AI ingesteld om urenstaten uit te lezen — vul de uren handmatig in");
  }
  // Mislukt het uitlezen, dan blijft het item staan (status NEW) en vult de mens
  // de uren zelf in; de melding gaat wel naar de gebruiker.
  await runInboxExtraction(created.id);
  return created.id;
}

/**
 * Uploaden vanuit het dossier van ÉÉN persoon: urenstaat en/of factuur horen dan
 * zeker bij die persoon — geen naam-matching, dus ook nooit "Niet gekoppeld".
 * Daarna draait de controle vanzelf opnieuw (de pagina rendert vers).
 */
export async function uploadVoorPersoon(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const consultantId = tekst(formData, "consultantId");
  const placementId = tekst(formData, "placementId") || null;
  const weekKey = resolveWeek(tekst(formData, "week"), new Date()).key;
  if (!consultantId) return { error: "Onbekende persoon." };
  const persoon = await db.consultant.findUnique({ where: { id: consultantId }, select: { id: true } });
  if (!persoon) return { error: "Onbekende persoon." };

  const echt = (naam: string) =>
    formData.getAll(naam).filter((f): f is File => f instanceof File && f.size > 0);
  const bestanden = [
    ...echt("file").map((file) => ({ file, soort: "TIMESHEET" as const })),
    ...echt("factuur").map((file) => ({ file, soort: "FACTUUR" as const })),
  ];
  if (bestanden.length === 0) return { error: "Kies of sleep eerst een urenstaat of factuur." };

  await ensureAiKeysLoaded();
  const fouten: string[] = [];
  let gelukt = 0;
  let naarWeek: string | undefined;
  // Welke week staat er ECHT op het document, en is die al verwerkt?
  const beslis = async (gelezenWeek: string | null | undefined) => {
    if (!gelezenWeek || gelezenWeek === weekKey || !placementId) return "zelfde" as const;
    const d = await getWeekDossier(placementId, gelezenWeek);
    return weekBeslissing(weekKey, gelezenWeek, Boolean(d && (d.row.vastgelegd || d.row.gefactureerd)));
  };
  const weekNr = (key: string) => Number(key.split("-W")[1]);
  for (const { file, soort } of bestanden) {
    if (file.size > MAX_UPLOAD_BYTES) {
      fouten.push(`${file.name}: te groot (max. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).`);
      continue;
    }
    try {
      if (soort === "TIMESHEET") {
        const inboxId = await voegUrenstaatToe(file, { consultantId, placementId });
        const item = await db.timesheetInbox.findUnique({ where: { id: inboxId }, select: { extractedWeekStart: true, fileName: true } });
        const gelezen = weekSlotVanDatum(item?.extractedWeekStart)?.key;
        const besluit = await beslis(gelezen);
        if (besluit === "verkeerd" && item) {
          // Ruwe scan van een al verwerkte week: weggooien, er is niets geboekt.
          await db.timesheetInbox.delete({ where: { id: inboxId } });
          await deleteInboxUpload(item.fileName).catch(() => {});
          fouten.push(`Verkeerde weekstaat ingezet: dit is week ${weekNr(gelezen!)}, en die is al verwerkt. Zet de urenstaat van week ${weekNr(weekKey)} erin`);
          continue;
        }
        if (besluit === "verder") naarWeek = gelezen;
      } else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const mimeType = file.type || "application/octet-stream";
        const fileName = await saveReceivedBytes(bytes, file.name);
        const gelezen = await extractReceivedInvoiceFromFile({
          base64: Buffer.from(bytes).toString("base64"),
          originalName: file.name,
          mimeType,
        });
        if (!gelezen.ok) throw new Error(gelezen.message);
        const factuurWeek = weekSlotVanDatum(toReceivedInvoiceFormValues(gelezen.data, new Date()).periodStart)?.key;
        const besluit = await beslis(factuurWeek);
        if (besluit === "verkeerd") {
          await deleteReceivedUpload(fileName).catch(() => {});
          fouten.push(`Verkeerde factuur ingezet: dit is week ${weekNr(factuurWeek!)}, en die is al verwerkt. Zet de factuur van week ${weekNr(weekKey)} erin`);
          continue;
        }
        if (besluit === "verder") naarWeek = factuurWeek;
        await registreerOntvangenFactuur({
          consultantId,
          weekKey,
          data: gelezen.data,
          bestand: { fileName, originalName: file.name, mimeType, size: bytes.length },
        });
        await onthoudBedrijfsgegevens(consultantId, gelezen.data);
      }
      gelukt++;
    } catch (e) {
      fouten.push(`${file.name}: ${e instanceof Error ? e.message : "kon niet verwerkt worden"}.`);
    }
  }

  herlaad();
  if (placementId) revalidatePath(`/facturatie/${placementId}/${weekKey}`);
  return {
    melding: gelukt > 0 ? "Uitgelezen en gecontroleerd — kijk hieronder of alles klopt." : undefined,
    fouten: fouten.length > 0 ? fouten : undefined,
    naarWeek:
      naarWeek && placementId
        ? `/facturatie/${placementId}/${naarWeek}?andereWeek=${weekNr(naarWeek)}&van=${weekNr(weekKey)}`
        : undefined,
  };
}

/**
 * Eén ZZP-factuur: uitlezen, en bij precies één naam-treffer direct registreren.
 * Het register-slot: bestaat er al een factuur van DEZELFDE persoon met HETZELFDE
 * nummer, dan wordt die rij bijgewerkt in plaats van een dubbele aangemaakt (een
 * al betaalde factuur blijft PAID).
 */
async function voegFactuurToe(file: File, weekKey: string): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const fileName = await saveReceivedBytes(bytes, file.name);

  const gelezen = await extractReceivedInvoiceFromFile({
    base64: Buffer.from(bytes).toString("base64"),
    originalName: file.name,
    mimeType,
  });

  if (!gelezen.ok) {
    await db.facturatieUpload.create({
      data: {
        weekKey,
        fileName,
        originalName: file.name,
        mimeType,
        size: bytes.length,
        reason: `${gelezen.message} Kies zelf de persoon en controleer de gegevens.`,
      },
    });
    return;
  }

  if (!gelezen.matchedConsultantId) {
    await db.facturatieUpload.create({
      data: {
        weekKey,
        fileName,
        originalName: file.name,
        mimeType,
        size: bytes.length,
        extractedName: gelezen.data.name?.trim() || null,
        extractedJson: JSON.stringify(gelezen.data),
        reason:
          gelezen.candidates.length > 1
            ? `De naam "${gelezen.data.name}" past bij meerdere mensen (${gelezen.candidates
                .map((c) => c.name)
                .join(", ")}) — kies de juiste.`
            : `De naam "${gelezen.data.name || "onbekend"}" op de factuur hoort bij niemand in het dossier — kies zelf de persoon.`,
      },
    });
    return;
  }

  await registreerOntvangenFactuur({
    consultantId: gelezen.matchedConsultantId,
    weekKey,
    data: gelezen.data,
    bestand: { fileName, originalName: file.name, mimeType, size: bytes.length },
  });
}

/**
 * Registreer (of werk bij) de factuur van een freelancer als `ReceivedInvoice`.
 * Dit is de inkoop (Optie A) — er wordt NOOIT een self-billing inkoopfactuur
 * gemaakt. Status blijft NEW: goedkeuren doet de akkoord-knop.
 */
async function registreerOntvangenFactuur(args: {
  consultantId: string;
  weekKey: string;
  data: InvoiceExtracted;
  bestand: { fileName: string; originalName: string; mimeType: string; size: number };
}): Promise<string> {
  const { consultantId, data, bestand } = args;
  const velden = toReceivedInvoiceFormValues(data, new Date());
  // De week komt van de FACTUUR zelf (periode of weeknummer), niet van het scherm
  // waarop hij binnenkwam; alleen zonder periode valt hij terug op die week.
  const weekKey = weekSlotVanDatum(velden.periodStart)?.key ?? args.weekKey;
  const bedrag = parseBedrag(velden.amount) ?? 0;
  const btw = parseBedrag(velden.vatAmount ?? "");
  const km = parseBedrag(velden.kilometers);

  const rij = {
    consultantId,
    number: velden.number || null,
    issueDate: parseDatum(velden.issueDate),
    periodStart: parseDatum(velden.periodStart),
    periodEnd: parseDatum(velden.periodEnd),
    amount: bedrag,
    vatAmount: btw !== null && btw > 0 ? btw : null,
    kilometers: km !== null && km > 0 ? km : null,
    countForVat: true,
    weekKey,
    extractedJson: JSON.stringify(data),
    notes: velden.notes || null,
    fileName: bestand.fileName,
    originalName: bestand.originalName,
    mimeType: bestand.mimeType,
    size: bestand.size,
  };

  // REGISTER-SLOT: dezelfde persoon + hetzelfde factuurnummer is dezelfde factuur.
  const nummer = (velden.number || "").trim();
  const bestaand = nummer
    ? await db.receivedInvoice.findFirst({
        where: { consultantId, number: { equals: nummer, mode: "insensitive" } },
        select: { id: true, status: true },
      })
    : null;

  if (bestaand) {
    await db.receivedInvoice.update({
      where: { id: bestaand.id },
      data: bestaand.status === "PAID" ? { ...rij, status: "PAID" } : rij,
    });
    return bestaand.id;
  }
  // ÉÉN FACTUUR PER PERSOON PER WEEK: anders telt de week dubbel ("Dubbele facturatie").
  const zelfdeWeek = await db.receivedInvoice.findFirst({
    where: { consultantId, weekKey },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, number: true, fileName: true },
  });
  if (zelfdeWeek) {
    const weekNr = weekKey.split("-W")[1];
    if (dubbelBesluit(zelfdeWeek.status) === "blokkeer") {
      await deleteReceivedUpload(bestand.fileName).catch(() => {});
      throw new Error(
        `voor week ${weekNr} staat al een goedgekeurde factuur${zelfdeWeek.number ? ` (${zelfdeWeek.number})` : ""} — niet dubbel ingezet`,
      );
    }
    // Nog open: de nieuwe factuur vervangt de oude (laatste versie wint).
    await db.receivedInvoice.update({ where: { id: zelfdeWeek.id }, data: rij });
    if (zelfdeWeek.fileName && zelfdeWeek.fileName !== bestand.fileName) {
      await deleteReceivedUpload(zelfdeWeek.fileName).catch(() => {});
    }
    return zelfdeWeek.id;
  }
  const created = await db.receivedInvoice.create({ data: { ...rij, status: "NEW" } });
  return created.id;
}

// ===========================================================================
// Losse uploads koppelen of weggooien
// ===========================================================================

/** Koppel een niet-gematchte upload aan een persoon. */
export async function koppelLosseUpload(formData: FormData) {
  const weekKey = resolveWeek(tekst(formData, "week"), new Date()).key;
  const id = tekst(formData, "id");
  const soort = tekst(formData, "soort");
  const consultantId = tekst(formData, "consultantId");
  if (!id || !consultantId) redirect(`/facturatie?week=${weekKey}&fout=koppelen`);

  if (soort === "timesheet") {
    // De scan bij de persoon zetten; met precies één actieve plaatsing koppelen
    // we die er meteen aan, anders laat de dossierpagina de keuze.
    const actief = await db.placement.findMany({
      where: { consultantId, status: "ACTIVE" },
      select: { id: true },
    });
    await db.timesheetInbox.update({
      where: { id },
      data: { consultantId, placementId: actief.length === 1 ? actief[0].id : null },
    });
  } else {
    const los = await db.facturatieUpload.findUnique({ where: { id } });
    if (!los) redirect(`/facturatie?week=${weekKey}&fout=koppelen`);
    const data = los.extractedJson
      ? (JSON.parse(los.extractedJson) as InvoiceExtracted)
      : null;
    if (data) {
      await onthoudBedrijfsgegevens(consultantId, data);
      const ok = await registreerOntvangenFactuur({
        consultantId,
        weekKey: los.weekKey ?? weekKey,
        data,
        bestand: {
          fileName: los.fileName,
          originalName: los.originalName,
          mimeType: los.mimeType,
          size: los.size,
        },
      }).catch(() => null);
      if (!ok) {
        // Al een goedgekeurde factuur voor die week: deze losse upload is dubbel.
        await db.facturatieUpload.delete({ where: { id } });
        redirect(`/facturatie?week=${weekKey}&tab=bestanden&fout=dubbel`);
      }
    } else {
      // Niet uitgelezen: wél registreren (zodat hij niet kwijt is), maar leeg —
      // de mens vult de bedragen op het dossier aan.
      await db.receivedInvoice.create({
        data: {
          consultantId,
          status: "NEW",
          amount: 0,
          countForVat: true,
          weekKey: los.weekKey ?? weekKey,
          fileName: los.fileName,
          originalName: los.originalName,
          mimeType: los.mimeType,
          size: los.size,
          notes: "Handmatig gekoppeld; de factuur is niet automatisch uitgelezen.",
        },
      });
    }
    await db.facturatieUpload.delete({ where: { id } });
  }

  herlaad();
  redirect(`/facturatie?week=${weekKey}&gekoppeld=1`);
}

/** Gooi een losse (nog niet geboekte) upload weg. */
export async function verwijderLosseUpload(formData: FormData) {
  const weekKey = resolveWeek(tekst(formData, "week"), new Date()).key;
  const id = tekst(formData, "id");
  const soort = tekst(formData, "soort");
  if (!id) redirect(`/facturatie?week=${weekKey}`);

  if (soort === "timesheet") {
    // Alleen een RUWE scan zonder urenstaat mag weg — nooit een geboekte week.
    const item = await db.timesheetInbox.findUnique({
      where: { id },
      select: { fileName: true, status: true, timesheetId: true },
    });
    if (item && !item.timesheetId && ["NEW", "EXTRACTED", "REJECTED"].includes(item.status)) {
      await db.timesheetInbox.delete({ where: { id } });
      await deleteInboxUpload(item.fileName).catch(() => {});
    }
  } else {
    const los = await db.facturatieUpload.findUnique({ where: { id }, select: { fileName: true } });
    if (los) {
      await db.facturatieUpload.delete({ where: { id } });
      await deleteReceivedUpload(los.fileName).catch(() => {});
    }
  }

  herlaad();
  redirect(`/facturatie?week=${weekKey}&verwijderd=1`);
}

// ===========================================================================
// "N groene weken verwerken"
// ===========================================================================

/**
 * Leg alle groene weken van deze week vast. De controle wordt server-side
 * OPNIEUW gedraaid (akkoordWeken → getWeekDossier → evaluateFacturatieWeek):
 * wat de browser meestuurt is alleen de week, nooit of een week goed was.
 */
export async function verwerkGroeneWeken(formData: FormData) {
  const weekKey = resolveWeek(tekst(formData, "week"), new Date()).key;
  const samenvatting = await akkoordWeken({ weekKey });

  herlaad();
  revalidatePath("/facturatie/verkoop");

  const params = new URLSearchParams({ week: weekKey, verwerkt: String(samenvatting.verwerkt) });
  if (samenvatting.facturen.length > 0) {
    params.set("facturen", String(samenvatting.facturen.length));
  }
  if (samenvatting.overgeslagen.length > 0) {
    params.set("overgeslagen", String(samenvatting.overgeslagen.length));
  }
  redirect(`/facturatie?${params.toString()}`);
}

/**
 * De mens koppelde een factuur handmatig: zet zijn bedrijfsnaam/KvK/btw/IBAN van
 * die factuur bij de ZZP'er, zodat de volgende factuur vanzelf matcht. Alleen
 * LEGE velden — wat al in het dossier staat wordt nooit overschreven.
 */
async function onthoudBedrijfsgegevens(consultantId: string, data: InvoiceExtracted): Promise<void> {
  const c = await db.consultant.findUnique({
    where: { id: consultantId },
    select: { firstName: true, lastName: true, companyName: true, kvkNumber: true, vatNumber: true, iban: true },
  });
  if (!c) return;
  const naam = data.name?.trim();
  // Alleen als bedrijfsnaam bewaren als het NIET gewoon zijn eigen naam is.
  const isBedrijf = naam && !nameMatches(c, naam);
  const vul = {
    ...(!c.companyName?.trim() && isBedrijf ? { companyName: naam } : {}),
    ...(!c.kvkNumber?.trim() && data.kvkNumber?.trim() ? { kvkNumber: data.kvkNumber.trim() } : {}),
    ...(!c.vatNumber?.trim() && data.vatId?.trim() ? { vatNumber: data.vatId.trim() } : {}),
    ...(!c.iban?.trim() && data.iban?.trim() ? { iban: data.iban.trim() } : {}),
  };
  if (Object.keys(vul).length > 0) {
    await db.consultant.update({ where: { id: consultantId }, data: vul });
    await syncPlaatsingStatus({ consultantId }); // misschien is de plaatsing nu compleet
  }
}

// ===========================================================================
// Automatische timesheet-herinnering aan/uit (standaard UIT)
// ===========================================================================

export async function zetHerinnering(formData: FormData) {
  if (!(await isAdminSession())) redirect("/facturatie?fout=rechten");
  const aan = tekst(formData, "aan") === "1";
  await db.companySettings.upsert({
    where: { id: "default" },
    update: { timesheetReminderEnabled: aan },
    create: { id: "default", timesheetReminderEnabled: aan },
  });
  revalidatePath("/facturatie");
}
