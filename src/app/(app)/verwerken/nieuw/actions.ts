"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { ensureAiKeysLoaded } from "@/lib/ai-keys";
import { confirmInboxItem, type ConfirmInboxError } from "@/lib/inbox-confirm";
import { parseConfirmInput, type ConfirmInboxRaw } from "@/lib/inbox-confirm-input";
import { runInboxExtraction } from "@/lib/inbox-extract";
import { extractReceivedInvoiceFromFile, parseWeekNumber } from "@/lib/invoice-extract";
import { createSalesInvoice } from "@/lib/invoicing";
import { computeTimesheetMoney } from "@/lib/toeslag";
import { MAX_UPLOAD_BYTES, saveInboxBytes, saveReceivedBytes } from "@/lib/uploads";
import { formatHours, formatWeekLabel, round2 } from "@/lib/utils";
import {
  BESTAANDE_URENSTAAT_NOTITIE,
  beoordeelBestaandeUrenstaat,
} from "@/lib/urenstaat-hergebruik";
import { weekNummerUitTekst, weekSlotVanDatum } from "@/lib/week-koppeling";
import { parseBedrag } from "@/lib/week-wizard";
import {
  LEGE_FACTUUR,
  getypteWeekVeld,
  naarWizardTimesheet,
  type BestaandeUrenstaat,
  type FactuurLeesState,
  type TimesheetLeesState,
  type VerwerkState,
  type WizardBestand,
} from "./wizard-data";

// ---------------------------------------------------------------------------
// De drie server-actions van de wizard "Week verwerken" (/verwerken/nieuw).
//
// 1) leesTimesheet — bestand opslaan + door de bestaande AI-uitlezing halen
//    (runInboxExtraction). Vult ALLEEN voor; de mens corrigeert in het scherm.
// 2) leesFactuur   — zijn eigen factuur uitlezen (extractReceivedInvoiceFromFile).
//    Slaat NIETS in de boekhouding op; ook dit is puur voorvullen.
// 3) verwerkWeek   — de ENIGE knop die iets vastlegt, na menselijk akkoord.
//
// REVIEW-FIRST: stap 1 en 2 raken de administratie niet aan (alleen het bestand
// wordt bewaard, net als bij een inbox-upload). Pas bij verwerkWeek worden de
// uren geaccepteerd, zijn factuur als inkoop geregistreerd en de verkoopfactuur
// als CONCEPT klaargezet. Er wordt nooit iets verstuurd of betaald.
//
// GEEN eigen rekenwerk: uren × tarief komt uit computeTimesheetMoney en de echte
// verkoopfactuur uit createSalesInvoice (src/lib/invoicing.ts).
// ---------------------------------------------------------------------------

function tekst(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Het bestand uit de FormData, of een Nederlandse foutmelding. */
function leesBestand(formData: FormData): { file: File } | { error: string } {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Kies of sleep eerst een bestand." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Dit bestand is te groot (max. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).` };
  }
  return { file };
}

// ===========================================================================
// STAP 1 — de urenstaat erin
// ===========================================================================

/**
 * Sla een geüploade timesheet op als inbox-item en laat de AI hem uitlezen —
 * exact dezelfde weg als een bestand dat via /inbox of per mail binnenkomt, zodat
 * de leer-lus per afzender en de controlevlaggen gewoon werken.
 *
 * Mislukt het uitlezen, dan is dat geen fout: het item blijft staan (status NEW)
 * en de gebruiker vult de uren zelf in.
 */
