import { db } from "./db";
import { round2 } from "./utils";
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

export type SalesInvoiceFull = {
  number: string;
  issueDate: Date;
  dueDate: Date;
  vatRate: number;
  vatReverseCharge?: boolean;
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
    kvkNumber?: string | null;
    paymentTermDays: number;
  };
};


function compact(items: (string | null | undefined)[]): string[] {
  return items.filter((x): x is string => Boolean(x && x.trim()));
}

/** Vaste Q4S-gegevens op elke factuur; een ingevuld veld bij Instellingen wint. */
export const Q4S_FACTUUR = {
  name: "Q4S B.V.",
  address: "Arnhemseweg 12",
  postalCode: "2994 LA",
  city: "Barendrecht",
  country: "The Netherlands",
  iban: "NL96INGB0007873625",
  bic: "INGBNL2A",
  vatNumber: "NL857718137B01",
  kvkNumber: "69073287",
  gAccount: "NL94INGB0990303241",
  phone: "+31(0) 85 782 6818",
  website: "www.q4s.nl",
  email: "info@q4s.nl",
};

function companyBlock(s: CompanySettings) {
  const v = (x: string | null | undefined, d: string) => (x && x.trim() ? x.trim() : d);
  const Q = Q4S_FACTUUR;
  // "Q4S" en "Nederland" zijn de lege standaardwaarden van de instellingen.
  const name = !s.companyName || s.companyName === "Q4S" ? Q.name : s.companyName;
  const country = !s.country || /^(nederland|nl)$/i.test(s.country) ? Q.country : s.country;
  return {
    name,
    addressLines: [v(s.address, Q.address), `${v(s.postalCode, Q.postalCode)} ${v(s.city, Q.city)}`, country],
    contactLines: [`Tel: ${v(s.phone, Q.phone)}`, v(s.website, Q.website), v(s.email, Q.email)],
    iban: v(s.iban, Q.iban),
    bic: v(s.bic, Q.bic),
    vatNumber: v(s.vatNumber, Q.vatNumber),
    kvkNumber: v(s.kvkNumber, Q.kvkNumber),
    gAccount: v(s.gAccount, Q.gAccount),
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
    docTitle: "Invoice",
    language: "en",
    number: inv.number,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    subject: inv.subject,
    services: inv.services,
    ourReference: inv.ourReference,
    purchaseOrder: inv.purchaseOrder,
    company: companyBlock(s),
    recipientLabel: "To:",
    recipientName: c.companyName,
    recipientLines: compact([
      c.contactName ? `Attention: ${c.contactName}` : "",
      c.address,
      [c.postalCode, c.city].filter(Boolean).join(" "),
      c.country && !/^(nl|nederland|netherlands|the netherlands)$/i.test(c.country) ? c.country : "",
      inv.purchaseOrder ? `Reference no.: ${inv.purchaseOrder}` : "",
      c.invoiceEmail?.trim() || c.email?.trim() || "",
    ]),
    // Rechts tegenover de klant: KvK/BTW van de KLANT (zoals op het Q4S-format).
    recipientKvk: c.kvkNumber ?? null,
    recipientVat: c.vatNumber ?? null,
    lines: toInvoiceRows(inv.lines),
    vatRate: inv.vatRate,
    vatReverseCharge: inv.vatReverseCharge ?? false,
    // Eén vermelding: de totaalregel "VAT reverse-charged" (Engelse factuur, geen NL/wetsartikel).
    vatNote: null,
    subtotal: inv.subtotal,
    vatAmount: inv.vatAmount,
    total: inv.total,
    attachmentNote: hasHours ? "Signed timesheets attached" : null,
    footerLines: [],
    paymentBox: [
      "We kindly request you to transfer the amount within the agreed payment term.",
      "Kindly quote the invoice number with your payment.",
    ],
    closing: {
      company: s.companyName || "Q4S B.V.",
      line: "Thank you for your business — we appreciate the continued cooperation.",
    },
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
    { description: "Total hours R. van Son", quantity: 51, unitPrice: 90, amount: 4590, weekNumber: 27, location: "Sif Group HKW8", lineKind: "HOURS" },
    { description: "Kilometres", quantity: 516, unitPrice: 0.4, amount: 206.4, weekNumber: 27, location: "Sif Group HKW8", lineKind: "KM" },
    { description: "Total hours R. van Son", quantity: 45, unitPrice: 90, amount: 4050, weekNumber: 28, location: "Sif Group HKW8", lineKind: "HOURS" },
    { description: "Kilometres", quantity: 430, unitPrice: 0.4, amount: 172, weekNumber: 28, location: "Sif Group HKW8", lineKind: "KM" },
  ];
  const subtotal = round2(lines.reduce((n, l) => n + l.amount, 0));
  const vatRate = s.defaultVatRate ?? 21;
  const vatAmount = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vatAmount);
  return {
    docTitle: "Invoice",
    language: "en",
    number: `${s.invoicePrefix || ""}2026112`,
    issueDate,
    dueDate,
    subject: "R. van Son",
    services: "QC Inspector",
    ourReference: null,
    purchaseOrder: null,
    company: companyBlock(s),
    recipientLabel: "To:",
    recipientName: "Sif Netherlands B.V.",
    recipientLines: [
      "Attention: Ms. J. van den Borne",
      "P.O Box 522",
      "6040 AM Roermond",
      "invoiceonly@sif-group.com",
    ],
    recipientKvk: "13041437",
    recipientVat: "NL8011.36.282.B01",
    lines: toInvoiceRows(lines),
    vatRate,
    subtotal,
    vatAmount,
    total,
    attachmentNote: "Signed timesheets attached",
    footerLines: [],
    paymentBox: [
      "We kindly request you to transfer the amount within the agreed payment term.",
      "Kindly quote the invoice number with your payment.",
    ],
    closing: {
      company: s.companyName || "Q4S B.V.",
      line: "Thank you for your business — we appreciate the continued cooperation.",
    },
    notes: null,
  };
}

