"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { RECEIVED_INVOICE_STATUS_VALUES } from "@/lib/domain";
import { MAX_UPLOAD_BYTES, saveReceivedBytes, deleteReceivedUpload } from "@/lib/uploads";
import { mailReceivedDiscrepancy } from "@/lib/received-invoices";

const IMPORT = "/ontvangen-facturen/importeren";

function parseDate(v: FormDataEntryValue | null): Date | null {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Robuust bedrag-parsen: "3840", "3840,00", "3.840,00", "3.840", "12.345,67", "3840.50". */
function parseAmount(v: FormDataEntryValue | null): number {
  let s = String(v ?? "").trim().replace(/[€\s]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) {
    // NL-notatie: punten zijn duizendtallen, komma is decimaal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Alleen punten in een duizendtal-patroon ("3.840", "12.345") → duizendtallen.
    s = s.replace(/\./g, "");
  }
  s = s.replace(/[^\d.]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function revalidate() {
  revalidatePath("/ontvangen-facturen");
  // De inbox toont de km van de factuur als terugval bij een staat zonder km.
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/facturatie");
  revalidatePath("/", "layout");
}

/** Registreer/importeer een inkomende factuur van een geplaatste medewerker,
 *  met optioneel de factuur-PDF erbij (opgeslagen + naar de Data-map gespiegeld). */
export async function createReceivedInvoice(formData: FormData) {
  const consultantId = String(formData.get("consultantId") ?? "").trim();
  if (!consultantId) redirect(`${IMPORT}?error=medewerker`);

  const amount = parseAmount(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) redirect(`${IMPORT}?error=bedrag`);

  const vatAmount = String(formData.get("vatAmount") ?? "").trim() ? parseAmount(formData.get("vatAmount")) : null;

  // Kilometers zoals op HÚN factuur vermeld. Sommige freelancers zetten km niet op
  // de urenstaat maar alleen op de factuur; die vullen we hiermee alsnog aan in de
  // urenregistratie (zie src/lib/kilometers.ts).
  const kmRaw = String(formData.get("kilometers") ?? "").trim() ? parseAmount(formData.get("kilometers")) : null;
  const kilometers = kmRaw != null && Number.isFinite(kmRaw) && kmRaw > 0 ? kmRaw : null;

  // Optionele PDF/afbeelding van de factuur.
  let fileName: string | null = null;
  let originalName: string | null = null;
  let mimeType: string | null = null;
  let size: number | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) redirect(`${IMPORT}?error=groot`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    fileName = await saveReceivedBytes(bytes, file.name);
    originalName = file.name;
    mimeType = file.type || "application/octet-stream";
    size = file.size;
  }

  await db.receivedInvoice.create({
    data: {
      consultantId,
      number: String(formData.get("number") ?? "").trim() || null,
      issueDate: parseDate(formData.get("issueDate")),
      periodStart: parseDate(formData.get("periodStart")),
      periodEnd: parseDate(formData.get("periodEnd")),
      amount,
      vatAmount: vatAmount != null && Number.isFinite(vatAmount) ? vatAmount : null,
      kilometers,
      notes: String(formData.get("notes") ?? "").trim() || null,
      fileName,
      originalName,
      mimeType,
      size,
    },
  });

  revalidate();
  redirect("/ontvangen-facturen?ok=1");
}

/** Zet de status (Gecontroleerd / Betaald / Afwijking / Ontvangen). */
export async function setReceivedStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !RECEIVED_INVOICE_STATUS_VALUES.includes(status)) redirect("/ontvangen-facturen");
  const current = await db.receivedInvoice.findUnique({ where: { id }, select: { status: true } });
  if (!current) redirect("/ontvangen-facturen");
  // Betaald is een eindstation: nooit via een snelknop terugzetten (voorkomt dat een
  // betaalde factuur weer als openstaand/afwijking gaat meetellen).
  if (current.status === "PAID" && status !== "PAID") redirect("/ontvangen-facturen");
  await db.receivedInvoice.update({ where: { id }, data: { status } });
  revalidate();
  redirect("/ontvangen-facturen");
}

/**
 * Zet de "meetellen voor BTW-voorbelasting"-vlag. Bepaalt of de BTW van deze
 * ontvangen factuur meetelt in de aangifte (zie boekhouding.ts). Standaard uit,
 * omdat een self-billing inkoopfactuur dezelfde ZZP-betaling meestal al dekt.
 */
export async function setReceivedVatFlag(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const countForVat = formData.get("countForVat") === "on";
  await db.receivedInvoice.update({ where: { id }, data: { countForVat } });
  revalidatePath(`/ontvangen-facturen/${id}`);
  revalidatePath("/boekhouding");
}

/** Mail de medewerker professioneel over de afwijking. Geeft het resultaat terug
 *  (geen redirect) zodat de client-knop een pop-up kan tonen + zichzelf verbergen. */
export async function sendDiscrepancyMail(
  id: string,
): Promise<{ ok: boolean; simulated: boolean; reason?: string }> {
  if (!id) return { ok: false, simulated: false, reason: "error" };
  const res = await mailReceivedDiscrepancy(id);
  revalidate();
  if (res.ok) return { ok: true, simulated: res.simulated };
  return { ok: false, simulated: false, reason: res.noEmail ? "noemail" : "error" };
}

/** Verwijder een geregistreerde factuur (+ het geüploade bestand). */
export async function deleteReceivedInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/ontvangen-facturen");
  const inv = await db.receivedInvoice.findUnique({ where: { id }, select: { fileName: true } });
  await db.receivedInvoice.delete({ where: { id } });
  if (inv?.fileName) await deleteReceivedUpload(inv.fileName);
  revalidate();
  redirect("/ontvangen-facturen");
}
