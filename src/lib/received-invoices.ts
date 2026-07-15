import { db } from "./db";
import { round2, formatCurrency, formatDate, formatWeekLabel } from "./utils";
import { computeTimesheetMoney } from "./toeslag";
import { getCompanySettings } from "./settings";
import { sendMail, renderQ4sEmail, renderQ4sEmailText, type EmailContent } from "./email";

// Inkomende facturen die geplaatste ZZP'ers zelf naar Q4S sturen (ReceivedInvoice)
// worden hier gecontroleerd tegen de timesheets van diezelfde persoon in dezelfde
// periode: klopt het gefactureerde bedrag met uren × inkooptarief (+ toeslagen/km)?
// Zo maken we geen fouten aan beide kanten vóór uitbetaling.

export type ExpectedForPeriod = {
  weeks: number;
  hours: number;
  subtotal: number; // ex BTW (inkoop, uit de timesheets)
  vatAmount: number;
  total: number; // incl BTW
};

/**
 * Wat Q4S deze persoon over deze periode zou moeten betalen op basis van de
 * timesheets (uren × inkooptarief + toeslagen/km, incl. BTW). Weken die de periode
 * (deels) overlappen tellen mee.
 */
export async function expectedForConsultantPeriod(
  consultantId: string,
  start: Date,
  end: Date,
  vatRate: number,
): Promise<ExpectedForPeriod> {
  // Een weekstaat telt mee o.b.v. z'n maandag (weekStart) in de periode → elke week
  // hoort bij precies één periode, dus geen dubbeltelling over de maandgrens. DRAFT
  // (nog niet ingediende, incomplete) weken tellen niet mee met "verwacht".
  const timesheets = await db.timesheet.findMany({
    where: {
      placement: { consultantId },
      status: { not: "DRAFT" },
      weekStart: { gte: start, lte: end },
    },
    include: { entries: true, placement: true },
  });

  let hours = 0;
  let subtotal = 0;
  for (const t of timesheets) {
    const m = computeTimesheetMoney(
      { entries: t.entries, overtimeHours: t.overtimeHours, kilometers: t.kilometers },
      t.placement,
    );
    hours = round2(hours + m.hours);
    subtotal = round2(subtotal + m.buy.total);
  }
  const vatAmount = round2((subtotal * vatRate) / 100);
  return { weeks: timesheets.length, hours, subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

export type TimesheetWeekRow = {
  timesheetId: string;
  weekLabel: string;
  clientName: string;
  hours: number;
  buyTotal: number; // uren × inkooptarief (+ toeslagen/km), ex BTW
};

/** De losse weekstaten (urenstaat) achter het verwachte bedrag — voor de
 *  vergelijking urenstaat ↔ factuur op de detailpagina, met links naar elke week. */
export async function timesheetWeeksForPeriod(
  consultantId: string,
  start: Date,
  end: Date,
): Promise<TimesheetWeekRow[]> {
  const timesheets = await db.timesheet.findMany({
    where: { placement: { consultantId }, status: { not: "DRAFT" }, weekStart: { gte: start, lte: end } },
    include: { entries: true, placement: { include: { client: { select: { companyName: true } } } } },
    orderBy: { weekStart: "asc" },
  });
  return timesheets.map((t) => {
    const m = computeTimesheetMoney(
      { entries: t.entries, overtimeHours: t.overtimeHours, kilometers: t.kilometers },
      t.placement,
    );
    return {
      timesheetId: t.id,
      weekLabel: formatWeekLabel(t.weekStart),
      clientName: t.placement.client.companyName,
      hours: m.hours,
      buyTotal: m.buy.total,
    };
  });
}

export type ReceivedRow = {
  id: string;
  consultantId: string;
  consultantName: string;
  email: string | null;
  number: string | null;
  issueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  amount: number; // gefactureerd incl BTW
  status: string;
  hasFile: boolean;
  mailed: boolean; // is de medewerker al gemaild over de afwijking?
  mailedAt: Date | null;
  expected: ExpectedForPeriod | null;
  diff: number | null; // gefactureerd − verwacht
  matched: boolean | null; // binnen tolerantie
};

/**
 * In welke betaal-bucket valt deze factuur? Elke factuur zit in precies één bucket.
 * `matched` (live berekend t.o.v. de timesheets) is leidend — niet de opgeslagen
 * status — zodat een factuur die weer klopt automatisch naar "te betalen" schuift
 * en een betaalde factuur nooit terugvalt naar een afwijking:
 *   - PAID              → "betaald"      (eindstation)
 *   - matched === false → "afwijking"    (wacht op een aangepaste factuur)
 *   - matched === null  → "controleren"  (geen periode → nog niet vergeleken, niet zomaar betalen)
 *   - matched === true  → "tebetalen"    (klopt met de urenstaat → op tijd betalen)
 */
export type ReceivedBucket = "betaald" | "afwijking" | "controleren" | "tebetalen";

export function receivedBucket(r: Pick<ReceivedRow, "status" | "matched">): ReceivedBucket {
  if (r.status === "PAID") return "betaald";
  if (r.matched === false) return "afwijking";
  if (r.matched == null) return "controleren";
  return "tebetalen";
}

/** Wacht deze factuur op een aangepaste factuur (afwijking, nog niet betaald)? */
export function isAwaitingCorrection(r: Pick<ReceivedRow, "status" | "matched">): boolean {
  return receivedBucket(r) === "afwijking";
}

/** Vaste tolerantie (€1): alleen afrondingsverschillen mogen door; een hele extra
 *  uur (minstens ± €30) valt er altijd buiten en wordt dus als afwijking gemeld. */
const TOLERANCE_EUR = 1;

/**
 * Beste match tussen het gefactureerde bedrag en de timesheet-berekening —
 * BTW-bewust. De ZZP'er kan factureren incl. 21% BTW, of 0% (btw-verlegd/KOR/
 * kleineondernemersregeling), of met een eigen BTW-bedrag. We nemen de kleinste
 * afwijking van die interpretaties, zodat een correcte 0%-factuur niet vals als
 * afwijking wordt gemeld.
 */
function bestMatch(
  amount: number,
  vatAmount: number | null,
  expected: ExpectedForPeriod,
): { diff: number; matched: boolean } {
  const candidates = [amount - expected.total, amount - expected.subtotal];
  if (vatAmount != null) candidates.push(amount - vatAmount - expected.subtotal);
  let diff = candidates[0];
  for (const c of candidates) if (Math.abs(c) < Math.abs(diff)) diff = c;
  diff = round2(diff);
  return { diff, matched: Math.abs(diff) <= TOLERANCE_EUR };
}

export async function listReceivedInvoices(): Promise<ReceivedRow[]> {
  const settings = await getCompanySettings();
  const vatRate = settings.defaultVatRate ?? 21;

  const invoices = await db.receivedInvoice.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { consultant: { select: { firstName: true, lastName: true, email: true } } },
  });

  const rows: ReceivedRow[] = [];
  for (const inv of invoices) {
    let expected: ExpectedForPeriod | null = null;
    let diff: number | null = null;
    let matched: boolean | null = null;
    if (inv.periodStart && inv.periodEnd) {
      expected = await expectedForConsultantPeriod(inv.consultantId, inv.periodStart, inv.periodEnd, vatRate);
      const m = bestMatch(inv.amount, inv.vatAmount, expected);
      diff = m.diff;
      matched = m.matched;
    }
    rows.push({
      id: inv.id,
      consultantId: inv.consultantId,
      consultantName: `${inv.consultant.firstName} ${inv.consultant.lastName}`,
      email: inv.consultant.email,
      number: inv.number,
      issueDate: inv.issueDate,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      amount: inv.amount,
      status: inv.status,
      hasFile: Boolean(inv.fileName),
      mailed: Boolean(inv.discrepancyMailedAt),
      mailedAt: inv.discrepancyMailedAt,
      expected,
      diff,
      matched,
    });
  }
  return rows;
}

