import { db } from "./db";
import { formatHours, round2, startOfISOWeek } from "./utils";
import { getCompanySettings } from "./settings";
import { timesheetGateReview, type GateReviewRow } from "./timesheet-gate-review";
import { detectDuplicates, type PriorInvoiceRef } from "./facturatie-detecties";
import {
  buildFreelancerDiscrepancyEmail,
  type FreelancerDiscrepancyEmail,
} from "./freelancer-mail";
import type { EmailContent } from "./email";

// ---------------------------------------------------------------------------
// "Mail de freelancer over deze week" — de data-laag onder
// /verwerken/week/[id]/mail.
//
// Hier wordt uit Prisma opgehaald wat de pure tekstbouwer
// (src/lib/freelancer-mail.ts) nodig heeft: de beoordeelde week zoals het
// weekoverzicht hem toont (timesheetGateReview), het e-mailadres van de
// medewerker, de factuur die hij zelf voor die week stuurde en de bedrijfs-
// gegevens voor de footer. Daarna wordt dat één keer omgezet naar de bestaande
// Q4S-mailopmaak (EmailContent → renderQ4sEmail), zodat het voorbeeld op het
// scherm letterlijk dezelfde mail is als wat er straks de deur uit gaat.
//
// ALLEEN LEZEN: dit bestand verstuurt niets, zet niets klaar en wijzigt niets.
// Verzenden (of klaarzetten zonder SMTP) doet sendMail uit src/lib/email.ts,
// aangeroepen vanuit de server-action — dat blijft de enige uitgang.
// ---------------------------------------------------------------------------

export type AfwijkingMail = {
  /** TimesheetInbox.id — dezelfde sleutel als de regel op het weekoverzicht. */
  inboxId: string;
  /** De gekoppelde medewerker — voor de link "vul een e-mailadres in". */
  consultantId: string | null;
  naam: string;
  weekLabel: string | null;
  /** Het e-mailadres van de medewerker; null = niet bekend, dan kan er niets weg. */
  to: string | null;
  subject: string;
  /** De opgebouwde inhoud (puur), voor het voorbeeld op het scherm. */
  mail: FreelancerDiscrepancyEmail;
  /** Diezelfde inhoud in de bestaande Q4S-mailopmaak. */
  content: EmailContent;
  /** De factuur die deze week beslaat, als de medewerker er zelf een stuurde. */
  receivedInvoiceId: string | null;
  receivedInvoiceNumber: string | null;
  /** Is er over déze factuur al eerder gemaild? */
  eerderGemaildOp: Date | null;
  /** Staat de week al in de wachtkamer? */
  geparkeerdSinds: Date | null;
  /** De reden die bij het parkeren wordt vastgelegd. */
  wachtkamerReden: string;
};

/**
 * Het bedrag van een ontvangen factuur EX btw, zodat het naast onze eigen
 * (ex btw) weekberekening gelegd mag worden. Staat het btw-bedrag erop, dan
 * trekken we dat eraf; anders rekenen we met het vastgelegde btw-tarief. Weten we
 * geen van beide, dan nemen we het bedrag zoals het er staat — de mail vergelijkt
 * dan wat er letterlijk op de factuur staat.
 */
function bedragExBtw(amount: number, vatAmount: number | null, vatRate: number | null): number {
  if (typeof vatAmount === "number" && Number.isFinite(vatAmount)) {
    return round2(amount - vatAmount);
  }
  if (typeof vatRate === "number" && Number.isFinite(vatRate) && vatRate > 0) {
    return round2(amount / (1 + vatRate / 100));
  }
  return round2(amount);
}

/** De week waar een factuurperiode in valt — dezelfde koppeling als /verwerken/week. */
function weekVan(datum: Date | null): Date | null {
  return datum ? startOfISOWeek(datum) : null;
}

/**
 * Stel de mail over één afwijkende week samen: ophalen, door de pure bouwer
 * halen en in de Q4S-opmaak zetten. Geeft `null` als de week niet (meer) op het
 * weekoverzicht of in de wachtkamer staat — dan is er niets om over te mailen.
 */
