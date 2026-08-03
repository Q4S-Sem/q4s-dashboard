"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collectIncomingFiles } from "@/lib/file-intake";
import { aiJSONFromFile, isVisionConfigured } from "@/lib/ai";
import {
  saveExpenseBytes,
  readExpenseBase64,
  deleteExpenseUpload,
  MAX_UPLOAD_BYTES,
} from "@/lib/uploads";
import { round2 } from "@/lib/utils";
import { EXPENSE_CATEGORY_VALUES, EXPENSE_STATUS_VALUES } from "@/lib/domain";

// ---------- AI receipt extraction ----------

type Receipt = {
  date: string;
  vendor: string;
  amount: number;
  vatAmount: number;
  category: string;
  description: string;
  notes: string;
};

const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string", description: "Datum op de bon als YYYY-MM-DD; lege string als onbekend." },
    vendor: { type: "string", description: "Naam van de winkel/leverancier; lege string als onbekend." },
    amount: { type: "number", description: "Totaalbedrag inclusief BTW in euro. 0 als onbekend." },
    vatAmount: { type: "number", description: "BTW-bedrag in euro. 0 als onbekend." },
    category: { type: "string", description: "Eén van: REIS, MATERIAAL, VERBLIJF, ETEN, PARKEREN, TOL, OVERIG." },
    description: { type: "string", description: "Korte omschrijving van de uitgave." },
    notes: { type: "string", description: "Onzekerheden; anders lege string." },
  },
  required: ["date", "vendor", "amount", "vatAmount", "category", "description", "notes"],
};

const SYSTEM_RECEIPT = `Je bent een nauwkeurige administratieve assistent bij Q4S, een Nederlands detacheringsbureau. Je leest binnengekomen bonnetjes/kassabonnen (declaraties) uit die gedetacheerde vakmensen indienen. Elke bon ziet er anders uit.

Lees de bon zorgvuldig en haal de gegevens er exact uit. Verzin niets: laat een veld leeg (lege string) of 0 als je het niet zeker uit de bon kunt halen. Kies de meest passende categorie uit: REIS (brandstof/tanken/OV/trein/km-vergoeding), MATERIAAL (gereedschap/materialen), VERBLIJF (hotel/overnachting), ETEN (eten & drinken/horeca), PARKEREN (parkeergeld/parkeergarage), TOL (tol- en tunnelgeld: Westerscheldetunnel, Kiltunnel, Liefkenshoektunnel, tolwegen, buitenlandse péage/Maut/tolvignet/telepass), OVERIG (rest). Let op: parkeren en tol zijn APARTE categorieën — een tunnel- of tolheffing hoort bij TOL, niet bij PARKEREN. Geef het resultaat terug volgens het JSON-schema.`;

async function runExpenseExtraction(id: string): Promise<void> {
  const exp = await db.expense.findUnique({ where: { id } });
  if (!exp) throw new Error("Declaratie niet gevonden.");

  // Een bon mag nu ook handmatig zonder foto bestaan → dan valt er niets uit te lezen.
  if (!exp.fileName || !exp.mimeType || !exp.originalName) {
    throw new Error("Geen bestand om uit te lezen.");
  }

  const lower = exp.originalName.toLowerCase();
  let mediaType = "";
  if (exp.mimeType.includes("pdf") || lower.endsWith(".pdf")) {
    mediaType = "application/pdf";
  } else if (/^image\/(png|jpe?g|gif|webp)$/.test(exp.mimeType)) {
    mediaType = exp.mimeType;
  } else {
    throw new Error("Niet-ondersteund bestandstype.");
  }

  const data = await aiJSONFromFile<Receipt>({
    system: SYSTEM_RECEIPT,
    prompt:
      "Lees dit bonnetje / deze kassabon uit en geef datum, leverancier, totaalbedrag, BTW, categorie en een korte omschrijving terug.",
    schema: RECEIPT_SCHEMA,
    file: { base64: await readExpenseBase64(exp.fileName), mediaType },
    maxTokens: 1200,
    effort: "medium",
  });

  let date: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(data.date)) date = new Date(`${data.date}T00:00:00`);
  const category = EXPENSE_CATEGORY_VALUES.includes(data.category) ? data.category : "OVERIG";

  await db.expense.update({
    where: { id },
    data: {
      date,
      vendor: data.vendor?.trim() || null,
      amount: typeof data.amount === "number" && data.amount > 0 ? round2(data.amount) : 0,
      vatAmount:
        typeof data.vatAmount === "number" && data.vatAmount > 0 ? round2(data.vatAmount) : null,
      category,
      description: data.description?.trim() || null,
      aiNotes: data.notes?.trim() || null,
    },
  });
}

// ---------- Upload (single, multiple, or a ZIP of receipts) ----------

export async function uploadExpenses(formData: FormData) {
  const incoming = await collectIncomingFiles(formData);
  if (incoming.length === 0) redirect("/declaraties?error=upload");

  const aiReady = isVisionConfigured();
  let created = 0;

  for (const c of incoming) {
    if (c.bytes.length > MAX_UPLOAD_BYTES) continue;
    const fileName = await saveExpenseBytes(c.bytes, c.name);
    const exp = await db.expense.create({
      data: {
        source: "UPLOAD",
        status: "NEW",
        fileName,
        originalName: c.name,
        mimeType: c.mime,
        size: c.bytes.length,
      },
    });
    created++;
    if (aiReady) {
      try {
        await runExpenseExtraction(exp.id);
      } catch {
        // leave for manual entry
      }
    }
  }

  if (created === 0) redirect("/declaraties?error=size");
  revalidatePath("/declaraties");
  revalidatePath("/", "layout");
  redirect("/declaraties");
}