export type ReceivedSummary = {
  toPayCount: number; // klopt + onbetaald → op tijd betalen
  toPayAmount: number;
  awaitingCount: number; // afwijking → wacht op een aangepaste factuur
  awaitingAmount: number;
  checkCount: number; // geen periode → nog te controleren (niet zomaar betalen)
  checkAmount: number;
  paidCount: number;
  total: number;
};

/** Beknopte cijfers voor het dashboard + de statkaarten. Elke factuur telt in
 *  precies één bucket mee (zie {@link receivedBucket}), zodat de bedragen kloppen:
 *  alleen wat geverifieerd klopt komt in "te betalen (op tijd)". */
export async function receivedInvoicesSummary(): Promise<ReceivedSummary> {
  const rows = await listReceivedInvoices();
  const sum = (rs: ReceivedRow[]) => round2(rs.reduce((s, r) => s + r.amount, 0));
  const inBucket = (b: ReceivedBucket) => rows.filter((r) => receivedBucket(r) === b);
  const toPay = inBucket("tebetalen");
  const awaiting = inBucket("afwijking");
  const check = inBucket("controleren");
  return {
    toPayCount: toPay.length,
    toPayAmount: sum(toPay),
    awaitingCount: awaiting.length,
    awaitingAmount: sum(awaiting),
    checkCount: check.length,
    checkAmount: sum(check),
    paidCount: inBucket("betaald").length,
    total: rows.length,
  };
}