export async function afwijkingMailVoorbeeld(
  inboxId: string,
  eigenNotitie: string | null,
): Promise<AfwijkingMail | null> {
  const id = String(inboxId ?? "").trim();
  if (!id) return null;

  const { needsReview, wachtkamer } = await timesheetGateReview();
  const row: GateReviewRow | undefined =
    needsReview.find((r) => r.id === id) ?? wachtkamer.find((w) => w.row.id === id)?.row;
  if (!row) return null;

  const [consultant, settings, ontvangen] = await Promise.all([
    row.consultantId
      ? db.consultant.findUnique({
          where: { id: row.consultantId },
          select: { firstName: true, lastName: true, email: true },
        })
      : Promise.resolve(null),
    getCompanySettings(),
    row.consultantId
      ? db.receivedInvoice.findMany({
          where: { consultantId: row.consultantId },
          select: {
            id: true,
            number: true,
            amount: true,
            vatAmount: true,
            vatRate: true,
            periodStart: true,
            discrepancyMailedAt: true,
          },
          orderBy: [{ createdAt: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  // De factuur die déze week beslaat — precies de koppeling die het weekoverzicht
  // ook maakt (maandag van de factuurperiode = maandag van de weekstaat).
  const factuur = row.weekStart
    ? (ontvangen.find((inv) => weekVan(inv.periodStart)?.getTime() === row.weekStart!.getTime()) ??
      null)
    : null;

  // #8 Dubbele factuur — dezelfde detectie als op het weekoverzicht, zodat de
  // freelancer exact leest wat HR op het scherm zag.
  const eerdere: PriorInvoiceRef[] = factuur
    ? ontvangen
        .filter((inv) => inv.id !== factuur.id)
        .map((inv) => ({ number: inv.number, amount: inv.amount, weekStart: weekVan(inv.periodStart) }))
    : [];
  const dubbel = factuur
    ? detectDuplicates({
        invoiceNumber: factuur.number,
        invoiceAmount: factuur.amount,
        weekStart: row.weekStart,
        priorInvoices: eerdere,
      })
    : { flags: [] };

  const factuurBedrag = factuur
    ? bedragExBtw(factuur.amount, factuur.vatAmount, factuur.vatRate)
    : null;
  // Zonder plaatsing is er geen tarief en dus geen verwacht bedrag: dan liever
  // niets noemen dan "€ 0,00" beweren.
  const verwachtBedrag = row.placementId ? row.cost : null;
  const uurTariefFactuur =
    factuurBedrag !== null && row.totalHours != null && row.totalHours > 0
      ? round2(factuurBedrag / row.totalHours)
      : null;

  const mail = buildFreelancerDiscrepancyEmail({
    freelancerName: row.name,
    weekLabel: row.weekLabel ?? "",
    invoiceNumber: factuur?.number ?? null,
    hoursTimesheet: row.totalHours,
    // Een ontvangen factuur legt geen urenaantal vast; we beweren er dus geen.
    hoursInvoice: null,
    expectedAmount: verwachtBedrag,
    invoiceAmount: factuurBedrag,
    expectedRate: row.costRate,
    impliedRate: uurTariefFactuur,
    kmInfo:
      row.kilometers != null && row.kilometers > 0
        ? `${formatHours(row.kilometers)} km gemeld op de weekstaat`
        : null,
    autoFlags: [...row.flags.map((f) => f.message), ...dubbel.flags.map((f) => f.message)],
    eigenNotitie,
  });

  // De blokken onder de tekst als alinea's — de bestaande Q4S-template kent
  // alleen alinea's + een samenvattingstabel, en die hergebruiken we bewust.
  const blokken = mail.sections.flatMap((sectie) => [
    `${sectie.title}:`,
    ...sectie.lines.map((regel) => (sectie.quoted ? `“${regel}”` : `• ${regel}`)),
  ]);

  const content: EmailContent = {
    kicker: "Weekverwerking",
    heading: mail.subject,
    greeting: mail.greeting,
    // De ondertekening staat al in de template (Met vriendelijke groet — Team Q4S),
    // dus mail.signature gaat hier bewust niet nogmaals mee.
    paragraphs: [...mail.bodyLines, ...blokken],
    summary: mail.summary,
    footerLines: [
      settings.companyName || "Q4S",
      [settings.email, settings.phone, settings.website].filter(Boolean).join("  ·  "),
    ].filter((regel) => regel && regel.trim()),
  };

  return {
    inboxId: row.id,
    consultantId: row.consultantId,
    naam: row.name,
    weekLabel: row.weekLabel,
    to: consultant?.email?.trim() || null,
    subject: mail.subject,
    mail,
    content,
    receivedInvoiceId: factuur?.id ?? null,
    receivedInvoiceNumber: factuur?.number ?? null,
    eerderGemaildOp: factuur?.discrepancyMailedAt ?? null,
    geparkeerdSinds: row.wachtkamerSince,
    wachtkamerReden: `gemaild over ${row.weekLabel ?? "deze week"} — wacht op een reactie of een gecorrigeerde weekstaat`,
  };
}