export function salesEmailContent(inv: SalesInvoiceFull, s: CompanySettings): EmailContent {
  // Alleen tekst + de factuur als PDF-bijlage, in het Engels (net als de factuur zelf).
  return {
    lang: "en",
    kicker: "Invoice",
    heading: `Invoice ${inv.number}`,
    greeting: "Dear financial administration,",
    paragraphs: compact([
      `Please find attached invoice ${inv.number}${inv.subject ? ` for the services of ${inv.subject}` : ""}.`,
      `We kindly request you to transfer the amount within the agreed payment term, stating invoice number ${inv.number}. If you have any questions about this invoice, simply reply to this e-mail.`,
      inv.notes,
    ]),
    summary: [],
    footerLines: companyFooterLines(s),
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
    subject: `Invoice ${inv.number} — ${s.companyName || "Q4S"}`,
    content,
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
    pdfDoc: salesInvoiceDoc(inv, s),
    pdfName: `invoice-${fileSafe(inv.number)}.pdf`,
  };
}

/** Voorbeeldmail (fictieve factuur, zelfde regels als sampleInvoiceDoc) — om de opmaak te bekijken. */
export function sampleSalesSendData(s: CompanySettings): SendData {
  const doc = sampleInvoiceDoc(s);
  const inv: SalesInvoiceFull = {
    number: doc.number,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    vatRate: doc.vatRate,
    subtotal: doc.subtotal,
    vatAmount: doc.vatAmount,
    total: doc.total,
    notes: null,
    subject: doc.subject,
    services: doc.services,
    ourReference: null,
    purchaseOrder: null,
    lines: [27, 28].map((w) => ({ description: "", quantity: 0, unitPrice: 0, amount: 0, weekNumber: w })),
    client: {
      companyName: "Sif Netherlands B.V.",
      contactName: "mevrouw Van den Borne",
      email: null,
      invoiceEmail: null,
      address: null,
      postalCode: null,
      city: null,
      country: "NL",
      vatNumber: null,
      paymentTermDays: s.defaultPaymentTermDays || 30,
    },
  };
  const content = salesEmailContent(inv, s);
  return {
    to: null,
    recipientName: inv.client.companyName,
    subject: `Invoice ${inv.number} — ${s.companyName || "Q4S"}`,
    content,
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
    pdfDoc: doc,
    pdfName: `invoice-${fileSafe(inv.number)}.pdf`,
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

export async function getOutbox(): Promise<{ sales: OutboxRow[] }> {
  // Alleen wat expliciet is VRIJGEGEVEN naar de verzendmap (READY). Concepten
  // (DRAFT) blijven in "Verkoopfacturen" staan om eerst na te kijken; pas na de
  // knop "Naar verzendmap" komt een factuur hier klaar om te versturen.
  const sales = await db.invoice.findMany({
    where: { status: "READY" },
    orderBy: { issueDate: "asc" },
    include: {
      client: {
        select: { id: true, companyName: true, email: true, invoiceEmail: true },
      },
      lines: { select: { timesheet: { select: { weekStart: true } } } },
    },
  });

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
