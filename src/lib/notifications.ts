import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Meldingencentrum. Aggregeert openstaande acties uit de hele back-office in
// één "activiteiten"-overzicht, gesplitst in Te laat / Vandaag / Later — net als
// het activiteiten-belletje in klassieke ERP's. Puur tellingen (geen zware
// joins), zodat dit goedkoop in de layout op elke pagina kan draaien.
// ---------------------------------------------------------------------------

export type NotifGroup = {
  /** Stabiele sleutel; de client kiest hierop het icoon. */
  key: string;
  label: string;
  /** Waar het rijtje naartoe linkt. */
  href: string;
  late: number;
  today: number;
  future: number;
};

export type Notifications = {
  groups: NotifGroup[];
  totalLate: number;
  totalToday: number;
  /** Rode-badge-getal: wat nú aandacht vraagt (te laat + vandaag). */
  urgent: number;
};

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export async function getNotifications(): Promise<Notifications> {
  const now = new Date();
  const startToday = dayStart(now);
  const endToday = addDays(startToday, 1); // exclusief
  const in30 = addDays(startToday, 30);
  const in90 = addDays(startToday, 90);
  const staleBefore = addDays(startToday, -7); // NEW-sollicitaties ouder dan 7 dagen

  const [
    // Agenda (geplande afspraken)
    agLate,
    agToday,
    agFuture,
    // Taken (nog niet afgerond)
    tkLate,
    tkToday,
    tkFuture,
    // Sollicitaties (nieuw binnengekomen)
    solLate,
    solToday,
    // Certificaten (verloop)
    certLate,
    certToday,
    certFuture,
    // Facturen (verzonden, nog niet betaald)
    facLate,
    facToday,
    facFuture,
    // Timesheet-inbox (te verwerken)
    inboxCount,
    // MSP-intake (ongelezen recruiter-meldingen)
    mspUnread,
  ] = await Promise.all([
    db.calendarEvent.count({ where: { status: "PLANNED", start: { lt: startToday } } }),
    db.calendarEvent.count({ where: { status: "PLANNED", start: { gte: startToday, lt: endToday } } }),
    db.calendarEvent.count({ where: { status: "PLANNED", start: { gte: endToday } } }),

    db.task.count({ where: { done: false, dueDate: { lt: startToday } } }),
    db.task.count({ where: { done: false, dueDate: { gte: startToday, lt: endToday } } }),
    db.task.count({
      where: { done: false, OR: [{ dueDate: { gte: endToday } }, { dueDate: null }] },
    }),

    db.application.count({ where: { status: "NEW", createdAt: { lt: staleBefore } } }),
    db.application.count({ where: { status: "NEW", createdAt: { gte: staleBefore } } }),

    db.certificate.count({ where: { expiryDate: { lt: startToday } } }),
    db.certificate.count({ where: { expiryDate: { gte: startToday, lt: in30 } } }),
    db.certificate.count({ where: { expiryDate: { gte: in30, lt: in90 } } }),

    db.invoice.count({
      where: { status: { in: ["SENT", "OVERDUE"] }, paidDate: null, dueDate: { lt: startToday } },
    }),
    db.invoice.count({
      where: {
        status: { in: ["SENT", "OVERDUE"] },
        paidDate: null,
        dueDate: { gte: startToday, lt: endToday },
      },
    }),
    db.invoice.count({
      where: { status: { in: ["SENT", "OVERDUE"] }, paidDate: null, dueDate: { gte: endToday } },
    }),

    db.timesheetInbox.count({ where: { status: { in: ["NEW", "EXTRACTED"] } } }),

    db.recruiterAlert.count({ where: { read: false } }),
  ]);

  const all: NotifGroup[] = [
    { key: "agenda", label: "Agenda", href: "/agenda", late: agLate, today: agToday, future: agFuture },
    { key: "taken", label: "Taken", href: "/agenda/taken", late: tkLate, today: tkToday, future: tkFuture },
    { key: "sollicitaties", label: "Sollicitaties", href: "/sollicitaties", late: solLate, today: solToday, future: 0 },
    { key: "certificeringen", label: "Certificaten", href: "/certificeringen", late: certLate, today: certToday, future: certFuture },
    { key: "facturen", label: "Facturen", href: "/facturen", late: facLate, today: facToday, future: facFuture },
    { key: "inbox", label: "Timesheet-inbox", href: "/inbox", late: 0, today: inboxCount, future: 0 },
    { key: "msp", label: "MSP-intake", href: "/msp", late: 0, today: mspUnread, future: 0 },
  ];

  // Alleen rijen tonen waar iets speelt.
  const groups = all.filter((g) => g.late + g.today + g.future > 0);
  const totalLate = groups.reduce((s, g) => s + g.late, 0);
  const totalToday = groups.reduce((s, g) => s + g.today, 0);

  return { groups, totalLate, totalToday, urgent: totalLate + totalToday };
}

// ---------------------------------------------------------------------------
// Openstaande acties per hub — voor het cijfer-badge op de app-launcher, zodat
// je in één oogopslag ziet wáár nog werk ligt. Puur afgeleid uit de al opgehaalde
// nav-badges + meldingen; geen extra database-queries.
// ---------------------------------------------------------------------------

export type NavBadges = {
  verwerken: number;
  facturen: number;
  inkoop: number;
  ontvangen: number;
  verzenden: number;
  teDoen: number;
};

/** Aantal openstaande actie-items per hub (sleutel = hub-href). Alleen hubs met
 *  een zinvolle telling staan erin; de rest krijgt geen badge. */
export function hubActionCounts(badges: NavBadges, notifs: Notifications): Record<string, number> {
  // Volledige werkvoorraad van een meldingengroep (te laat + vandaag + later).
  const all = (key: string) => {
    const g = notifs.groups.find((x) => x.key === key);
    return g ? g.late + g.today + g.future : 0;
  };
  // Alleen wat nú aandacht vraagt (te laat + vandaag) — voor tijdgevoelige items.
  const urgent = (key: string) => {
    const g = notifs.groups.find((x) => x.key === key);
    return g ? g.late + g.today : 0;
  };
  return {
    "/dashboard": badges.teDoen,
    // Facturatie: opeenvolgende stappen die op actie wachten (geen overlap).
    "/verwerken": badges.verwerken + badges.ontvangen + badges.verzenden + all("inbox"),
    // Personeelsgegevens: certificaten die (bijna) verlopen.
    "/klanten": urgent("certificeringen"),
    // Agenda: afspraken + taken die te laat zijn of vandaag spelen.
    "/agenda": urgent("agenda") + urgent("taken"),
    // Recruitment: nieuwe sollicitaties die opvolging nodig hebben.
    "/recruitment": all("sollicitaties"),
    // MSP: ongelezen intake-meldingen.
    "/msp": all("msp"),
  };
}