export type ReceivedDetail = ReceivedRow & {
  vatAmount: number | null;
  notes: string | null;
  originalName: string | null;
  mimeType: string | null;
  weeks: TimesheetWeekRow[]; // de urenstaat achter "verwacht", voor de vergelijking
};

/** Eén ontvangen factuur + reconciliatie, voor de detailpagina. */
export async function getReceivedDetail(id: string): Promise<ReceivedDetail | null> {
  const settings = await getCompanySettings();
  const vatRate = settings.defaultVatRate ?? 21;
  const inv = await db.receivedInvoice.findUnique({
    where: { id },
    include: { consultant: { select: { firstName: true, lastName: true, email: true } } },
  });
  if (!inv) return null;

  let expected: ExpectedForPeriod | null = null;
  let diff: number | null = null;
  let matched: boolean | null = null;
  let weeks: TimesheetWeekRow[] = [];
  if (inv.periodStart && inv.periodEnd) {
    [expected, weeks] = await Promise.all([
      expectedForConsultantPeriod(inv.consultantId, inv.periodStart, inv.periodEnd, vatRate),
      timesheetWeeksForPeriod(inv.consultantId, inv.periodStart, inv.periodEnd),
    ]);
    const m = bestMatch(inv.amount, inv.vatAmount, expected);
    diff = m.diff;
    matched = m.matched;
  }
  return {
    id: inv.id,
    consultantId: inv.consultantId,
    consultantName: `${inv.consultant.firstName} ${inv.consultant.lastName}`,
    email: inv.consultant.email,
    number: inv.number,
    issueDate: inv.issueDate,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    amount: inv.amount,
    status: inv.status,
    hasFile: Boolean(inv.fileName),
    mailed: Boolean(inv.discrepancyMailedAt),
    mailedAt: inv.discrepancyMailedAt,
    expected,
    diff,
    matched,
    vatAmount: inv.vatAmount,
    notes: inv.notes,
    originalName: inv.originalName,
    mimeType: inv.mimeType,
    weeks,
  };
}

// ---------------------------------------------------------------------------
// Mail de medewerker professioneel bij een afwijking
// ---------------------------------------------------------------------------

export type DiscrepancyMailResult = { ok: boolean; simulated: boolean; noEmail?: boolean; error?: string };

