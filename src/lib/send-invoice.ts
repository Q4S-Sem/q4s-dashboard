import { db } from "./db";
import { getCompanySettings } from "./settings";
import { sendMail } from "./email";
import { renderInvoicePdf } from "./invoice-pdf";
import { salesSendData, type SendData } from "./verzenden";
import { readInboxBuffer } from "./uploads";

/**
 * De verzendkern: PDF renderen, mailen en de factuur atomair
 * "claimen" zodat er nooit twee keer dezelfde mail uitgaat. Hier gehaald uit
 * /verzenden/actions.ts zodat de bulkknoppen op /facturen exact DEZELFDE
 * verzendsemantiek gebruiken — geen tweede, afwijkende verzendweg.
 */

const salesInclude = { client: true, lines: true } as const;


export type SendOutcome = "sent" | "simulated" | "no-email" | "error" | "already" | "uit";

/**
 * Hoofdschakelaar: er gaat (nog) GEEN facturatie-mail naar klanten — geen
 * verkoopfactuur en geen betalingsherinnering. Facturen maken, downloaden en zelf
 * versturen kan gewoon. Op `false` zetten zodra jullie live willen mailen.
 */
export const KLANTMAIL_UIT = true;

/** De ingescande urenstaten van de weken op deze factuur — die moet de klant erbij hebben. */
export async function timesheetBijlagen(invoiceId: string) {
  const regels = await db.invoiceLine.findMany({
    where: { invoiceId, timesheetId: { not: null } },
    select: { timesheetId: true },
  });
  const ids = [...new Set(regels.map((r) => r.timesheetId!))];
  if (ids.length === 0) return [];
  const scans = await db.timesheetInbox.findMany({
    where: { timesheetId: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: { id: true, timesheetId: true, fileName: true, originalName: true, mimeType: true },
  });
  // Eén scan per week (de nieuwste).
  return [...new Map(scans.map((s) => [s.timesheetId, s])).values()].reverse();
}

/** Compose the PDF + mail and hand it to the transport (real send or simulated). */
async function dispatch(data: SendData, invoiceId?: string): Promise<SendOutcome> {
  if (!data.to) return "no-email";
  const pdf = await renderInvoicePdf(data.pdfDoc);
  const urenstaten = invoiceId ? await timesheetBijlagen(invoiceId) : [];
  const extra = await Promise.all(
    urenstaten.map(async (s) => ({
      filename: `timesheet-${s.originalName}`,
      content: await readInboxBuffer(s.fileName),
      contentType: s.mimeType || "application/octet-stream",
    })),
  );
  const res = await sendMail({
    handmatig: true, // na klik van een gebruiker
    to: data.to,
    subject: data.subject,
    html: data.html,
    text: data.text,
    attachments: [
      { filename: data.pdfName, content: Buffer.from(pdf), contentType: "application/pdf" },
      ...extra,
    ],
  });
  if (!res.ok) return "error";
  return res.simulated ? "simulated" : "sent";
}

/** Verstuur één verkoopfactuur naar de klant. */
export async function sendSalesInvoiceById(id: string): Promise<SendOutcome> {
  if (KLANTMAIL_UIT) return "uit";
  const [inv, settings] = await Promise.all([
    db.invoice.findUnique({ where: { id }, include: salesInclude }),
    getCompanySettings(),
  ]);
  if (!inv) return "error";
  const data = salesSendData(inv, settings);
  if (!data.to) return "no-email";

  // Atomically claim the row BEFORE dispatching: only one request can flip
  // READY -> SENT, so a concurrent double-send (double-click, or a single
  // "Versturen" overlapping with "Verstuur alles") can't e-mail twice. Alleen
  // vrijgegeven facturen (READY) mogen de deur uit — concepten niet.
  const claimed = await db.invoice.updateMany({
    where: { id, status: "READY" },
    data: { status: "SENT", sentAt: new Date(), sentTo: data.to },
  });
  if (claimed.count === 0) return "already";

  const outcome = await dispatch(data, id);
  if (outcome === "error") {
    // Mislukt verstuurd → de claim vrijgeven zodat hij weer op READY staat.
    await db.invoice.updateMany({
      where: { id, status: "SENT", sentTo: data.to },
      data: { status: "READY", sentAt: null, sentTo: null },
    });
  }
  return outcome;
}
