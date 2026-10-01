"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCompanySettings, type CompanySettings } from "@/lib/settings";
import { sendMail } from "@/lib/email";
import { reminderSendData } from "@/lib/reminders";
import { paymentMonitor } from "@/lib/betaalmonitor";
import { isAdminSession } from "@/lib/session";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { parseCamt053 } from "@/lib/camt053";
import {
  matchBankEntries,
  summarizeBankMatches,
  type BankMatchRow,
  type BankMatchSummary,
} from "@/lib/bank-matching";

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

// ---------------------------------------------------------------------------
// Bankafschrift (CAMT.053) inlezen → VOORSTELLEN tonen. Het bestand wordt in het
// geheugen verwerkt en nergens opgeslagen; er wordt niets afgeboekt. Pas als een
// mens vinkjes zet en op de knop drukt doet `markBankMatchesPaid` iets.
// ---------------------------------------------------------------------------

/** Ruim boven een normaal dagafschrift; voorkomt dat één bestand de pagina plat legt. */
const MAX_BANK_ENTRIES = 500;

export type BankImportState = {
  error?: string;
  result?: {
    fileName: string;
    /** De eigen rekening(en) waar dit afschrift over gaat. */
    ibans: string[];
    rows: BankMatchRow[];
    summary: BankMatchSummary;
    /** Bij meer dan MAX_BANK_ENTRIES boekingen tonen we alleen de eerste. */
    truncated: boolean;
  };
};

/** Lees een geüpload CAMT.053-afschrift en stel koppelingen voor. Muteert niets. */
export async function importBankStatement(
  _prev: BankImportState,
  formData: FormData,
): Promise<BankImportState> {
  if (!(await isAdminSession())) return { error: "Alleen een beheerder kan een bankafschrift inlezen." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Kies een CAMT.053-bestand (.xml)." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Het bestand is te groot." };
  const isXml =
    /\.xml$/i.test(file.name) || ["text/xml", "application/xml"].includes(file.type.toLowerCase());
  if (!isXml) return { error: "Alleen een CAMT.053-bestand in XML-formaat (.xml) wordt gelezen." };

  let xml: string;
  try {
    xml = await file.text();
  } catch {
    return { error: "Het bestand kon niet gelezen worden." };
  }

  const statements = parseCamt053(xml);
  const entries = statements.flatMap((s) => s.entries);
  if (entries.length === 0) {
    return { error: "Geen boekingen gevonden — is dit een CAMT.053-dagafschrift?" };
  }
  const truncated = entries.length > MAX_BANK_ENTRIES;

  // Openstaand = precies zoals de betaalmonitor het bedoelt: verkoopfacturen die
  // nog geïnd moeten worden, ontvangen facturen die nog uitbetaald moeten worden.
  const [sales, received] = await Promise.all([
    db.invoice.findMany({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      select: { id: true, number: true, total: true, client: { select: { companyName: true } } },
    }),
    db.receivedInvoice.findMany({
      where: { status: { not: "PAID" } },
      select: {
        id: true,
        number: true,
        amount: true,
        consultant: {
          select: { firstName: true, lastName: true, companyName: true, iban: true },
        },
      },
    }),
  ]);

  const rows = matchBankEntries({
    entries: entries.slice(0, MAX_BANK_ENTRIES),
    salesInvoices: sales.map((i) => ({
      id: i.id,
      number: i.number,
      clientName: i.client.companyName,
      total: i.total,
    })),
    receivedInvoices: received.map((p) => ({
      id: p.id,
      number: p.number,
      firstName: p.consultant.firstName,
      lastName: p.consultant.lastName,
      companyName: p.consultant.companyName,
      iban: p.consultant.iban,
      amount: p.amount,
    })),
  });

  return {
    result: {
      fileName: file.name,
      ibans: statements.map((s) => s.iban).filter((x): x is string => Boolean(x)),
      rows,
      summary: summarizeBankMatches(rows),
      truncated,
    },
  };
}

/** "sales|<factuurId>|<jjjj-mm-dd>" uit een aangevinkte regel. */
function parseSelection(raw: string): { kind: "sales" | "received"; id: string; paidDate: Date } | null {
  const [kind, id, day] = raw.split("|");
  if (kind !== "sales" && kind !== "received") return null;
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) return null;
  const paidDate = new Date(`${day}T00:00:00`);
  return Number.isNaN(paidDate.getTime()) ? null : { kind, id, paidDate };
}

/**
 * Boek de AANGEVINKTE voorstellen af: status PAID met de boekdatum van het
 * afschrift als betaaldatum. Alleen deze knop verandert geld-status — het
 * inlezen hierboven doet dat niet, en er draait geen automaat op.
 *
 * Per regel dezelfde velden als de handmatige knoppen (`setInvoiceStatus` in
 * facturen/actions.ts en `setReceivedStatus` in ontvangen-facturen/actions.ts),
 * maar met een `updateMany` + statusvoorwaarde: een factuur die intussen al
 * betaald of geannuleerd is wordt overgeslagen in plaats van overschreven.
 */
export async function markBankMatchesPaid(formData: FormData) {
  if (!(await isAdminSession())) redirect("/betaalmonitor?fout=geen-rechten");

  const selections = formData
    .getAll("selectie")
    .map(String)
    .map(parseSelection)
    .filter((x): x is NonNullable<ReturnType<typeof parseSelection>> => x !== null);

  // Dezelfde factuur maar één keer, ook als het formulier 'm dubbel aanbiedt.
  const seen = new Set<string>();
  let afgeboekt = 0;
  for (const sel of selections) {
    const key = `${sel.kind}:${sel.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const res =
      sel.kind === "sales"
        ? await db.invoice.updateMany({
            where: { id: sel.id, status: { notIn: ["PAID", "CANCELLED"] } },
            data: { status: "PAID", paidDate: sel.paidDate },
          })
        : await db.receivedInvoice.updateMany({
            // Een factuur met afwijking (DISPUTED) eerst oplossen, niet afboeken.
            where: { id: sel.id, status: { in: ["NEW", "APPROVED"] } },
            data: { status: "PAID", paidDate: sel.paidDate },
          });
    afgeboekt += res.count;
  }

  revalidatePath("/betaalmonitor");
  revalidatePath("/facturen");
  revalidatePath("/ontvangen-facturen");
  revalidatePath("/boekhouding");
  revalidatePath("/", "layout");

  const p = new URLSearchParams({ afgeboekt: String(afgeboekt) });
  const overgeslagen = seen.size - afgeboekt;
  if (overgeslagen > 0) p.set("overgeslagen", String(overgeslagen));
  redirect(`/betaalmonitor?${p.toString()}`);
}
