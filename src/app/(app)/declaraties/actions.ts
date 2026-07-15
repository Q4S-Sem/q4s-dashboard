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
    category: { type: "string", description: "Eén van: REIS, MATERIAAL, VERBLIJF, ETEN, PARKEREN, OVERIG." },
    description: { type: "string", description: "Korte omschrijving van de uitgave." },
    notes: { type: "string", description: "Onzekerheden; anders lege string." },
  },
  required: ["date", "vendor", "amount", "vatAmount", "category", "description", "notes"],
};

const SYSTEM_RECEIPT = `Je bent een nauwkeurige administratieve assistent bij Q4S, een Nederlands detacheringsbureau. Je leest binnengekomen bonnetjes/kassabonnen (declaraties) uit die gedetacheerde vakmensen indienen. Elke bon ziet er anders uit.

Lees de bon zorgvuldig en haal de gegevens er exact uit. Verzin niets: laat een veld leeg (lege string) of 0 als je het niet zeker uit de bon kunt halen. Kies de meest passende categorie uit: REIS (brandstof/OV/km), MATERIAAL (gereedschap/materialen), VERBLIJF (hotel/overnachting), ETEN (eten & drinken), PARKEREN (parkeren/tol), OVERIG. Geef het resultaat terug volgens het JSON-schema.`;

async function runExpenseExtraction(id: string): Promise<void> {
  const exp = await db.expense.findUnique({ where: { id } });
  if (!exp) throw new Error("Declaratie niet gevonden.");

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
  const vatRaw = String(formData.get("vatAmount") ?? "").trim().replace(",", ".");
  const vatAmount = vatRaw ? round2(Number(vatRaw) || 0) : null;
  const consultantId = String(formData.get("consultantId") ?? "") || null;

  await db.expense.update({
    where: { id },
    data: {
      date: dateRaw ? new Date(`${dateRaw}T00:00:00`) : null,
      category,
      vendor: String(formData.get("vendor") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      amount,
      vatAmount,
      consultantId,
    },
  });

  revalidatePath("/declaraties");
  revalidatePath(`/declaraties/${id}`);
  redirect("/declaraties");
}

export async function deleteExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const exp = await db.expense.findUnique({ where: { id } });
  if (!exp) return;
  // Delete first so the archive hook can copy the receipt, then remove the original.
  await db.expense.delete({ where: { id } });
  await deleteExpenseUpload(exp.fileName);
  revalidatePath("/declaraties");
  redirect("/declaraties");
}