/** Manual "(opnieuw) uitlezen" button on the detail page. */
export async function extractExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await runExpenseExtraction(id);
  } catch {
    redirect(`/declaraties/${id}?error=ai`);
  }
  revalidatePath("/declaraties");
  revalidatePath(`/declaraties/${id}`);
  redirect(`/declaraties/${id}`);
}

// ---------- Status / edit / delete ----------

export async function setExpenseStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !EXPENSE_STATUS_VALUES.includes(status)) return;
  await db.expense.update({ where: { id }, data: { status } });
  revalidatePath("/declaraties");
  revalidatePath(`/declaraties/${id}`);
}

export async function updateExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const dateRaw = String(formData.get("date") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "OVERIG");
  const category = EXPENSE_CATEGORY_VALUES.includes(categoryRaw) ? categoryRaw : "OVERIG";
  const amount = round2(Number(String(formData.get("amount") ?? "0").replace(",", ".")) || 0);
  const consultantId = String(formData.get("consultantId") ?? "") || null;
  const { vatRate, vatAmount } = readVat(formData, amount);
  // Checkbox: lees direct (conventie). Aanwezig in het bewerk-formulier, dus
  // ongevinkt = niet in de FormData = niet aftrekbaar.
  const vatDeductible = formData.get("vatDeductible") === "on";

  await db.expense.update({
    where: { id },
    data: {
      date: dateRaw ? new Date(`${dateRaw}T00:00:00`) : null,
      category,
      vendor: String(formData.get("vendor") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      amount,
      vatRate,
      vatAmount,
      vatDeductible,
      consultantId,
    },
  });

  revalidatePath("/declaraties");
  revalidatePath("/boekhouding");
  revalidatePath(`/declaraties/${id}`);
  redirect("/declaraties");
}

/**
 * BTW uit het formulier lezen. Twee wegen: een gekozen tarief (21/9/0) → BTW
 * berekenen uit het (incl.) bedrag, óf een handmatig BTW-bedrag. Een leeg tarief
 * én leeg bedrag = null (onbekend, telt niet stil als €0 mee — zie boekhouding.ts).
 */
function readVat(formData: FormData, amountIncl: number): { vatRate: number | null; vatAmount: number | null } {
  const rateRaw = String(formData.get("vatRate") ?? "").trim();
  const manualRaw = String(formData.get("vatAmount") ?? "").trim().replace(",", ".");

  if (manualRaw) {
    const v = round2(Number(manualRaw) || 0);
    const rate = rateRaw && /^\d+(\.\d+)?$/.test(rateRaw) ? Number(rateRaw) : null;
    return { vatRate: rate, vatAmount: v };
  }
  if (rateRaw && /^\d+(\.\d+)?$/.test(rateRaw)) {
    const rate = Number(rateRaw);
    // BTW uit een incl.-bedrag: bedrag − bedrag/(1+tarief). Bij 0% → €0.
    const vat = rate > 0 ? round2(amountIncl - amountIncl / (1 + rate / 100)) : 0;
    return { vatRate: rate, vatAmount: vat };
  }
  return { vatRate: null, vatAmount: null };
}

/**
 * Handmatige bon zonder foto. Precies waar de gebruiker om vroeg: een bonnetje
 * meteen invoeren (bedrag + BTW + aftrekbaarheid) zonder te wachten op R2/upload.
 */
export async function createManualExpense(formData: FormData) {
  const amount = round2(Number(String(formData.get("amount") ?? "0").replace(",", ".")) || 0);
  if (amount <= 0) redirect("/declaraties?error=bedrag");

  const dateRaw = String(formData.get("date") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "OVERIG");
  const category = EXPENSE_CATEGORY_VALUES.includes(categoryRaw) ? categoryRaw : "OVERIG";
  const { vatRate, vatAmount } = readVat(formData, amount);
  const vatDeductible = formData.get("vatDeductible") === "on";
  const consultantId = String(formData.get("consultantId") ?? "") || null;

  await db.expense.create({
    data: {
      source: "UPLOAD",
      status: "NEW",
      date: dateRaw ? new Date(`${dateRaw}T00:00:00`) : null,
      category,
      vendor: String(formData.get("vendor") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      amount,
      vatRate,
      vatAmount,
      vatDeductible,
      consultantId,
      // geen fileName/originalName/mimeType — handmatige bon zonder foto
    },
  });

  revalidatePath("/declaraties");
  revalidatePath("/boekhouding");
  redirect("/declaraties");
}

export async function deleteExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const exp = await db.expense.findUnique({ where: { id } });
  if (!exp) return;
  // Delete first so the archive hook can copy the receipt, then remove the original.
  await db.expense.delete({ where: { id } });
  if (exp.fileName) await deleteExpenseUpload(exp.fileName); // handmatige bon heeft geen bestand
  revalidatePath("/declaraties");
  revalidatePath("/boekhouding");
  redirect("/declaraties");
}
