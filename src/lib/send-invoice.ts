import { db } from "./db";
import { getCompanySettings } from "./settings";
import { sendMail } from "./email";
import { renderInvoicePdf } from "./invoice-pdf";
import { salesSendData, purchaseSendData, type SendData } from "./verzenden";

/**
 * De verzendkern van de verzendmap: PDF renderen, mailen en de factuur atomair
 * "claimen" zodat er nooit twee keer dezelfde mail uitgaat. Hier gehaald uit
 * /verzenden/actions.ts zodat de bulkknoppen op /facturen exact DEZELFDE
 * verzendsemantiek gebruiken — geen tweede, afwijkende verzendweg.
 */

const salesInclude = { client: true, lines: true } as const;
const purchaseInclude = { consultant: true, lines: true } as const;

export type SendOutcome = "sent" | "simulated" | "no-email" | "error" | "already";

/** Compose the PDF + mail and hand it to the transport (real send or simulated). */
async function dispatch(data: SendData): Promise<SendOutcome> {
  if (!data.to) return "no-email";
  const pdf = await renderInvoicePdf(data.pdfDoc);
  const res = await sendMail({
    to: data.to,
    subject: data.subject,
    html: data.html,
    text: data.text,
    attachments: [
      { filename: data.pdfName, content: Buffer.from(pdf), contentType: "application/pdf" },
    ],
  });
  if (!res.ok) return "error";
  return res.simulated ? "simulated" : "sent";
}

/** Verstuur één verkoopfactuur naar de klant. */
export async function sendSalesInvoiceById(id: string): Promise<SendOutcome> {
  const [inv, settings] = await Promise.all([
    db.invoice.findUnique({ where: { id }, include: salesInclude }),
    getCompanySettings(),
  ]);
  if (!inv) return "error";
  const data = salesSendData(inv, settings);
  if (!data.to) return "no-email";

  // Atomically claim the row BEFORE dispatching: only one request can flip
  // DRAFT -> SENT, so a concurrent double-send (double-click, or a single
  // "Versturen" overlapping with "Verstuur alles") can't e-mail twice.
  const claimed = await db.invoice.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: "SENT", sentAt: new Date(), sentTo: data.to },
  });
  if (claimed.count === 0) return "already";

  const outcome = await dispatch(data);
  if (outcome === "error") {
    // Real send failed → release the claim so it returns to the verzendmap.
    await db.invoice.updateMany({
      where: { id, status: "SENT", sentTo: data.to },
      data: { status: "DRAFT", sentAt: null, sentTo: null },
    });
  }
  return outcome;
}

/** Verstuur één inkoopfactuur naar de medewerker. */
export async function sendPurchaseInvoiceById(id: string): Promise<SendOutcome> {
  const [inv, settings] = await Promise.all([
    db.purchaseInvoice.findUnique({ where: { id }, include: purchaseInclude }),
    getCompanySettings(),
  ]);
  if (!inv) return "error";
  const data = purchaseSendData(inv, settings);
  if (!data.to) return "no-email";

  const claimed = await db.purchaseInvoice.updateMany({
    where: { id, sentAt: null, status: { notIn: ["CANCELLED", "PAID"] } },
    data: { sentAt: new Date(), sentTo: data.to },
  });
  if (claimed.count === 0) return "already";

  const outcome = await dispatch(data);
  if (outcome === "error") {
    await db.purchaseInvoice.updateMany({
      where: { id, sentTo: data.to },
      data: { sentAt: null, sentTo: null },
    });
  }
  return outcome;
}