export async function leesTimesheet(
  _prev: TimesheetLeesState,
  formData: FormData,
): Promise<TimesheetLeesState> {
  const gekozen = leesBestand(formData);
  if ("error" in gekozen) return { error: gekozen.error };
  const { file } = gekozen;

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
    },
  });

  // Serverless: de AI-sleutels staan in de DB, laad ze vóór de provider-keuze.
  await ensureAiKeysLoaded();
  let waarschuwing: string | undefined;
  if (isAIConfigured() || isVisionConfigured()) {
    try {
      await runInboxExtraction(created.id);
    } catch (e) {
      waarschuwing = `De AI kon deze staat niet uitlezen (${
        e instanceof Error ? e.message : "onbekende fout"
      }) — vul de uren hieronder zelf in.`;
    }
  } else {
    waarschuwing = "Er is geen AI ingesteld om urenstaten uit te lezen — vul de uren hieronder zelf in.";
  }

  const item = await db.timesheetInbox.findUnique({
    where: { id: created.id },
    include: { consultant: { select: { firstName: true, lastName: true } } },
  });
  if (!item) return { error: "Het bestand is opgeslagen maar niet meer terug te vinden." };

  // Pas NA het uitlezen is de week bekend — en dus pas nu is te zien of deze
  // staat er al lag. Bewust alleen MELDEN: soms is de tweede scan juist de
  // gecorrigeerde versie, dus de mens kiest zelf welke weg mag.
  const alAanwezig = await dubbeleWeekstaten(item);
  if (alAanwezig > 0) {
    const melding = `Let op: er ${alAanwezig === 1 ? "stond al een openstaande urenstaat" : `stonden al ${alAanwezig} openstaande urenstaten`} van deze persoon voor deze week klaar. De wizard toont er één — ruim de dubbele op via de melding bij die week.`;
    waarschuwing = waarschuwing ? `${waarschuwing} ${melding}` : melding;
  }

  revalidatePath("/inbox");
  revalidatePath("/verwerken/nieuw");
  return { item: naarWizardTimesheet(item, getypteWeekVanStaat(item)), waarschuwing };
}

/**
 * Hoeveel ANDERE openstaande weekstaten van deze persoon vallen in dezelfde
 * week? Vergelijken gebeurt op de canonieke weeksleutel (weekSlotVanDatum, dus
 * de gewerkte dagen) — niet op de opgeslagen datum zelf, want die kan bij de één
 * op de maandag en bij de ander midden in de week staan.
 *
 * Nooit blokkerend: zonder gematchte persoon of zonder uitgelezen week is er
 * niets te vergelijken, en dan is het antwoord gewoon 0.
 */
async function dubbeleWeekstaten(item: {
  id: string;
  consultantId: string | null;
  extractedWeekStart: Date | null;
}): Promise<number> {
  const week = weekSlotVanDatum(item.extractedWeekStart)?.key ?? null;
  if (!week || !item.consultantId) return 0;

  const anderen = await db.timesheetInbox.findMany({
    where: {
      id: { not: item.id },
      consultantId: item.consultantId,
      status: { in: ["NEW", "EXTRACTED"] },
      timesheetId: null,
      wachtkamerSince: null,
    },
    select: { extractedWeekStart: true },
  });
  return anderen.filter((a) => weekSlotVanDatum(a.extractedWeekStart)?.key === week).length;
}

/**
 * Het weeknummer zoals de freelancer het OPSCHREEF: eerst het weekveld uit de
 * AI-uitlezing, anders de bestandsnaam ("Urenstaat week 35.pdf"). Alleen om een
 * afwijking te kunnen melden — de week zelf komt uit de gewerkte dagen.
 */
function getypteWeekVanStaat(item: { extractedJson: string | null; originalName: string }): number | null {
  return parseWeekNumber(getypteWeekVeld(item)) ?? weekNummerUitTekst(item.originalName);
}

// ===========================================================================
// STAP 2 — zijn eigen factuur (de inkoop)
// ===========================================================================

/**
 * Lees de factuur van de freelancer uit en geef de voorgevulde formulierwaarden
 * terug. Het bestand wordt wél bewaard (zodat het straks aan de geregistreerde
 * factuur hangt), maar er komt geen cent in de boekhouding: dat gebeurt pas bij
 * het akkoord in stap 3.
 */
