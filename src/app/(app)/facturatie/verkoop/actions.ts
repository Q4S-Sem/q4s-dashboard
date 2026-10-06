"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  DUPLICAAT_FACTUURNUMMER,
  parseManualInvoiceNumber,
  reconcileInvoiceSequence,
} from "@/lib/numbering";
import {
  isDeletableInvoice,
  isReleasableInvoice,
  isSendableInvoice,
  parseBulkIds,
  partitionBulk,
} from "@/lib/factuur-bulk";
import { sendSalesInvoiceById, type SendOutcome } from "@/lib/send-invoice";
import { getCompanySettings } from "@/lib/settings";
import { reminderSendData } from "@/lib/reminders";
import { herinneringAanDeBeurt } from "@/lib/cashflow";
import { salesSendData } from "@/lib/verzenden";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { sendMail } from "@/lib/email";
import { parseForm, type FormState } from "@/lib/form";
import { round2 } from "@/lib/utils";
import { isAdminSession } from "@/lib/session";
import { isSnelStartConnected, pushSalesInvoice } from "@/lib/snelstart";

// ---------------------------------------------------------------------------
// De acties van "Verkoopfacturen" (/facturatie/verkoop).
//
// De trechter is bewust in stappen geknipt en elke stap is een MENSELIJKE klik:
//   concept (DRAFT) → nakijken → "Naar klaar" (READY) → "Verzenden" (SENT).
// Er draait geen automaat op deze weg: niets wordt vanzelf vrijgegeven, verstuurd
// of op betaald gezet. Verzenden loopt altijd via `sendSalesInvoiceById`, dat de
// rij atomair van READY naar SENT claimt — zo gaat dezelfde factuur nooit twee
// keer de deur uit, ook niet bij twee kliks tegelijk.
// ---------------------------------------------------------------------------

const LIJST = "/facturatie/verkoop";
const detail = (id: string) => `${LIJST}/${id}`;

function herlaad() {
  revalidatePath(LIJST);
  revalidatePath("/facturatie");
  revalidatePath("/", "layout");
}

const EditInvoiceSchema = z.object({
  number: z.string().min(1, "Factuurnummer is verplicht"),
  issueDate: z.coerce.date({ message: "Factuurdatum is verplicht" }),
  dueDate: z.coerce.date({ message: "Vervaldatum is verplicht" }),
  vatRate: z.coerce.number().min(0, "BTW mag niet negatief zijn").max(100),
  notes: z.string().optional(),
});

/**
 * Corrigeer een factuur: kop (nummer, datums, btw%, notitie) én de regels —
 * toevoegen, wijzigen en weglaten mag allemaal. Bestaande regels matchen op hun
 * id; een onbekend (tijdelijk) id is een nieuwe regel; een opgeslagen regel die
 * niet meer meekomt wordt verwijderd.
 *
 * Een verwijderde regel die uit een urenstaat kwam GEEFT DIE URENSTAAT WEER VRIJ
 * (terug naar APPROVED), anders blijft die week op INVOICED hangen en is hij
 * nooit meer te factureren.
 */
