import { db } from "./db";
import { formatCurrency, formatDate, round2 } from "./utils";
import type { InvoiceDoc } from "./invoice-pdf";
import { renderQ4sEmail, renderQ4sEmailText, type EmailContent } from "./email";
import type { CompanySettings } from "./settings";

// Structural input shapes (decoupled from Prisma's generated types — any query
// that includes these fields is assignable).
type Line = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  weekNumber?: number | null;
  location?: string | null;
  lineKind?: string | null;
};

type SalesInvoiceFull = {
  number: string;
  issueDate: Date;
  dueDate: Date;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes: string | null;
  subject: string | null;
  services: string | null;
  ourReference: string | null;
  purchaseOrder: string | null;
  lines: Line[];
  client: {
    companyName: string;
    contactName: string | null;
    email: string | null;
    invoiceEmail: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    country: string;
    vatNumber: string | null;
    paymentTermDays: number;
  };
};

type PurchaseInvoiceFull = {
  number: string;
  issueDate: Date;
  dueDate: Date;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  notes: string | null;
  lines: Line[];
  consultant: {
    firstName: string;
    lastName: string;
    email: string | null;
    companyName: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    country: string | null;
    vatNumber: string | null;
    iban: string | null;
  };
};

function compact(items: (string | null | undefined)[]): string[] {
  return items.filter((x): x is string => Boolean(x && x.trim()));
}

function companyBlock(s: CompanySettings) {
  return {
    name: s.companyName || "Q4S",
    addressLines: compact([
      s.address,
      [s.postalCode, s.city].filter(Boolean).join(" "),
      s.country,
    ]),
    contactLines: compact([s.phone ? `Tel: ${s.phone}` : "", s.website, s.email]),
    iban: s.iban || "",
    bic: s.bic || "",
    vatNumber: s.vatNumber || "",
    kvkNumber: s.kvkNumber || "",
    gAccount: s.gAccount || "",
  };
}

/** Bouw de tabelregels in het Q4S-format (REF/AMOUNT/…/TOTAL) uit factuurregels. */
function toInvoiceRows(lines: Line[]) {
  return lines.map((l, i) => ({
    ref: String(i + 1).padStart(2, "0"),
    amount: l.quantity,
    description: l.description,
    week: l.weekNumber ?? null,
    location: l.location ?? null,
    unitPrice: l.unitPrice,
    total: l.amount,
  }));
}

