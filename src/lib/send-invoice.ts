import { db } from "./db";
import { getCompanySettings } from "./settings";
import { sendMail } from "./email";
import { renderInvoicePdf } from "./invoice-pdf";
import { salesSendData, type SendData } from "./verzenden";

/**
 * De verzendkern van de verzendmap: PDF renderen, mailen en de factuur atomair
 * "claimen" zodat er nooit twee keer dezelfde mail uitgaat. Hier gehaald uit
 * /verzenden/actions.ts zodat de bulkknoppen op /facturen exact DEZELFDE
 * verzendsemantiek gebruiken — geen tweede, afwijkende verzendweg.
 */

const salesInclude = { client: true, lines: true } as const;


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
  // READY -> SENT, so a concurrent double-send (double-click, or a single
  // "Versturen" overlapping with "Verstuur alles") can't e-mail twice. Alleen
  // vrijgegeven facturen (READY) mogen de deur uit — concepten niet.
  const claimed = await db.invoice.updateMany({
    where: { id, status: "READY" },
    data: { status: "SENT", sentAt: new Date(), sentTo: data.to },
  });
  if (claimed.count === 0) return "already";

  const outcome = await dispatch(data);
  if (outcome === "error") {
    // Real send failed → release the claim so it returns to the verzendmap.
    await db.invoice.updateMany({
      where: { id, status: "SENT", sentTo: data.to },
      data: { status: "READY", sentAt: null, sentTo: null },
    });
  }
  return outcome;
}