export async function updateInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende factuur." };

  const parsed = parseForm(EditInvoiceSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const cleaned = parseManualInvoiceNumber(d.number);
  if (!cleaned.ok) return { fieldErrors: { number: cleaned.error } };
  const number = cleaned.number;

  const invoice = await db.invoice.findUnique({ where: { id }, include: { lines: true } });
  if (!invoice) return { error: "Onbekende factuur." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Kon de factuurregels niet lezen." };
  }
  if (!Array.isArray(raw)) return { error: "Ongeldige factuurregels." };

  const validIds = new Set(invoice.lines.map((l) => l.id));
  const seen = new Set<string>();
  type LinePayload = {
    existingId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  };
  const lineItems: LinePayload[] = [];
  for (const r of raw as Array<{
    id?: unknown;
    description?: unknown;
    quantity?: unknown;
    unitPrice?: unknown;
  }>) {
    const rawId = String(r.id ?? "");
    const existingId = validIds.has(rawId) && !seen.has(rawId) ? rawId : null;
    if (existingId) seen.add(existingId);
    const description = String(r.description ?? "").trim();
    const quantity = Number(r.quantity);
    const unitPrice = Number(r.unitPrice);
    if (!description) return { error: "Elke factuurregel heeft een omschrijving nodig." };
    if (
      !Number.isFinite(quantity) || quantity < 0 ||
      !Number.isFinite(unitPrice) || unitPrice < 0
    ) {
      return { error: "Vul geldige (niet-negatieve) aantallen en tarieven in." };
    }
    const amount = round2(quantity * unitPrice);
    if (!Number.isFinite(amount)) return { error: "Een bedrag is te groot om te verwerken." };
    lineItems.push({ existingId, description, quantity, unitPrice, amount });
  }
  if (lineItems.length === 0) return { error: "Een factuur heeft minstens één regel nodig." };

  const keptIds = new Set(lineItems.map((p) => p.existingId).filter((x): x is string => Boolean(x)));
  const removed = invoice.lines.filter((l) => !keptIds.has(l.id));
  const releaseTimesheetIds = removed
    .map((l) => l.timesheetId)
    .filter((x): x is string => Boolean(x));

  const subtotal = round2(lineItems.reduce((s, l) => s + l.amount, 0));
  const vatAmount = round2((subtotal * d.vatRate) / 100);
  const total = round2(subtotal + vatAmount);
  if (!Number.isFinite(subtotal) || !Number.isFinite(vatAmount) || !Number.isFinite(total)) {
    return { error: "Het totaalbedrag is te groot om te verwerken." };
  }

  // Eerst netjes controleren (leesbare melding), en daarna nóg een keer opvangen
  // op de unieke index — die is het echte slot.
  const clash = await db.invoice.findFirst({
    where: { number, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { number: DUPLICAAT_FACTUURNUMMER } };

  try {
    await db.$transaction(async (tx) => {
      if (removed.length > 0) {
        await tx.invoiceLine.deleteMany({ where: { id: { in: removed.map((l) => l.id) } } });
        if (releaseTimesheetIds.length > 0) {
          await tx.timesheet.updateMany({
            where: { id: { in: releaseTimesheetIds } },
            data: { status: "APPROVED" },
          });
        }
      }
      for (const l of lineItems) {
        if (l.existingId) {
          await tx.invoiceLine.update({
            where: { id: l.existingId },
            data: {
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              amount: l.amount,
            },
          });
        } else {
          await tx.invoiceLine.create({
            data: {
              invoiceId: id,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              amount: l.amount,
              lineKind: "OTHER",
            },
          });
        }
      }
      await tx.invoice.update({
        where: { id },
        data: {
          number,
          issueDate: d.issueDate,
          dueDate: d.dueDate,
          vatRate: d.vatRate,
          subtotal,
          vatAmount,
          total,
          notes: d.notes?.trim() || null,
        },
      });
      // Handmatig nummer → de jaarteller meetrekken, zodat de automatische
      // nummering hierna verdergaat NA dit nummer (nooit er weer overheen).
      await reconcileInvoiceSequence(tx, number);
    });
  } catch (cause) {
    if ((cause as { code?: string }).code === "P2002")
      return { fieldErrors: { number: DUPLICAAT_FACTUURNUMMER } };
    throw cause;
  }

  herlaad();
  revalidatePath(detail(id));
  redirect(`${detail(id)}?opgeslagen=1`);
}

/**
 * Zet de status van één factuur. De weg is altijd een klik van een mens; deze
 * actie accepteert alleen de vier echte overgangen plus annuleren.
 *
 * Annuleren is geen verwijderen: de factuur blijft staan, maar zijn urenstaten
 * komen vrij (APPROVED) zodat die week opnieuw gefactureerd kan worden.
 */
export async function setInvoiceStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["DRAFT", "READY", "SENT", "PAID", "CANCELLED"].includes(status)) return;

  if (status === "CANCELLED") {
    const inv = await db.invoice.findUnique({ where: { id }, include: { lines: true } });
    if (inv) {
      const tsIds = inv.lines.map((l) => l.timesheetId).filter((x): x is string => Boolean(x));
      await db.$transaction([
        db.invoiceLine.updateMany({
          where: { invoiceId: id, timesheetId: { not: null } },
          data: { timesheetId: null },
        }),
        db.timesheet.updateMany({ where: { id: { in: tsIds } }, data: { status: "APPROVED" } }),
        db.invoice.update({ where: { id }, data: { status: "CANCELLED", paidDate: null } }),
      ]);
    }
  } else {
    await db.invoice.update({
      where: { id },
      data: {
        status,
        paidDate: status === "PAID" ? new Date() : null,
        // Terug naar concept "ontverstuurt" hem: het verzendmerk gaat weg zodat
        // hij eerlijk opnieuw klaargezet en verstuurd kan worden.
        ...(status === "DRAFT" ? { sentAt: null, sentTo: null } : {}),
      },
    });
  }

  herlaad();
  revalidatePath(detail(id));
  redirect(detail(id));
}