export async function leesFactuur(
  _prev: FactuurLeesState,
  formData: FormData,
): Promise<FactuurLeesState> {
  const gekozen = leesBestand(formData);
  if ("error" in gekozen) return { error: gekozen.error };
  const { file } = gekozen;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const fileName = await saveReceivedBytes(bytes, file.name);
  const bestand: WizardBestand = {
    fileName,
    originalName: file.name,
    mimeType,
    size: bytes.length,
  };

  const gelezen = await extractReceivedInvoiceFromFile({
    base64: Buffer.from(bytes).toString("base64"),
    originalName: file.name,
    mimeType,
  });

  if (!gelezen.ok) {
    // Niet fataal: de factuur is bewaard, de mens vult 'm zelf in.
    return {
      bestand,
      values: { ...LEGE_FACTUUR },
      getypteWeek: weekNummerUitTekst(file.name),
      waarschuwing: `${gelezen.message} Vul de factuurgegevens hieronder zelf in.`,
    };
  }

  const v = gelezen.values;
  return {
    bestand,
    // Wat hij BOVEN de factuur zette; de wizard vergelijkt dat met de week uit
    // de gewerkte dagen en meldt een verschil (zonder iets te blokkeren).
    getypteWeek: parseWeekNumber(gelezen.data.weekNumber) ?? weekNummerUitTekst(file.name),
    values: {
      number: v.number,
      issueDate: v.issueDate,
      periodStart: v.periodStart,
      periodEnd: v.periodEnd,
      amount: v.amount,
      vatAmount: v.vatAmount ?? "",
      kilometers: v.kilometers,
      notes: v.notes,
    },
    factuurUren: gelezen.data.hours > 0 ? gelezen.data.hours : undefined,
    factuurTarief: gelezen.data.hourlyRate > 0 ? gelezen.data.hourlyRate : undefined,
  };
}

// ===========================================================================
// STAP 3 — akkoord: uren vastleggen, inkoop registreren, verkoop klaarzetten
// ===========================================================================

/** De foutcodes van confirmInboxItem als gewoon Nederlands. */
const CONFIRM_FOUT: Record<ConfirmInboxError, string> = {
  id: "Er is geen timesheet gekozen.",
  missing: "Deze timesheet staat niet meer in de inbox — kies er opnieuw een.",
  state: "Deze weekstaat is intussen al verwerkt of afgewezen.",
  exists: "Er bestaat al een urenstaat voor deze plaatsing in deze week.",
  match: "Kies een geldige plaatsing (werknemer · klant).",
  week: "Vul de week (maandag) in.",
  hours: "Vul voor minimaal één dag uren in.",
};

/** De plaatsing zoals het akkoord hem al opgehaald heeft. */
type AkkoordPlaatsing = {
  consultantId: string;
  consultant: { firstName: string; lastName: string };
  client: { companyName: string } | null;
};

type HergebruikUitkomst =
  | { ok: true; timesheetId: string; waarschuwingen: string[] }
  | { ok: false; state: VerwerkState };

// ---------------------------------------------------------------------------
// "Er lag al een urenstaat voor deze week" — niet meer doodlopen.
//
// De @@unique(placementId, weekStart) op Timesheet laat er maar één per week
// bestaan; confirmInboxItem geeft dan "exists" terug. Vroeger stopte het akkoord
// daar met een rode regel: de inkoop bleef liggen en de verkoopfactuur kwam er
// niet, terwijl de week zelf gewoon klaar lag om afgemaakt te worden.
//
// Wat er nu gebeurt hangt af van de BESTAANDE urenstaat — het oordeel is puur en
// getest (beoordeelBestaandeUrenstaat, src/lib/urenstaat-hergebruik.ts):
//
//   • staat hij al op een VERKOOPFACTUUR → er gebeurt niets. Dubbel factureren
//     is het enige wat écht niet mag; het scherm krijgt de factuur mee om
//     naartoe te linken, plus de keuze om de week te verwijderen (als dat mag).
//   • anders → de rest van het akkoord loopt gewoon door TEGEN DIE URENSTAAT:
//     zijn factuur wordt als inkoop geregistreerd en de verkoopfactuur wordt
//     alsnog klaargezet.
//
// De uren van de bestaande staat blijven leidend — die worden hier NOOIT
// overschreven. Wijken ze af van wat er in de wizard stond, dan is dat een
// waarschuwing, geen stille correctie.
// ---------------------------------------------------------------------------

