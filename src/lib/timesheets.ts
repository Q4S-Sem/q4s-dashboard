import { db } from "./db";
import { startOfISOWeek, formatWeekLabel } from "./utils";
import { getCompanySettings } from "./settings";
import { sendMail, renderQ4sEmail, renderQ4sEmailText, type EmailContent } from "./email";

// ---------------------------------------------------------------------------
// Timesheet-status: per week checken welke medewerkers hun urenstaat hebben
// ingeleverd, en wie er ontbreekt → herinnering sturen of zelf importeren.
// De inbox (src/app/(app)/inbox) is het aanleverpunt; deze module bepaalt de
// PRESENTIE per actieve plaatsing per week.
// ---------------------------------------------------------------------------

/** Maandag (00:00) van de week waarin `date` valt. */
export function weekMonday(date: Date): Date {
  return startOfISOWeek(date);
}

/** Maandag van de huidige ISO-week. */
export function currentWeekMonday(): Date {
  return startOfISOWeek(new Date());
}

/** Parse een `?week=YYYY-MM-DD` param naar de maandag van die week (of huidige week). */
export function parseWeekParam(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00`);
    // Format-geldig maar kalender-ongeldig (bv. 2026-13-40) → val terug op nu.
    if (!Number.isNaN(d.getTime())) return startOfISOWeek(d);
  }
  return currentWeekMonday();
}

/** `YYYY-MM-DD` van een maandag, voor gebruik in links. */
export function weekParam(monday: Date): string {
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type Presence = "RECEIVED" | "IN_INBOX" | "REMINDED" | "MISSING";

export type TimesheetStatusRow = {
  placementId: string;
  consultantId: string;
  consultantName: string;
  discipline: string | null;
  email: string | null;
  /** Gekoppelde eigen-medewerker (Employee) bij loondienst — dan beheer je alles
   *  in de Personeelsgegevens i.p.v. bij de werknemer/detachering. */
  employeeId: string | null;
  placementTitle: string;
  clientName: string;
  presence: Presence;
  timesheetId: string | null;
  timesheetStatus: string | null;
  reminderSentAt: Date | null;
  reminderSimulated: boolean;
};

export type TimesheetWeekStatus = {
  weekStart: Date;
  weekLabel: string;
  rows: TimesheetStatusRow[];
  summary: { expected: number; received: number; inInbox: number; reminded: number; missing: number };
};

/**
 * De presentie-status voor één week: elke ACTIEVE plaatsing die in die week
 * loopt, verwacht een weekstaat. Status = ontvangen (Timesheet bestaat) /
 * in inbox (nog te bevestigen) / herinnerd / ontbreekt.
 */
export async function timesheetWeekStatus(weekStart: Date): Promise<TimesheetWeekStatus> {
  const monday = startOfISOWeek(weekStart);
  const weekEnd = new Date(monday);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Plaatsingen die in deze week (deels) actief waren.
  const placements = await db.placement.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: weekEnd },
      OR: [{ endDate: null }, { endDate: { gte: monday } }],
      consultant: { active: true },
    },
    include: {
      consultant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          discipline: true,
          email: true,
          // Loondienst: het e-mailadres beheer je bij de medewerker (Personeels-
          // gegevens), niet bij de consultant. Neem dat over als het er is.
          employeeId: true,
          employee: { select: { email: true } },
        },
      },
      client: { select: { companyName: true } },
      timesheets: { where: { weekStart: monday }, select: { id: true, status: true } },
    },
    orderBy: [{ consultant: { lastName: "asc" } }],
  });

  const consultantIds = [...new Set(placements.map((p) => p.consultantId))];

  // Pending inbox-items (nog te bevestigen) voor deze week. Presentie is
  // PER PLAATSING: een item met een gekoppelde placementId telt alleen voor die
  // plaatsing; een item zonder placementId (bv. een medewerker met meerdere
  // plaatsingen, of AI uit) valt terug op consultant-niveau.
  const inboxItems = await db.timesheetInbox.findMany({
    where: {
      consultantId: { in: consultantIds },
      extractedWeekStart: monday,
      status: { in: ["NEW", "EXTRACTED"] },
    },
    select: { consultantId: true, placementId: true },
  });
  const inboxByPlacement = new Set(inboxItems.map((i) => i.placementId).filter(Boolean) as string[]);
  const inboxUnassignedConsultants = new Set(
    inboxItems.filter((i) => !i.placementId).map((i) => i.consultantId).filter(Boolean) as string[],
  );

  // Laatste herinnering per plaatsing (fallback: per medewerker) voor deze week.
  const reminders = await db.timesheetReminder.findMany({
    where: { consultantId: { in: consultantIds }, weekStart: monday },
    orderBy: { sentAt: "desc" },
    select: { consultantId: true, placementId: true, sentAt: true, simulated: true },
  });
  const reminderByPlacement = new Map<string, { sentAt: Date; simulated: boolean }>();
  const reminderByConsultant = new Map<string, { sentAt: Date; simulated: boolean }>();
  for (const r of reminders) {
    const val = { sentAt: r.sentAt, simulated: r.simulated };
    if (r.placementId) {
      if (!reminderByPlacement.has(r.placementId)) reminderByPlacement.set(r.placementId, val);
    } else if (!reminderByConsultant.has(r.consultantId)) {
      reminderByConsultant.set(r.consultantId, val);
    }
  }

  const rows: TimesheetStatusRow[] = placements.map((p) => {
    const ts = p.timesheets[0] ?? null;
    const inInbox = inboxByPlacement.has(p.id) || inboxUnassignedConsultants.has(p.consultantId);
    const reminder = reminderByPlacement.get(p.id) ?? reminderByConsultant.get(p.consultantId) ?? null;
    let presence: Presence;
    if (ts) presence = "RECEIVED";
    else if (inInbox) presence = "IN_INBOX";
    else if (reminder) presence = "REMINDED";
    else presence = "MISSING";
    return {
      placementId: p.id,
      consultantId: p.consultantId,
      consultantName: `${p.consultant.firstName} ${p.consultant.lastName}`,
      discipline: p.consultant.discipline,
      // Effectief adres: bij loondienst het medewerker-adres (Personeelsgegevens),
      // anders dat van de consultant (externe ZZP).
      email: p.consultant.employee?.email?.trim() || p.consultant.email?.trim() || null,
      employeeId: p.consultant.employeeId,
      placementTitle: p.title,
      clientName: p.client.companyName,
      presence,
      timesheetId: ts?.id ?? null,
      timesheetStatus: ts?.status ?? null,
      reminderSentAt: reminder?.sentAt ?? null,
      reminderSimulated: reminder?.simulated ?? false,
    };
  });

  const summary = {
    expected: rows.length,
    received: rows.filter((r) => r.presence === "RECEIVED").length,
    inInbox: rows.filter((r) => r.presence === "IN_INBOX").length,
    reminded: rows.filter((r) => r.presence === "REMINDED").length,
    missing: rows.filter((r) => r.presence === "MISSING").length,
  };

  return { weekStart: monday, weekLabel: formatWeekLabel(monday), rows, summary };
}

/**
 * Aantal openstaande inbox-items die nog niet aan een medewerker gekoppeld zijn
 * (bv. AI uit, of geen naam-match). Die kunnen niet aan een plaatsing worden
 * toegewezen, dus de statuspagina waarschuwt ervoor: iemand kan "ontbreken"
 * terwijl zijn staat ongekoppeld in de inbox ligt.
 */
export async function unlinkedInboxCount(): Promise<number> {
  return db.timesheetInbox.count({
    where: { status: { in: ["NEW", "EXTRACTED"] }, consultantId: null },
  });
}

export type UnlinkedInboxItem = {
  id: string;
  name: string; // uitgelezen naam, of anders de bestandsnaam
  originalName: string;
  source: string;
  status: string;
  weekStart: Date | null;
};

/** De concrete inbox-items die nog niet aan een medewerker gekoppeld zijn — dit
 *  is "wat je moet oppakken": elk item opent zijn bevestig-pagina (/inbox/[id]). */
export async function unlinkedInboxItems(): Promise<UnlinkedInboxItem[]> {
  const items = await db.timesheetInbox.findMany({
    where: { status: { in: ["NEW", "EXTRACTED"] }, consultantId: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      extractedName: true,
      originalName: true,
      source: true,
      status: true,
      extractedWeekStart: true,
    },
  });
  return items.map((it) => ({
    id: it.id,
    name: it.extractedName?.trim() || it.originalName,
    originalName: it.originalName,
    source: it.source,
    status: it.status,
    weekStart: it.extractedWeekStart,
  }));
}

// ---------------------------------------------------------------------------
// Herinnering-mail (standaard Q4S-opmaak)
// ---------------------------------------------------------------------------

function reminderContent(
  consultant: { firstName: string },
  weekLabel: string,
  footerLines: string[],
): EmailContent {
  return {
    kicker: "Herinnering",
    heading: `Je timesheet voor ${weekLabel}`,
    greeting: `Hoi ${consultant.firstName},`,
    paragraphs: [
      `Wij hebben je urenstaat (timesheet) voor ${weekLabel} nog niet ontvangen.`,
      `Zou je die zo snel mogelijk naar ons willen sturen, zodat wij je uren en uitbetaling op tijd kunnen verwerken? Je kunt hem mailen naar admin@q4s.nl.`,
      `Heb je hem al verstuurd? Dan hoef je niets te doen — dan hebben onze berichten elkaar gekruist.`,
    ],
    summary: [
      { label: "Week", value: weekLabel },
      { label: "Aanleveren via", value: "admin@q4s.nl" },
    ],
    footerLines,
  };
}

export type ReminderResult = {
  ok: boolean;
  simulated: boolean;
  noEmail?: boolean;
  error?: string;
};

/** Footer-regels voor de herinnering, uit de bedrijfsinstellingen. */
function footerFrom(settings: Awaited<ReturnType<typeof getCompanySettings>>): string[] {
  return [
    settings.companyName || "Q4S",
    [settings.email, settings.phone, settings.website].filter(Boolean).join("  ·  "),
  ].filter(Boolean);
}

/**
 * Stuur een herinnering dat de weekstaat nog niet binnen is. Alleen een ECHT
 * verstuurde mail (SMTP aan) wordt vastgelegd als TimesheetReminder — in
 * klaarzet-modus (geen SMTP) wordt de mail wél opgesteld maar niets weggeschreven,
 * zodat de persoon "ontbreekt" blijft en later echt herinnerd kan worden.
 * `settings` mag meegegeven worden om een N+1 in de bulk-actie te vermijden.
 */
export async function sendTimesheetReminder(
  consultantId: string,
  weekStart: Date,
  placementId?: string | null,
  settings?: Awaited<ReturnType<typeof getCompanySettings>>,
): Promise<ReminderResult> {
  const consultant = await db.consultant.findUnique({
    where: { id: consultantId },
    select: { firstName: true, lastName: true, email: true, employee: { select: { email: true } } },
  });
  if (!consultant) return { ok: false, simulated: false, error: "Onbekende medewerker." };

  // Loondienst: gebruik het e-mailadres uit de Personeelsgegevens; anders dat van
  // de consultant (externe ZZP).
  const to = consultant.employee?.email?.trim() || consultant.email?.trim() || null;
  if (!to) return { ok: false, simulated: false, noEmail: true, error: "Geen e-mailadres bekend." };

  const monday = startOfISOWeek(weekStart);
  const weekLabel = formatWeekLabel(monday);
  const s = settings ?? (await getCompanySettings());

  const content = reminderContent(consultant, weekLabel, footerFrom(s));
  const res = await sendMail({
    to,
    subject: `Herinnering: timesheet ${weekLabel} nog niet ontvangen — Q4S`,
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
  });

  // Alleen vastleggen bij een ECHTE verzending (niet gesimuleerd, niet gefaald),
  // zodat de presentie klopt met wat de medewerker daadwerkelijk ontving.
  if (res.ok && !res.simulated) {
    await db.timesheetReminder.create({
      data: { consultantId, placementId: placementId ?? null, weekStart: monday, sentTo: to, simulated: false },
    });
  }

  return { ok: res.ok, simulated: res.simulated, error: res.error };
}