function companyFooterLines(s: CompanySettings): string[] {
  return compact([
    s.companyName || "Q4S",
    [s.address, [s.postalCode, s.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    [s.email, s.phone, s.website].filter(Boolean).join("  ·  "),
  ]);
}

const fileSafe = (s: string) => s.replace(/[^\w.-]+/g, "-");

// ---------------------------------------------------------------------------
// Sales (verkoop) → client
// ---------------------------------------------------------------------------

export function salesInvoiceDoc(inv: SalesInvoiceFull, s: CompanySettings): InvoiceDoc {
  const c = inv.client;
  const hasHours = inv.lines.some(
    (l) => l.lineKind === "HOURS" || /\b(uur|uren|hour|hours)\b/i.test(l.description),
  );
  return {
    docTitle: "Factuur",
    language: "nl",
    number: inv.number,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    subject: inv.subject,
    services: inv.services,
    ourReference: inv.ourReference,
    purchaseOrder: inv.purchaseOrder,
    company: companyBlock(s),
    recipientLabel: "Aan:",
    recipientName: c.companyName,
    recipientLines: compact([
      c.address,
      [c.postalCode, c.city].filter(Boolean).join(" "),
      c.country,
      c.contactName ? `T.a.v. ${c.contactName}` : "",
      c.invoiceEmail?.trim() || c.email?.trim() || "",
      c.vatNumber ? `BTW: ${c.vatNumber}` : "",
    ]),
    lines: toInvoiceRows(inv.lines),
    vatRate: inv.vatRate,
    subtotal: inv.subtotal,
    vatAmount: inv.vatAmount,
    total: inv.total,
    attachmentNote: hasHours ? "Ondertekende urenstaten bijgevoegd" : null,
    footerLines: [
      `Gelieve het totaalbedrag binnen ${c.paymentTermDays} dagen te voldoen.`,
      "Vermeld het factuurnummer bij de betaling.",
      s.invoiceFooter || "",
    ].filter(Boolean),
    notes: inv.notes,
  };
}

/**
 * Een VOORBEELD-verkoopfactuur met de echte Q4S-opmaak (companyBlock uit de
 * bedrijfsgegevens) + fictieve regels. Voor de live preview op Instellingen en
 * Factuur importeren — geen echte klantdata, puur om te tonen hoe de factuur
 * eruitziet. Verandert er iets bij de bedrijfsgegevens, dan verandert dit mee.
 */
export function sampleInvoiceDoc(s: CompanySettings): InvoiceDoc {
  const issueDate = new Date();
  const dueDate = new Date(issueDate.getTime() + (s.defaultPaymentTermDays || 30) * 86_400_000);
  const lines: Line[] = [
    { description: "Totaal uren R. van Son", quantity: 51, unitPrice: 90, amount: 4590, weekNumber: 27, location: "Sif Group HKW8", lineKind: "HOURS" },
    { description: "Kilometers", quantity: 516, unitPrice: 0.4, amount: 206.4, weekNumber: 27, location: "Sif Group HKW8", lineKind: "KM" },
    { description: "Totaal uren R. van Son", quantity: 45, unitPrice: 90, amount: 4050, weekNumber: 28, location: "Sif Group HKW8", lineKind: "HOURS" },
    { description: "Kilometers", quantity: 430, unitPrice: 0.4, amount: 172, weekNumber: 28, location: "Sif Group HKW8", lineKind: "KM" },
  ];
  const subtotal = round2(lines.reduce((n, l) => n + l.amount, 0));
  const vatRate = s.defaultVatRate ?? 21;
  const vatAmount = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vatAmount);
  return {
    docTitle: "Factuur",
    language: "nl",
    number: `${s.invoicePrefix || ""}2026112`,
    issueDate,
    dueDate,
    subject: "R. van Son",
    services: "QC Inspector",
    ourReference: null,
    purchaseOrder: null,
    company: companyBlock(s),
    recipientLabel: "Aan:",
    recipientName: "Sif Netherlands B.V.",
    recipientLines: [
      "P.O Box 522",
      "6040 AM Roermond",
      "Nederland",
      "T.a.v. Mevr. J. van den Borne",
      "invoiceonly@sif-group.com",
    ],
    lines: toInvoiceRows(lines),
    vatRate,
    subtotal,
    vatAmount,
    total,
    attachmentNote: "Ondertekende urenstaten bijgevoegd",
    footerLines: [
      "Gelieve het totaalbedrag binnen 30 dagen te voldoen.",
      "Vermeld het factuurnummer bij de betaling.",
      s.invoiceFooter || "",
    ].filter(Boolean),
    notes: null,
  };
}

export function salesEmailContent(inv: SalesInvoiceFull, s: CompanySettings): EmailContent {
  const c = inv.client;
  const naam = c.contactName || c.companyName;
  return {
    kicker: "Factuur",
    heading: `Factuur ${inv.number}`,
    greeting: `Beste ${naam},`,
    paragraphs: compact([
      `Hierbij ontvangt u factuur ${inv.number} voor de door Q4S geleverde diensten. De factuur vindt u als PDF in de bijlage.`,
      s.iban
        ? `Wij verzoeken u vriendelijk het totaalbedrag van ${formatCurrency(inv.total)} binnen ${c.paymentTermDays} dagen te voldoen op ${s.iban} o.v.v. factuurnummer ${inv.number}.`
        : `Wij verzoeken u vriendelijk het totaalbedrag van ${formatCurrency(inv.total)} binnen ${c.paymentTermDays} dagen te voldoen o.v.v. factuurnummer ${inv.number}.`,
      inv.notes,
    ]),
    summary: [
      { label: "Factuurnummer", value: inv.number },
      { label: "Factuurdatum", value: formatDate(inv.issueDate) },
      { label: "Vervaldatum", value: formatDate(inv.dueDate) },
      { label: "Totaal incl. BTW", value: formatCurrency(inv.total) },
    ],
    footerLines: companyFooterLines(s),
    attachmentNote: "De factuur is als PDF bijgevoegd bij deze e-mail.",
  };
}

// ---------------------------------------------------------------------------
// Purchase (inkoop, self-billing) → consultant/medewerker
// ---------------------------------------------------------------------------

export function purchaseInvoiceDoc(inv: PurchaseInvoiceFull, s: CompanySettings): InvoiceDoc {
  const p = inv.consultant;
  const name = `${p.firstName} ${p.lastName}`;
  return {
    docTitle: "Inkoopfactuur",
    language: "nl",
    number: inv.number,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    subject: name,
    services: null,
    ourReference: null,
    purchaseOrder: null,
    company: companyBlock(s),
    recipientLabel: "Aan:",
    recipientName: p.companyName || name,
    recipientLines: compact([
      p.companyName ? name : "",
      p.address,
      [p.postalCode, p.city].filter(Boolean).join(" "),
      p.country,
      p.vatNumber ? `BTW: ${p.vatNumber}` : "",
      p.iban ? `IBAN: ${p.iban}` : "",
    ]),
    lines: toInvoiceRows(inv.lines),
    vatRate: inv.vatRate,
    subtotal: inv.subtotal,
    vatAmount: inv.vatAmount,
    total: inv.total,
    attachmentNote: null,
    footerLines: compact([
      p.iban
        ? `Het totaalbedrag wordt door Q4S overgemaakt op ${p.iban} o.v.v. ${inv.number}.`
        : `Self-billing inkoopfactuur, opgesteld door Q4S namens ${name}.`,
      s.invoiceFooter || "",
    ]),
    notes: inv.notes,
  };
}

export function purchaseEmailContent(inv: PurchaseInvoiceFull, s: CompanySettings): EmailContent {
  const p = inv.consultant;
  return {
    kicker: "Inkoopfactuur",
    heading: `Inkoopfactuur ${inv.number}`,
    greeting: `Beste ${p.firstName},`,
    paragraphs: compact([
      `Hierbij ontvang je inkoopfactuur ${inv.number} voor de door jou gewerkte uren. De factuur vind je als PDF in de bijlage.`,
      p.iban
        ? `Het totaalbedrag van ${formatCurrency(inv.total)} wordt door Q4S overgemaakt op ${p.iban} o.v.v. ${inv.number}.`
        : `Het totaalbedrag van ${formatCurrency(inv.total)} wordt door Q4S aan je overgemaakt o.v.v. ${inv.number}.`,
      inv.notes,
    ]),
    summary: [
      { label: "Factuurnummer", value: inv.number },
      { label: "Datum", value: formatDate(inv.issueDate) },
      { label: "Totaal incl. BTW", value: formatCurrency(inv.total) },
    ],
    footerLines: companyFooterLines(s),
    attachmentNote: "De factuur is als PDF bijgevoegd bij deze e-mail.",
  };
}

// ---------------------------------------------------------------------------
// Unified "send data" — everything an action or the preview needs.
// ---------------------------------------------------------------------------

export type SendData = {
  to: string | null;
  recipientName: string;
  subject: string;
  content: EmailContent;
  html: string;
  text: string;
  pdfDoc: InvoiceDoc;
  pdfName: string;
};

export function salesSendData(inv: SalesInvoiceFull, s: CompanySettings): SendData {
  const content = salesEmailContent(inv, s);
  return {
    to: inv.client.invoiceEmail?.trim() || inv.client.email?.trim() || null,
    recipientName: inv.client.companyName,
    subject: `Factuur ${inv.number} — ${s.companyName || "Q4S"}`,
    content,
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
    pdfDoc: salesInvoiceDoc(inv, s),
    pdfName: `factuur-${fileSafe(inv.number)}.pdf`,
  };
}

export function purchaseSendData(inv: PurchaseInvoiceFull, s: CompanySettings): SendData {
  const content = purchaseEmailContent(inv, s);
  return {
    to: inv.consultant.email?.trim() || null,
    recipientName: `${inv.consultant.firstName} ${inv.consultant.lastName}`,
    subject: `Inkoopfactuur ${inv.number} — ${s.companyName || "Q4S"}`,
    content,
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
    pdfDoc: purchaseInvoiceDoc(inv, s),
    pdfName: `inkoopfactuur-${fileSafe(inv.number)}.pdf`,
  };
}

// ---------------------------------------------------------------------------
// Outbox — the verzendmap listing.
// ---------------------------------------------------------------------------

export type OutboxRow = {
  id: string;
  number: string;
  total: number;
  issueDate: Date;
  recipientName: string;
  email: string | null;
  fixHref: string; // where to add a missing e-mail address
  /** Weken (maandag "YYYY-MM-DD") die deze factuur dekt — voor de week-filter. */
  weekKeys: string[];
};

/** Lokale maandag-sleutel "YYYY-MM-DD" van een weekStart. */
function weekKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function weeksOf(lines: { timesheet: { weekStart: Date } | null }[]): string[] {
  const set = new Set<string>();
  for (const l of lines) if (l.timesheet) set.add(weekKey(new Date(l.timesheet.weekStart)));
  return [...set];
}

export async function getOutbox(): Promise<{ sales: OutboxRow[]; purchase: OutboxRow[] }> {
  const [sales, purchase] = await Promise.all([
    db.invoice.findMany({
      where: { status: "DRAFT" },
      orderBy: { issueDate: "asc" },
      include: {
        client: {
          select: { id: true, companyName: true, email: true, invoiceEmail: true },
        },
        lines: { select: { timesheet: { select: { weekStart: true } } } },
      },
    }),
    db.purchaseInvoice.findMany({
      where: { sentAt: null, status: { notIn: ["CANCELLED", "PAID"] } },
      orderBy: { issueDate: "asc" },
      include: {
        consultant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lines: { select: { timesheet: { select: { weekStart: true } } } },
      },
    }),
  ]);

  return {
    sales: sales.map((inv) => ({
      id: inv.id,
      number: inv.number,
      total: inv.total,
      issueDate: inv.issueDate,
      recipientName: inv.client.companyName,
      email: inv.client.invoiceEmail?.trim() || inv.client.email?.trim() || null,
      fixHref: `/klanten/${inv.client.id}`,
      weekKeys: weeksOf(inv.lines),
    })),
    purchase: purchase.map((inv) => ({
      id: inv.id,
      number: inv.number,
      total: inv.total,
      issueDate: inv.issueDate,
      recipientName: `${inv.consultant.firstName} ${inv.consultant.lastName}`,
      email: inv.consultant.email?.trim() || null,
      fixHref: `/werknemers/${inv.consultant.id}`,
      weekKeys: weeksOf(inv.lines),
    })),
  };
}

/**
 * Gedeelde weergave-filter voor de verzendmap. De pagina, de tellingen én de
 * bulk-verzendactie draaien allemaal dit predicaat, zodat "wat je ziet" en "wat
 * je verstuurt" altijd identiek zijn. `q` matcht op factuurnummer, ontvanger
 * (klant of medewerker) en e-mailadres — hoofdletterongevoelig.
 */
export function matchOutbox(row: OutboxRow, filter: { week?: string; q?: string }): boolean {
  if (filter.week && !row.weekKeys.includes(filter.week)) return false;
  const q = filter.q?.trim().toLowerCase();
  if (q) {
    const hay = `${row.number} ${row.recipientName} ${row.email ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