/**
 * Eén bestaande urenstaat beschrijven zoals het scherm hem toont, mét het
 * oordeel erover. Bewust ELKE keer vers uit de database: na het akkoord staat er
 * een verkoopfactuur aan vast en dán mag hij niet meer weg — het paneel moet
 * geen verwijderknop tonen die de guard van deleteTimesheet toch weigert.
 */
async function beschrijfBestaandeUrenstaat(
  timesheetId: string,
  placement: AkkoordPlaatsing,
): Promise<BestaandeUrenstaat | null> {
  const ts = await db.timesheet.findUnique({
    where: { id: timesheetId },
    include: {
      entries: { select: { hours: true } },
      invoiceLine: { select: { id: true, invoice: { select: { id: true, number: true } } } },
      purchaseLine: { select: { id: true } },
    },
  });
  if (!ts) return null;

  const oordeel = beoordeelBestaandeUrenstaat({
    status: ts.status,
    verkoopRegelId: ts.invoiceLine?.id ?? null,
    inkoopRegelId: ts.purchaseLine?.id ?? null,
  });

  return {
    id: ts.id,
    weekLabel: formatWeekLabel(ts.weekStart),
    consultantNaam: `${placement.consultant.firstName} ${placement.consultant.lastName}`,
    klantNaam: placement.client?.companyName ?? null,
    uren: round2(ts.entries.reduce((som, e) => som + e.hours, 0)),
    status: ts.status,
    alGefactureerd: oordeel.alGefactureerd,
    eerstGoedkeuren: oordeel.eerstGoedkeuren,
    magVerwijderen: oordeel.magVerwijderen,
    factuurId: ts.invoiceLine?.invoice?.id ?? null,
    factuurNummer: ts.invoiceLine?.invoice?.number ?? null,
    reden: oordeel.reden,
  };
}

async function hergebruikBestaandeUrenstaat(opts: {
  inboxId: string;
  raw: ConfirmInboxRaw;
  placement: AkkoordPlaatsing;
}): Promise<HergebruikUitkomst> {
  const { inboxId, raw, placement } = opts;

  // Dezelfde lezing als confirmInboxItem deed — dus exact dezelfde maandag.
  const parsed = parseConfirmInput(raw);
  if (!parsed.ok) return { ok: false, state: { error: CONFIRM_FOUT.exists } };
  const { placementId, monday, totalHours } = parsed.fields;

  const gevonden = await db.timesheet.findUnique({
    where: { placementId_weekStart: { placementId, weekStart: monday } },
    select: { id: true },
  });
  // Net weggehaald door iemand anders: dan blijft de oude melding staan en
  // probeert de eigenaar het gewoon opnieuw.
  if (!gevonden) return { ok: false, state: { error: CONFIRM_FOUT.exists } };

  const info = await beschrijfBestaandeUrenstaat(gevonden.id, placement);
  if (!info) return { ok: false, state: { error: CONFIRM_FOUT.exists } };

  // Al gefactureerd: hier stopt het. Het scherm krijgt de factuur mee om
  // naartoe te linken — er wordt niets dubbel gefactureerd.
  if (info.alGefactureerd) {
    return {
      ok: false,
      state: {
        error: `Er staat al een urenstaat voor ${info.weekLabel.toLowerCase()}, en die is al gefactureerd${
          info.factuurNummer ? ` op verkoopfactuur ${info.factuurNummer}` : ""
        }. Er wordt niets dubbel gefactureerd.`,
        bestaand: info,
      },
    };
  }

  const waarschuwingen: string[] = [BESTAANDE_URENSTAAT_NOTITIE];

  if (Math.abs(info.uren - totalHours) > 0.01) {
    waarschuwingen.push(
      `De bestaande urenstaat staat op ${formatHours(info.uren)} u; in de wizard stond ${formatHours(totalHours)} u. De bestaande uren zijn aangehouden — pas ze zo nodig aan bij Urenregistratie.`,
    );
  }
  if (info.eerstGoedkeuren) {
    waarschuwingen.push(
      "De bestaande urenstaat is nog niet goedgekeurd, dus er komt nog geen verkoopfactuur uit. Keur 'm goed bij Urenregistratie en maak de factuur daar alsnog.",
    );
  }

  // De scan hoort voortaan bij die bestaande urenstaat — anders blijft hij als
  // openstaande week in de inbox en de wizard staan. Er hangt al een scan aan
  // (TimesheetInbox.timesheetId is @unique)? Dan blijft deze gewoon staan en
  // zeggen we dat eerlijk; opruimen is mensenwerk.
  try {
    await db.timesheetInbox.update({
      where: { id: inboxId },
      data: {
        status: "CONFIRMED",
        consultantId: placement.consultantId,
        placementId,
        timesheetId: info.id,
        extractedWeekStart: monday,
        wachtkamerSince: null,
        wachtkamerReason: null,
      },
    });
  } catch {
    waarschuwingen.push(
      "Deze scan is niet aan de bestaande urenstaat gekoppeld — er hing er al één aan. Hij blijft in de timesheet-inbox staan; ruim 'm daar op als hij dubbel is.",
    );
  }

  return { ok: true, timesheetId: info.id, waarschuwingen };
}