/** Boek deze verkoopfactuur HANDMATIG in SnelStart. Nooit automatisch, nooit twee
 *  keer — `snelstartId` is het slot. Boeken verandert de factuurstatus niet. */
export async function pushInvoiceToSnelStart(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(LIJST);

  if (!(await isAdminSession())) redirect(`${detail(id)}?snelstart=geen-rechten`);
  if (!isSnelStartConnected()) redirect(`${detail(id)}?snelstart=niet-gekoppeld`);

  const invoice = await db.invoice.findUnique({ where: { id }, include: { client: true } });
  if (!invoice) redirect(LIJST);
  if (invoice.snelstartId) redirect(`${detail(id)}?snelstart=al-geboekt`);

  const res = await pushSalesInvoice({
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    relationName: invoice.client.companyName,
    relationEmail: invoice.client.invoiceEmail || invoice.client.email,
    relationVat: invoice.client.vatNumber,
    vatRate: invoice.vatRate,
    subtotal: invoice.subtotal,
    total: invoice.total,
    description: `Verkoopfactuur ${invoice.number} — ${invoice.client.companyName}`,
  });
  if (!res.ok) redirect(`${detail(id)}?snelstart=${encodeURIComponent(res.error)}`);

  await db.invoice.update({ where: { id }, data: { snelstartId: res.data.id || "geboekt" } });

  herlaad();
  revalidatePath(detail(id));
  redirect(`${detail(id)}?snelstart=ok`);
}

/**
 * Verwijder één factuur en geef haar urenstaten terug aan "APPROVED", zodat de
 * uren opnieuw gefactureerd kunnen worden. Alleen concept/geannuleerd mag weg —
 * verstuurd of betaald is administratie, die crediteer je.
 */
async function removeInvoice(id: string): Promise<"deleted" | "locked" | "missing"> {
  const inv = await db.invoice.findUnique({ where: { id }, include: { lines: true } });
  if (!inv) return "missing";
  if (!isDeletableInvoice(inv.status)) return "locked";

  const tsIds = inv.lines.map((l) => l.timesheetId).filter((x): x is string => Boolean(x));
  await db.$transaction([
    db.timesheet.updateMany({ where: { id: { in: tsIds } }, data: { status: "APPROVED" } }),
    db.invoice.delete({ where: { id } }),
  ]);
  return "deleted";
}

export async function deleteInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const res = await removeInvoice(id);
  if (res === "missing") return;
  if (res === "locked") redirect(`${detail(id)}?fout=vergrendeld`);

  herlaad();
  redirect(`${LIJST}?verwijderd=1`);
}

// ===========================================================================
// Bulk — alles hieronder draait de GUARDS UIT factuur-bulk.ts opnieuw op de
// server. De aangevinkte ids uit de browser zijn een WENS, nooit een bewijs.
// ===========================================================================

