"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCompanySettings, type CompanySettings } from "@/lib/settings";
import { sendMail } from "@/lib/email";
import { reminderSendData } from "@/lib/reminders";
import { paymentMonitor } from "@/lib/betaalmonitor";

const DAY = 86_400_000;

/** Stuur één betalingsherinnering; werkt de teller + datum bij. Best-effort. */
async function sendOne(
  invoiceId: string,
  settings: CompanySettings,
  now: Date,
): Promise<{ ok: boolean; simulated?: boolean; error?: string }> {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { client: true } });
  if (!inv) return { ok: false, error: "Onbekende factuur." };
  if (inv.status !== "SENT") return { ok: false, error: "Alleen verzonden, nog niet betaalde facturen." };

  const daysOverdue = Math.max(0, Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / DAY));
  const count = inv.reminderCount + 1; // de hoeveelste herinnering dit wordt
  const data = reminderSendData(inv, settings, count, daysOverdue);
  if (!data.to) return { ok: false, error: "Geen e-mailadres bij de klant." };

  const res = await sendMail({ to: data.to, subject: data.subject, html: data.html, text: data.text });
  if (!res.ok) return { ok: false, error: res.error };

  await db.invoice.update({
    where: { id: invoiceId },
    data: { reminderCount: count, reminderSentAt: now },
  });
  return { ok: true, simulated: res.simulated };
}

/** Eén factuur handmatig herinneren (knop in de betaalmonitor / op de factuur). */
export async function sendInvoiceReminder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const settings = await getCompanySettings();
  const res = await sendOne(id, settings, new Date());
  revalidatePath("/betaalmonitor");
  revalidatePath(`/facturen/${id}`);
  redirect(res.ok ? "/betaalmonitor?herinnerd=1" : `/betaalmonitor?fout=${encodeURIComponent(res.error ?? "onbekend")}`);
}

/** Alle facturen die aan de herinner-drempel voldoen in één keer aanschrijven. */
export async function sendAllReminders() {
  const [mon, settings] = await Promise.all([paymentMonitor(), getCompanySettings()]);
  const now = new Date();
  let sent = 0;
  for (const r of mon.remindable) {
    const res = await sendOne(r.id, settings, now);
    if (res.ok) sent += 1;
  }
  revalidatePath("/betaalmonitor");
  revalidatePath("/", "layout");
  redirect(`/betaalmonitor?herinnerd=${sent}`);
}
