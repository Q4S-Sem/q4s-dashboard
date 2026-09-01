import { db } from "./db";
import { formatWeekLabel, startOfISOWeek } from "./utils";
import { getCompanySettings } from "./settings";
import {
  findMissingTimesheets,
  type ActivePlacementRef,
  type MissingTimesheetsResult,
} from "./facturatie-detecties";
import { buildReminderEmail } from "./herinner-mail";
import type { EmailContent } from "./email";

// ---------------------------------------------------------------------------
// "Wie moet er nog inleveren, en wat mailen we die mensen?" — de data-laag onder
// de herinnerknop op /verwerken/week en /verwerken/wachtkamer.
//
// Hier wordt uit Prisma opgehaald wat de pure functies nodig hebben:
//   - welke week het overzicht behandelt (focusWeekVan),
//   - wie er een actieve plaatsing heeft en wie er al iets instuurde
//     (ontbrekendeWeekstaten → findMissingTimesheets, #3), en
//   - het e-mailadres van die mensen plus de bedrijfsgegevens voor de footer
//     (herinneringenVoor → buildReminderEmail → EmailContent).
//
// ALLEEN LEZEN: dit bestand verstuurt niets, zet niets klaar en wijzigt niets.
// Verzenden (of klaarzetten zonder SMTP) doet sendMail uit src/lib/email.ts,
// aangeroepen vanuit de server-action — dat blijft de enige uitgang. De lijst
// wordt bewust HIER opnieuw bepaald, zodat de knop nooit afgaat op wat de
// browser meestuurt.
// ---------------------------------------------------------------------------

/** Eén persoon die een herinnering krijgt, mail en al klaargezet. */
export type HerinneringOntvanger = {
  consultantId: string;
  naam: string;
  /** Het e-mailadres; null = niet bekend, dan kan er niets weg. */
  to: string | null;
  subject: string;
  /** De inhoud in de bestaande Q4S-mailopmaak (renderQ4sEmail). */
  content: EmailContent;
};

/** De rijen van het weekoverzicht, teruggebracht tot de week waar ze over gaan. */
type WeekRef = { weekStart: Date | null };

/**
 * De week waar de weekverwerking over gaat: de nieuwste week die nog openstaat,
 * en anders gewoon de lopende week. Zo klopt de "ontbreekt nog"-strip ook in een
 * database waarin de laatste weekstaten van vorige maand zijn.
 *
 * PUUR: het "nu" komt er van buiten in, zodat het scherm en de knop op hetzelfde
 * moment op dezelfde week uitkomen.
 */
export function focusWeekVan(
  review: { needsReview: WeekRef[]; autoApprove: WeekRef[] },
  nu: Date,
): Date {
  const tijden = [...review.needsReview, ...review.autoApprove]
    .map((r) => r.weekStart?.getTime())
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  return tijden.length > 0 ? new Date(Math.max(...tijden)) : startOfISOWeek(nu);
}

/**
 * Wie heeft een actieve plaatsing maar leverde voor deze week nog niets in?
 * Ingeleverd = een inbox-item voor die week dat niet is afgewezen, óf een
 * urenstaat die er voor die week al staat. Het tellen zelf doet de pure
 * findMissingTimesheets (#3).
 */
export async function ontbrekendeWeekstaten(focusWeek: Date): Promise<{
  weekStart: Date;
  weekLabel: string;
  ontbreekt: MissingTimesheetsResult;
}> {
  const [actievePlaatsingen, inboxDezeWeek, urenDezeWeek] = await Promise.all([
    db.placement.findMany({
      where: { status: "ACTIVE" },
      select: { consultantId: true, consultant: { select: { firstName: true, lastName: true } } },
      orderBy: [{ startDate: "asc" }],
    }),
    db.timesheetInbox.findMany({
      where: { extractedWeekStart: focusWeek, status: { not: "REJECTED" } },
      select: { consultantId: true },
    }),
    db.timesheet.findMany({
      where: { weekStart: focusWeek },
      select: { placement: { select: { consultantId: true } } },
    }),
  ]);

  const plaatsingRefs: ActivePlacementRef[] = actievePlaatsingen.map((p) => ({
    consultantId: p.consultantId,
    consultantName: `${p.consultant.firstName} ${p.consultant.lastName}`,
  }));

  return {
    weekStart: focusWeek,
    weekLabel: formatWeekLabel(focusWeek),
    ontbreekt: findMissingTimesheets({
      activePlacements: plaatsingRefs,
      submittedConsultantIds: [
        ...inboxDezeWeek.map((i) => i.consultantId ?? ""),
        ...urenDezeWeek.map((t) => t.placement.consultantId),
      ],
    }),
  };
}

/**
 * Zet voor elk van deze mensen een PERSOONLIJKE herinnering klaar: de pure
 * tekstbouwer levert de inhoud, en die gaat één keer om naar de bestaande
 * Q4S-mailopmaak (EmailContent → renderQ4sEmail), precies zoals de mail bij een
 * afwijkende week dat doet.
 *
 * Iemand zonder e-mailadres krijgt gewoon een regel met `to: null`; de
 * server-action telt die als overgeslagen. Eén query voor alle adressen, één
 * keer de bedrijfsinstellingen — ook als het er dertig zijn.
 */
export async function herinneringenVoor(
  personen: { consultantId: string; naam: string }[],
  weekLabel: string,
  deadlineHint?: string | null,
): Promise<HerinneringOntvanger[]> {
  const ids = [
    ...new Set(
      personen
        .map((p) => (typeof p?.consultantId === "string" ? p.consultantId.trim() : ""))
        .filter(Boolean),
    ),
  ];
  if (ids.length === 0) return [];

  const [consultants, settings] = await Promise.all([
    db.consultant.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    getCompanySettings(),
  ]);
  const perId = new Map(consultants.map((c) => [c.id, c]));

  const footerLines = [
    settings.companyName || "Q4S",
    [settings.email, settings.phone, settings.website].filter(Boolean).join("  ·  "),
  ].filter((regel) => regel && regel.trim());

  const gezien = new Set<string>();
  const ontvangers: HerinneringOntvanger[] = [];

  for (const persoon of personen) {
    const id = typeof persoon?.consultantId === "string" ? persoon.consultantId.trim() : "";
    // Iemand met twee plaatsingen krijgt één mail, niet twee.
    if (id === "" || gezien.has(id)) continue;
    gezien.add(id);

    const consultant = perId.get(id);
    const naam = consultant
      ? `${consultant.firstName} ${consultant.lastName}`.trim()
      : persoon.naam.trim();
    const mail = buildReminderEmail({ freelancerName: naam, weekLabel, deadlineHint });

    ontvangers.push({
      consultantId: id,
      naam,
      to: consultant?.email?.trim() || null,
      subject: mail.subject,
      content: {
        kicker: "Herinnering",
        heading: mail.subject,
        greeting: mail.greeting,
        // De ondertekening staat al in de template (Met vriendelijke groet —
        // Team Q4S), dus mail.signature gaat hier bewust niet nogmaals mee.
        paragraphs: mail.bodyLines,
        summary: weekLabel ? [{ label: "Week", value: weekLabel }] : [],
        footerLines,
      },
    });
  }

  return ontvangers;
}