/** Bulk: concepten vrijgeven (DRAFT → READY). Verstuurt niets. */
export async function bulkReleaseInvoices(formData: FormData) {
  const requested = parseBulkIds(formData.get("ids"));
  const tab = String(formData.get("tab") ?? "");
  if (requested.length === 0) redirect(LIJST);

  const rows = await db.invoice.findMany({
    where: { id: { in: requested } },
    select: { id: true, status: true },
  });
  const { ids, skipped } = partitionBulk(requested, rows, isReleasableInvoice);

  // Atomair per rij: alleen een echte DRAFT schuift door naar READY.
  let released = 0;
  for (const id of ids) {
    const res = await db.invoice.updateMany({
      where: { id, status: "DRAFT" },
      data: { status: "READY" },
    });
    released += res.count;
  }

  herlaad();
  const p = new URLSearchParams({ vrijgegeven: String(released) });
  if (tab) p.set("tab", tab);
  if (skipped > 0) p.set("overgeslagen", String(skipped));
  redirect(`${LIJST}?${p.toString()}`);
}

/**
 * Bulk: verstuur de aangevinkte VRIJGEGEVEN facturen naar de klant. Dit is de
 * enige plek die echt mailt, en alleen na een expliciete klik + bevestiging.
 * `sendSalesInvoiceById` claimt elke rij atomair van READY naar SENT.
 */
export async function bulkSendInvoices(formData: FormData) {
  const requested = parseBulkIds(formData.get("ids"));
  const tab = String(formData.get("tab") ?? "");
  if (requested.length === 0) redirect(LIJST);

  const rows = await db.invoice.findMany({
    where: { id: { in: requested } },
    select: { id: true, status: true },
  });
  const { ids, skipped } = partitionBulk(requested, rows, isSendableInvoice);

  let live = 0;
  let simulated = 0;
  let noEmail = 0;
  let failed = 0;
  for (const id of ids) {
    const outcome: SendOutcome = await sendSalesInvoiceById(id);
    if (outcome === "sent") live++;
    else if (outcome === "simulated") simulated++;
    else if (outcome === "no-email") noEmail++;
    else if (outcome === "error") failed++;
    // "already" → een gelijktijdige verzending was ons voor; stil overslaan.
  }

  herlaad();
  const verstuurd = live + simulated;
  const p = new URLSearchParams({ verzonden: String(verstuurd) });
  p.set("modus", verstuurd > 0 && live === 0 ? "sim" : "live");
  if (tab) p.set("tab", tab);
  if (skipped > 0) p.set("overgeslagen", String(skipped));
  if (noEmail > 0) p.set("geenmail", String(noEmail));
  if (failed > 0) p.set("mislukt", String(failed));
  redirect(`${LIJST}?${p.toString()}`);
}

/** Bulk: verwijder de aangevinkte concepten/geannuleerde facturen. */
export async function bulkDeleteInvoices(formData: FormData) {
  const requested = parseBulkIds(formData.get("ids"));
  const tab = String(formData.get("tab") ?? "");
  if (requested.length === 0) redirect(LIJST);

  const rows = await db.invoice.findMany({
    where: { id: { in: requested } },
    select: { id: true, status: true },
  });
  const { ids, skipped } = partitionBulk(requested, rows, isDeletableInvoice);

  let deleted = 0;
  for (const id of ids) {
    if ((await removeInvoice(id)) === "deleted") deleted++;
  }

  herlaad();
  const p = new URLSearchParams({ verwijderd: String(deleted) });
  if (tab) p.set("tab", tab);
  const over = skipped + (ids.length - deleted);
  if (over > 0) p.set("overgeslagen", String(over));
  redirect(`${LIJST}?${p.toString()}`);
}

// ===========================================================================
// Betalingsherinnering
// ===========================================================================

const DAG = 86_400_000;

/**
 * Stuur één betalingsherinnering voor een te late factuur. Alleen na een klik;
 * er draait geen herinner-automaat. De toon loopt op via `reminderSendData`
 * (1e = herinnering, 2e = tweede herinnering, 3e+ = aanmaning) en de teller +
 * verzenddatum worden pas bijgewerkt als de mail écht weg is.
 */