/**
 * Stuur de medewerker een nette, vriendelijke mail dat ons een klein verschil is
 * opgevallen tussen hun factuur en de urenregistratie, met het verzoek het na te
 * kijken. Gebruikt de standaard Q4S-mailopmaak; zonder SMTP wordt de mail
 * opgesteld maar niet echt verstuurd (simulated).
 */
export async function mailReceivedDiscrepancy(invoiceId: string): Promise<DiscrepancyMailResult> {
  const inv = await db.receivedInvoice.findUnique({
    where: { id: invoiceId },
    include: { consultant: { select: { firstName: true, email: true } } },
  });
  if (!inv) return { ok: false, simulated: false, error: "Onbekende factuur." };
  // Een al betaalde factuur nooit "heropenen": er valt niets meer te corrigeren en
  // we mogen de betaalde status niet omzetten (anders lijkt 'ie weer openstaand).
  if (inv.status === "PAID") return { ok: false, simulated: false, error: "Deze factuur is al betaald." };
  const to = inv.consultant.email?.trim() || null;
  if (!to) return { ok: false, simulated: false, noEmail: true, error: "Geen e-mailadres bekend." };
  if (!inv.periodStart || !inv.periodEnd) {
    return { ok: false, simulated: false, error: "Geen periode om tegen te vergelijken." };
  }

  const settings = await getCompanySettings();
  const vatRate = settings.defaultVatRate ?? 21;
  const expected = await expectedForConsultantPeriod(inv.consultantId, inv.periodStart, inv.periodEnd, vatRate);
  const { diff } = bestMatch(inv.amount, inv.vatAmount, expected);
  const nr = inv.number ? ` ${inv.number}` : "";

  const content: EmailContent = {
    kicker: "Controle op je factuur",
    heading: `Kleine controle op je factuur${nr}`,
    greeting: `Beste ${inv.consultant.firstName},`,
    paragraphs: [
      `Bedankt voor je factuur${nr}. Bij het verwerken is ons een klein verschil opgevallen tussen het gefactureerde bedrag en de bij ons geregistreerde uren over deze periode.`,
      `Volgens onze urenregistratie komen wij op ${formatCurrency(expected.total)} incl. btw, terwijl je factuur ${formatCurrency(inv.amount)} vermeldt — een verschil van ${formatCurrency(Math.abs(diff))}.`,
      `Waarschijnlijk gaat het om een kleine vergissing. Zou je het willen nakijken en ons zo nodig een aangepaste factuur sturen? Klopt onze registratie niet, laat het dan gerust weten — dan zoeken we het samen even uit.`,
    ],
    summary: [
      { label: "Factuurnummer", value: inv.number ?? "—" },
      { label: "Periode", value: `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}` },
      { label: "Jouw factuur", value: formatCurrency(inv.amount) },
      { label: "Volgens urenregistratie", value: formatCurrency(expected.total) },
      { label: "Verschil", value: formatCurrency(diff) },
    ],
    footerLines: [
      settings.companyName || "Q4S",
      [settings.email, settings.phone, settings.website].filter(Boolean).join("  ·  "),
    ].filter((l) => l && l.trim()),
  };

  const res = await sendMail({
    to,
    subject: `Kleine controle op je factuur${nr} — ${settings.companyName || "Q4S"}`,
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
  });
  if (res.ok) {
    // Alleen vastleggen dát we gemaild hebben. De afwijking-classificatie leunt op de
    // live timesheet-vergelijking (matched), niet op de status — zo schuift de factuur
    // automatisch naar "te betalen" zodra hij weer klopt, en raakt een betaalde factuur
    // nooit per ongeluk op "afwijking".
    await db.receivedInvoice
      .update({ where: { id: invoiceId }, data: { discrepancyMailedAt: new Date() } })
      .catch(() => {});
  }
  return { ok: res.ok, simulated: res.simulated, error: res.error };
}
