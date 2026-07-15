"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { sendMail } from "@/lib/email";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import {
  salesSendData,
  purchaseSendData,
  getOutbox,
  matchOutbox,
  type SendData,
} from "@/lib/verzenden";

const salesInclude = { client: true, lines: true } as const;
const purchaseInclude = { consultant: true, lines: true } as const;

type Outcome = "sent" | "simulated" | "no-email" | "error" | "already";

/** Compose the PDF + mail and hand it to the transport (real send or simulated). */
async function dispatch(data: SendData): Promise<Outcome> {
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

async function runSales(id: string): Promise<Outcome> {
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

async function runPurchase(id: string): Promise<Outcome> {
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

function revalidate() {
  revalidatePath("/verzenden");
  revalidatePath("/facturen");
  revalidatePath("/inkoopfacturen");
  revalidatePath("/", "layout");
}

/** Build the single-send redirect, preserving the view the user was checking (tab + week + zoek). */
function singleResult(
  outcome: Outcome,
  tab: "verkoop" | "inkoop",
  week: string,
  q: string,
): string {
  const p = new URLSearchParams();
  if (tab === "inkoop") p.set("tab", "inkoop"); // verkoop is the default → omit
  if (/^\d{4}-\d{2}-\d{2}$/.test(week)) p.set("week", week);
  if (q) p.set("q", q);
  if (outcome === "no-email") p.set("noemail", "1");
  else if (outcome === "error") p.set("failed", "1");
  else if (outcome === "already") p.set("already", "1");
  else {
    p.set("sent", "1");
    p.set("mode", outcome === "simulated" ? "sim" : "live");
  }
  return `/verzenden?${p.toString()}`;
}

/** Send one verkoopfactuur to the klant. */
export async function sendSalesInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const week = String(formData.get("week") ?? "");
  const q = String(formData.get("q") ?? "").trim();
  if (!id) redirect("/verzenden");
  const outcome = await runSales(id);
  revalidate();
  redirect(singleResult(outcome, "verkoop", week, q));
}

/** Send one inkoopfactuur to de medewerker. */
export async function sendPurchaseInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const week = String(formData.get("week") ?? "");
  const q = String(formData.get("q") ?? "").trim();
  if (!id) redirect("/verzenden");
  const outcome = await runPurchase(id);
  revalidate();
  redirect(singleResult(outcome, "inkoop", week, q));
}

/**
 * Send exactly the invoices that match the current view (one tab, optionally a
 * week and/or a free-text search). Deliberately scoped — the verzendmap is split
 * "om alles simpel te controleren", so the bulk button must never blast rows the
 * user isn't looking at. It reuses getOutbox + matchOutbox — the SAME predicate
 * the page renders with — so the sent set is provably the visible set. Each row
 * is still claimed atomically inside run*.
 */
export async function sendScope(formData: FormData) {
  const tab = String(formData.get("tab") ?? "") === "inkoop" ? "inkoop" : "verkoop";
  const weekRaw = String(formData.get("week") ?? "");
  const week = /^\d{4}-\d{2}-\d{2}$/.test(weekRaw) ? weekRaw : "";
  const q = String(formData.get("q") ?? "").trim();

  const { sales, purchase } = await getOutbox();
  const pool = tab === "inkoop" ? purchase : sales;
  const targets = pool.filter((r) => matchOutbox(r, { week, q }));

  let live = 0;
  let simulated = 0;
  let skipped = 0;
  let failed = 0;
  const tally = (o: Outcome) => {
    if (o === "sent") live++;
    else if (o === "simulated") simulated++;
    else if (o === "no-email") skipped++;
    else if (o === "error") failed++;
    // "already" → a concurrent send claimed it; silently skip.
  };

  for (const r of targets) tally(await (tab === "inkoop" ? runPurchase(r.id) : runSales(r.id)));

  revalidate();
  const total = live + simulated;
  const mode = total > 0 && live === 0 ? "sim" : "live";
  const p = new URLSearchParams({ tab });
  if (week) p.set("week", week);
  if (q) p.set("q", q);
  p.set("bulk", String(total));
  p.set("mode", mode);
  p.set("skipped", String(skipped));
  p.set("failed", String(failed));
  redirect(`/verzenden?${p.toString()}`);
}