type HerinnerUitkomst = "ok" | "geen-adres" | "niet-verzonden" | "te-vroeg" | "mislukt";

/** Eén herinnering versturen, met de factuur-PDF als bijlage. Teller pas omhoog als de mail weg is. */
async function stuurHerinnering(id: string, settings: Awaited<ReturnType<typeof getCompanySettings>>): Promise<HerinnerUitkomst> {
  const inv = await db.invoice.findUnique({ where: { id }, include: { client: true, lines: true } });
  if (!inv || inv.status !== "SENT") return "niet-verzonden";
  const now = new Date();
  // Dubbel-klik / te snel opnieuw: hooguit één herinnering per interval.
  if (!herinneringAanDeBeurt(inv, now)) return inv.dueDate < now ? "te-vroeg" : "niet-verzonden";

  const dagenTeLaat = Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / DAG));
  const count = inv.reminderCount + 1;
  const data = reminderSendData(inv, settings, count, dagenTeLaat);
  if (!data.to) return "geen-adres";

  const factuur = salesSendData(inv, settings);
  const res = await sendMail({
    to: data.to,
    subject: data.subject,
    html: data.html,
    text: data.text,
    attachments: [
      { filename: factuur.pdfName, content: Buffer.from(await renderInvoicePdf(factuur.pdfDoc)), contentType: "application/pdf" },
    ],
  });
  if (!res.ok) return "mislukt";

  await db.invoice.update({ where: { id }, data: { reminderCount: count, reminderSentAt: now } });
  return "ok";
}

export async function sendInvoiceReminder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const terug = String(formData.get("terug") ?? "") === "detail";
  if (!id) redirect(LIJST);
  const doel = terug ? detail(id) : `${LIJST}?tab=telaat`;
  const uitkomst = await stuurHerinnering(id, await getCompanySettings());
  herlaad();
  revalidatePath(detail(id));
  redirect(`${doel}${doel.includes("?") ? "&" : "?"}herinnering=${uitkomst}`);
}

/** Alle herinneringen die aan de beurt zijn in één keer (na bevestiging in de UI). */
export async function sendDueReminders() {
  const now = new Date();
  const kandidaten = await db.invoice.findMany({
    where: { status: "SENT", dueDate: { lt: now } },
    select: { id: true, status: true, dueDate: true, reminderSentAt: true },
  });
  const settings = await getCompanySettings();
  const telling: Record<HerinnerUitkomst, number> = { ok: 0, "geen-adres": 0, "niet-verzonden": 0, "te-vroeg": 0, mislukt: 0 };
  for (const k of kandidaten.filter((k) => herinneringAanDeBeurt(k, now))) {
    telling[await stuurHerinnering(k.id, settings)] += 1;
  }
  herlaad();
  redirect(`${LIJST}?tab=telaat&herinneringen=${telling.ok}&geenmail=${telling["geen-adres"]}&mislukt=${telling.mislukt}`);
}

/**
 * Eén verkoopfactuur naar de administratie van de klant (factuur-e-mailadres).
 * Een concept wordt eerst vrijgegeven; verzenden loopt via sendSalesInvoiceById,
 * dat atomair READY → SENT claimt (dus nooit dubbel). Alleen na bevestiging.
 */
export async function naarAdministratie(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(LIJST);
  await db.invoice.updateMany({ where: { id, status: "DRAFT" }, data: { status: "READY" } });
  const outcome = await sendSalesInvoiceById(id);
  herlaad();
  const p = new URLSearchParams({ weergave: "facturen" });
  if (outcome === "sent" || outcome === "simulated") {
    p.set("verzonden", "1");
    p.set("modus", outcome === "simulated" ? "sim" : "live");
  } else if (outcome === "no-email") p.set("verzonden", "0"), p.set("geenmail", "1");
  else if (outcome === "error") p.set("verzonden", "0"), p.set("mislukt", "1");
  else p.set("verzonden", "0");
  redirect(`${LIJST}?${p.toString()}`);
}
