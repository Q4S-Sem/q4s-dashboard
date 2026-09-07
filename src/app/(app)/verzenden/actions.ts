"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOutbox, matchOutbox } from "@/lib/verzenden";
import {
  sendSalesInvoiceById,
  sendPurchaseInvoiceById,
  type SendOutcome,
} from "@/lib/send-invoice";

// De verzendkern (PDF + mail + atomair claimen) staat in @/lib/send-invoice,
// zodat de bulkknoppen op /facturen exact hetzelfde doen als de verzendmap.
type Outcome = SendOutcome;
const runSales = sendSalesInvoiceById;
const runPurchase = sendPurchaseInvoiceById;

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