/**
 * Het akkoord. Drie stappen, in deze volgorde, elk alleen als de vorige lukte:
 *
 *   a) confirmInboxItem  → van uitgelezen weekstaat naar een échte urenstaat
 *                          (status APPROVED), met de gecorrigeerde uren/km/overuren.
 *   b) ReceivedInvoice   → zijn eigen factuur als INKOOP, meteen op Gecontroleerd.
 *                          Alleen als er in stap 2 een factuur is aangeleverd
 *                          (optie A: Q4S maakt géén eigen inkoopfactuur).
 *   c) createSalesInvoice→ de VERKOOPfactuur naar de klant, als CONCEPT (DRAFT).
 *
 * Lag er al een urenstaat voor deze plaatsing + week, dan stopt (a) — maar het
 * akkoord niet: zolang die week nog niet gefactureerd is lopen (b) en (c) gewoon
 * door tegen de BESTAANDE urenstaat, met een melding erbij. Zie
 * {@link hergebruikBestaandeUrenstaat}.
 *
 * Elke stap is op zichzelf atomair (createSalesInvoice draait in één Prisma-
 * transactie), maar ze delen er bewust geen: confirmInboxItem en createSalesInvoice
 * zijn de bestaande, elders hergebruikte functies en die schrijven met hun eigen
 * transactie. De volgorde is daarom zo gekozen dat een halverwege gestrande week
 * altijd in een AFMAAKBARE toestand blijft staan: de urenstaat is er, en de
 * ontbrekende factuur/verkoopfactuur maak je gewoon los alsnog. Wat er niet lukte
 * komt als waarschuwing terug — er wordt niets stilzwijgend overgeslagen.
 *
 * Er wordt NIETS verstuurd en NIETS betaald.
 */
