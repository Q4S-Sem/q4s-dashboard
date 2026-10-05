import { db } from "@/lib/db";
import { renderQ4sEmail, renderQ4sEmailText, sendMail, type EmailContent } from "@/lib/email";
import { getWeekOverview, resolveWeek } from "@/lib/facturatie-week";
import { DEADLINE_LABEL } from "@/lib/facturatie-checks";
import { getCompanySettings, type CompanySettings } from "@/lib/settings";

// ---------------------------------------------------------------------------
// Automatische herinnering aan freelancers die na de deadline (dinsdag 12:00)
// nog NIETS hebben ingeleverd. Staat standaard UIT (CompanySettings
// .timesheetReminderEnabled); één knop op Week verwerken zet hem aan.
// Per persoon per week hooguit één mail (TimesheetHerinnering @@unique).
// ---------------------------------------------------------------------------

export const HERINNERING_AFZENDER = "Q4S Administratie <admin@q4s.nl>";

/** De mail zelf — puur, zodat het voorbeeld en de echte mail gelijk zijn. */
export function herinneringMail(
  args: { voornaam: string; isoWeek: number; bereik: string; isZZP: boolean },
  settings: Pick<CompanySettings, "companyName" | "email" | "phone" | "website">,
): { subject: string; content: EmailContent } {
  const stukken = args.isZZP ? "je timesheet en factuur" : "je timesheet";
  const subject = `Herinnering: ${args.isZZP ? "timesheet en factuur" : "timesheet"} week ${args.isoWeek}`;
  return {
    subject,
    content: {
      kicker: "Herinnering",
      heading: `Week ${args.isoWeek} — we missen nog ${stukken}`,
      greeting: `Hoi ${args.voornaam || "daar"},`,
      paragraphs: [
        `Kun je z.s.m. ${stukken} van week ${args.isoWeek} (${args.bereik}) naar ons opsturen? Dan kunnen wij alles snel verwerken${args.isZZP ? " en je factuur op tijd betalen" : ""}.`,
        "Je kunt ze gewoon als antwoord op deze mail sturen, of naar admin@q4s.nl.",
        "Heb je ze net verstuurd? Dan kun je deze mail negeren.",
      ],
      summary: [
        { label: "Week", value: `${args.isoWeek} (${args.bereik})` },
        { label: "Deadline", value: DEADLINE_LABEL },
        { label: "Nodig", value: args.isZZP ? "Timesheet + factuur" : "Timesheet" },
      ],
      footerLines: [
        settings.companyName || "Q4S",
        [settings.email, settings.phone, settings.website].filter(Boolean).join("  ·  "),
      ].filter((r) => r && r.trim()),
    },
  };
}

export type HerinneringResultaat = {
  aan: boolean;
  week: string | null;
  verstuurd: string[];
  overgeslagen: string[];
};

/** Stuur de herinneringen voor de laatste week waarvan de deadline voorbij is. */
export async function stuurTimesheetHerinneringen(now: Date = new Date()): Promise<HerinneringResultaat> {
  const settings = await getCompanySettings();
  if (!settings.timesheetReminderEnabled) return { aan: false, week: null, verstuurd: [], overgeslagen: [] };

  const vorige = new Date(now);
  vorige.setDate(vorige.getDate() - 7);
  const week = resolveWeek(null, vorige);
  if (now.getTime() <= week.deadline.getTime()) return { aan: true, week: week.key, verstuurd: [], overgeslagen: [] };

  const { rows } = await getWeekOverview(week.key, now);
  const teLaat = rows.filter((r) => r.status === "NIET_INGELEVERD" && !r.wachtkamerSinds);
  const al = await db.timesheetHerinnering.findMany({
    where: { weekKey: week.key, consultantId: { in: teLaat.map((r) => r.consultantId) } },
    select: { consultantId: true },
  });
  const gehad = new Set(al.map((h) => h.consultantId));
  const personen = await db.consultant.findMany({
    where: { id: { in: teLaat.map((r) => r.consultantId) } },
    select: { id: true, firstName: true, email: true },
  });

  const verstuurd: string[] = [];
  const overgeslagen: string[] = [];
  for (const r of teLaat) {
    if (gehad.has(r.consultantId)) continue;
    const p = personen.find((x) => x.id === r.consultantId);
    const email = p?.email?.trim();
    if (!email) {
      overgeslagen.push(`${r.naam}: geen e-mailadres`);
      continue;
    }
    const { subject, content } = herinneringMail(
      { voornaam: p?.firstName ?? "", isoWeek: week.isoWeek, bereik: week.bereik, isZZP: r.isZZP },
      settings,
    );
    const res = await sendMail({
      to: email,
      from: HERINNERING_AFZENDER,
      subject,
      html: renderQ4sEmail(content),
      text: renderQ4sEmailText(content),
    });
    if (!res.ok) {
      overgeslagen.push(`${r.naam}: ${res.error ?? "versturen mislukt"}`);
      continue;
    }
    // Ook bij een gesimuleerde verzending (geen SMTP) vastleggen: anders spamt
    // de eerste echte run iedereen voor oude weken.
    await db.timesheetHerinnering.create({ data: { consultantId: r.consultantId, weekKey: week.key, email } });
    verstuurd.push(r.naam);
  }
  return { aan: true, week: week.key, verstuurd, overgeslagen };
}
