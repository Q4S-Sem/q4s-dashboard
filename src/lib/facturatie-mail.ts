import { db } from "./db";
import { getCompanySettings } from "./settings";
import { buildFreelancerDiscrepancyEmail, type FreelancerDiscrepancyEmail } from "./freelancer-mail";
import { getWeekDossier } from "./facturatie-week";
import { formatHours, round2 } from "./utils";
import type { EmailContent } from "./email";

// ---------------------------------------------------------------------------
// "Concept-mail naar <naam>" — de data-laag onder
// /facturatie/[placementId]/[week]/mail.
//
// Het dossier weet al precies wat er mis is (de controle-machine), dus die
// bevindingen gaan hier 1-op-1 de mail in. De TEKST komt uit de bestaande pure
// bouwer `buildFreelancerDiscrepancyEmail` (src/lib/freelancer-mail.ts) en de
// opmaak uit de bestaande Q4S-template (renderQ4sEmail), zodat het voorbeeld op
// het scherm letterlijk de mail is die straks de deur uit gaat.
//
// ALLEEN LEZEN: hier wordt niets verstuurd en niets gewijzigd. Versturen doet
// `sendMail` vanuit de server-action, ná een expliciete klik van een mens.
// ---------------------------------------------------------------------------

export type FacturatieMailVoorbeeld = {
  placementId: string;
  weekKey: string;
  naam: string;
  weekLabel: string;
  /** Het e-mailadres; null = niet bekend, dan kan er niets weg. */
  to: string | null;
  consultantId: string;
  subject: string;
  mail: FreelancerDiscrepancyEmail;
  content: EmailContent;
  /** TimesheetInbox.id, om de week daarna in de wachtkamer te kunnen zetten. */
  inboxId: string | null;
  receivedInvoiceId: string | null;
  eerderGemaildOp: Date | null;
  geparkeerdSinds: Date | null;
  /** De reden die bij het parkeren wordt vastgelegd. */
  wachtkamerReden: string;
};

/**
 * Stel de concept-mail over deze week samen. Geeft `null` als de week niet
 * bestaat. De bevindingen zijn precies de fouten en waarschuwingen die het
 * dossier toont — geen tweede, afwijkende lijst.
 */
export async function facturatieMailVoorbeeld(
  placementId: string,
  weekKey: string,
  eigenNotitie: string | null,
): Promise<FacturatieMailVoorbeeld | null> {
  const dossier = await getWeekDossier(placementId, weekKey);
  if (!dossier) return null;
  const { row, checks, comparison, geld } = dossier;

  const [consultant, settings, factuur] = await Promise.all([
    db.consultant.findUnique({
      where: { id: row.consultantId },
      select: { firstName: true, lastName: true, email: true },
    }),
    getCompanySettings(),
    row.receivedInvoiceId
      ? db.receivedInvoice.findUnique({
          where: { id: row.receivedInvoiceId },
          select: { id: true, number: true, discrepancyMailedAt: true },
        })
      : Promise.resolve(null),
  ]);

  // Wat er op de factuur staat tegenover wat wij verwachten — dezelfde getallen
  // als de vergelijkingstabel, zodat de mail en het scherm niet uiteenlopen.
  const urenRij = comparison.find((r) => r.key === "uren");
  const tariefRij = comparison.find((r) => r.key === "uurtarief");
  const getalVan = (waarde: string | null): number | null => {
    if (!waarde) return null;
    const n = Number(waarde.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const factuurBedrag = getalVan(dossier.invoer.factuurBedrag);
  const factuurBtw = getalVan(dossier.invoer.factuurBtw);
  const factuurExBtw =
    factuurBedrag === null
      ? null
      : factuurBtw !== null && factuurBtw > 0
        ? round2(factuurBedrag - factuurBtw)
        : factuurBedrag;

  const bevindingen = checks
    .filter((c) => c.level === "error" || c.level === "warn")
    .map((c) => `${c.title} — ${c.detail}`);

  const mail = buildFreelancerDiscrepancyEmail({
    freelancerName: row.naam,
    weekLabel: dossier.week.label,
    invoiceNumber: factuur?.number ?? dossier.invoer.factuurNummer ?? null,
    hoursTimesheet: getalVan(urenRij?.timesheet ?? null),
    hoursInvoice: getalVan(urenRij?.invoice ?? null),
    expectedAmount: geld?.inkoop ?? null,
    invoiceAmount: factuurExBtw,
    expectedRate: getalVan(tariefRij?.contract ?? null),
    impliedRate: getalVan(tariefRij?.invoice ?? null),
    kmInfo:
      dossier.invoer.kilometers
        ? `${formatHours(getalVan(dossier.invoer.kilometers) ?? 0)} km gemeld op de weekstaat`
        : null,
    autoFlags: bevindingen,
    eigenNotitie,
  });

  // De blokken onder de tekst als alinea's — de bestaande Q4S-template kent
  // alleen alinea's + een samenvattingstabel, en die hergebruiken we bewust.
  const blokken = mail.sections.flatMap((sectie) => [
    `${sectie.title}:`,
    ...sectie.lines.map((regel) => (sectie.quoted ? `“${regel}”` : `• ${regel}`)),
  ]);

  const content: EmailContent = {
    kicker: "Week verwerken",
    heading: mail.subject,
    greeting: mail.greeting,
    // De ondertekening staat al in de template (Met vriendelijke groet — Team Q4S).
    paragraphs: [...mail.bodyLines, ...blokken],
    summary: mail.summary,
    footerLines: [
      settings.companyName || "Q4S",
      [settings.email, settings.phone, settings.website].filter(Boolean).join("  ·  "),
    ].filter((regel) => regel && regel.trim()),
  };

  return {
    placementId,
    weekKey: dossier.week.key,
    naam: row.naam,
    weekLabel: dossier.week.label,
    to: consultant?.email?.trim() || null,
    consultantId: row.consultantId,
    subject: mail.subject,
    mail,
    content,
    inboxId: row.inboxId,
    receivedInvoiceId: factuur?.id ?? null,
    eerderGemaildOp: factuur?.discrepancyMailedAt ?? null,
    geparkeerdSinds: row.wachtkamerSinds,
    wachtkamerReden: `gemaild over ${dossier.week.label.toLowerCase()} — wacht op een reactie of gecorrigeerde stukken`,
  };
}