export async function verwerkWeek(
  _prev: VerwerkState,
  formData: FormData,
): Promise<VerwerkState> {
  const inboxId = tekst(formData, "inboxId");
  const placementId = tekst(formData, "placementId");
  const weekStart = tekst(formData, "weekStart");
  if (!inboxId) return { error: "Kies eerst een timesheet (stap 1)." };
  if (!placementId) return { error: "Kies een plaatsing (werknemer · klant) bij deze week." };

  // Dubbel verwerken voorkomen: een item dat al een urenstaat heeft is klaar.
  const item = await db.timesheetInbox.findUnique({
    where: { id: inboxId },
    select: { status: true, timesheetId: true },
  });
  if (!item) return { error: CONFIRM_FOUT.missing };
  if (item.timesheetId || item.status === "CONFIRMED") {
    return { error: "Deze week is al verwerkt — je vindt hem terug bij Urenregistratie." };
  }
  if (item.status === "REJECTED") {
    return { error: "Deze weekstaat is eerder afgewezen. Zet 'm eerst terug in de inbox." };
  }

  const placement = await db.placement.findUnique({
    where: { id: placementId },
    include: { consultant: true, client: true },
  });
  if (!placement) return { error: CONFIRM_FOUT.match };

  // --- a) uren vastleggen ------------------------------------------------
  const invoer: ConfirmInboxRaw = {
    placementId,
    weekStart,
    kilometers: tekst(formData, "kilometers"),
    overtimeHours: tekst(formData, "overtimeHours"),
    hours: [0, 1, 2, 3, 4, 5, 6].map((i) => tekst(formData, `hours_${i}`)),
  };
  const bevestigd = await confirmInboxItem({ id: inboxId, ...invoer });

  const waarschuwingen: string[] = [];
  let timesheetId: string;
  /** Is er tegen een AL BESTAANDE urenstaat doorgewerkt? Dan meldt het scherm dat. */
  let hergebruikt = false;

  if (bevestigd.ok) {
    timesheetId = bevestigd.timesheetId;
    if (bevestigd.kmSource === "factuur") {
      waarschuwingen.push(
        "De kilometers stonden niet op de urenstaat en zijn overgenomen van zijn eigen factuur.",
      );
    }
  } else if (bevestigd.error === "exists") {
    // Er lag al een urenstaat voor deze plaatsing + week. Niet doodlopen: als er
    // nog niets gefactureerd is loopt de rest van het akkoord gewoon door tegen
    // die bestaande urenstaat.
    const hergebruik = await hergebruikBestaandeUrenstaat({ inboxId, raw: invoer, placement });
    if (!hergebruik.ok) return hergebruik.state;
    timesheetId = hergebruik.timesheetId;
    hergebruikt = true;
    waarschuwingen.push(...hergebruik.waarschuwingen);
  } else {
    return { error: CONFIRM_FOUT[bevestigd.error] };
  }

  // De bedragen komen uit de vastgelegde urenstaat — dezelfde functie waarmee
  // invoicing.ts de factuurregels bouwt, dus het scherm en de factuur kloppen.
  const urenstaat = await db.timesheet.findUnique({
    where: { id: timesheetId },
    include: { entries: true },
  });
  const geld = urenstaat
    ? computeTimesheetMoney(
        {
          entries: urenstaat.entries,
          overtimeHours: urenstaat.overtimeHours,
          kilometers: urenstaat.kilometers,
        },
        placement,
      )
    : null;

  // --- b) zijn factuur als inkoop registreren ----------------------------
  let ontvangenFactuurId: string | null = null;
  if (formData.get("factuurAanwezig") === "on") {
    const bedrag = parseBedrag(tekst(formData, "factuurBedrag"));
    if (bedrag === null || bedrag <= 0) {
      waarschuwingen.push(
        "Zijn factuur is niet geregistreerd: er stond geen leesbaar bedrag in. Registreer 'm los bij Ontvangen facturen.",
      );
    } else {
      try {
        const btw = parseBedrag(tekst(formData, "factuurBtw"));
        const km = parseBedrag(tekst(formData, "factuurKilometers"));
        const created = await db.receivedInvoice.create({
          data: {
            consultantId: placement.consultantId,
            number: tekst(formData, "factuurNummer") || null,
            issueDate: parseDatum(tekst(formData, "factuurDatum")),
            periodStart: parseDatum(tekst(formData, "factuurPeriodeStart")),
            periodEnd: parseDatum(tekst(formData, "factuurPeriodeEind")),
            amount: bedrag,
            vatAmount: btw !== null && btw > 0 ? btw : null,
            kilometers: km !== null && km > 0 ? km : null,
            notes: tekst(formData, "factuurNotities") || null,
            // Een mens heeft hem hierboven naast de uren gelegd en akkoord gegeven.
            status: "APPROVED",
            fileName: tekst(formData, "factuurBestand") || null,
            originalName: tekst(formData, "factuurBestandsnaam") || null,
            mimeType: tekst(formData, "factuurMime") || null,
            size: Number(tekst(formData, "factuurGrootte")) || null,
          },
        });
        ontvangenFactuurId = created.id;
      } catch (e) {
        waarschuwingen.push(
          `Zijn factuur kon niet geregistreerd worden (${
            e instanceof Error ? e.message : "onbekende fout"
          }). De uren staan er wel — registreer de factuur los bij Ontvangen facturen.`,
        );
      }
    }
  } else {
    waarschuwingen.push(
      "Er is nog geen factuur van de freelancer aangeleverd — de inkoop van deze week staat dus nog open.",
    );
  }

  // --- c) verkoopfactuur als CONCEPT -------------------------------------
  let verkoopFactuurId: string | null = null;
  let verkoopFactuurNummer: string | null = null;
  if (!placement.clientId) {
    waarschuwingen.push(
      "Deze plaatsing heeft geen klant, dus er is geen verkoopfactuur gemaakt. Koppel eerst een bedrijf aan de plaatsing.",
    );
  } else {
    try {
      const res = await createSalesInvoice({
        clientId: placement.clientId,
        timesheetIds: [timesheetId],
        issueDate: new Date(),
        notes: null,
      });
      if (res.ok) {
        verkoopFactuurId = res.invoiceId;
        const factuur = await db.invoice.findUnique({
          where: { id: res.invoiceId },
          select: { number: true },
        });
        verkoopFactuurNummer = factuur?.number ?? null;
      } else {
        waarschuwingen.push(`De verkoopfactuur is niet gemaakt: ${res.error}`);
      }
    } catch (e) {
      waarschuwingen.push(
        `De verkoopfactuur is niet gemaakt (${e instanceof Error ? e.message : "onbekende fout"}). De uren staan wel vast.`,
      );
    }
  }

  revalidatePath("/verwerken/nieuw");
  revalidatePath("/verwerken/week");
  revalidatePath("/verwerken/controle");
  revalidatePath("/inbox");
  revalidatePath("/uren");
  revalidatePath("/ontvangen-facturen");
  revalidatePath("/facturen");
  revalidatePath("/verzenden");
  revalidatePath("/", "layout");

  // Werd er tegen een bestaande urenstaat doorgewerkt, dan komt hij hier VERS
  // terug — inclusief of hij nu (na het factureren hierboven) nog weg mag.
  const bestaand = hergebruikt
    ? ((await beschrijfBestaandeUrenstaat(timesheetId, placement)) ?? undefined)
    : undefined;

  const inkoop = parseBedrag(tekst(formData, "inkoopBedrag"));
  return {
    bestaand,
    resultaat: {
      consultantNaam: `${placement.consultant.firstName} ${placement.consultant.lastName}`,
      klantNaam: placement.client?.companyName ?? null,
      weekLabel: urenstaat ? formatWeekLabel(urenstaat.weekStart) : "",
      uren: geld?.hours ?? 0,
      verkoop: geld?.sell.total ?? 0,
      inkoop: inkoop ?? geld?.buy.total ?? null,
      marge: geld === null ? null : round2(geld.sell.total - (inkoop ?? geld.buy.total)),
      urenstaatId: timesheetId,
      verkoopFactuurNummer,
      verkoopFactuurId,
      ontvangenFactuurId,
      waarschuwingen,
    },
  };
}

/** "YYYY-MM-DD" → Date (lokale middernacht); alles anders → null. */
function parseDatum(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
