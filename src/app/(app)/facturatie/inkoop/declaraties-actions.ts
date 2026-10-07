"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collectIncomingFiles } from "@/lib/file-intake";
import { isVisionConfigured } from "@/lib/ai";
import { runExpenseExtraction } from "@/lib/expense-extract";
import {
  saveExpenseBytes,
  deleteExpenseUpload,
  MAX_UPLOAD_BYTES,
} from "@/lib/uploads";
import { round2 } from "@/lib/utils";
import { EXPENSE_CATEGORY_VALUES, EXPENSE_STATUS_VALUES } from "@/lib/domain";

// ---------------------------------------------------------------------------
// Declaraties (bonnetjes) — het derde stuk uitgaand geld, naast de ZZP-facturen
// en de bank. Staat als tabblad onder /facturatie/inkoop.
//
// Het uitlezen gaat via `aiJSONFromFile` (de gedeelde, afgeschermde AI-weg).
// Een bon wordt nooit automatisch uitbetaald: de status zet je zelf.
// ---------------------------------------------------------------------------

const TAB = "/facturatie/inkoop?tab=declaraties";
const detail = (id: string) => `/facturatie/inkoop/declaraties/${id}`;

function herlaad() {
  revalidatePath("/facturatie/inkoop");
  revalidatePath("/facturatie/rapportage");
  revalidatePath("/", "layout");
}

// ---------- Uploaden (los, meerdere, of een ZIP) ----------

export async function uploadExpenses(formData: FormData) {
  const incoming = await collectIncomingFiles(formData);
  if (incoming.length === 0) redirect(`${TAB}&fout=upload`);

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
        // Niet uitgelezen? De bon blijft staan en wordt handmatig aangevuld.
      }
    }
  }

  if (created === 0) redirect(`${TAB}&fout=groot`);
  herlaad();
  redirect(TAB);
}

/** Handmatig "(opnieuw) uitlezen" op de declaratiepagina. */
export async function extractExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await runExpenseExtraction(id);
  } catch {
    redirect(`${detail(id)}?fout=ai`);
  }
  herlaad();
  revalidatePath(detail(id));
  redirect(detail(id));
}

// ---------- Status / bewerken / verwijderen ----------

export async function setExpenseStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !EXPENSE_STATUS_VALUES.includes(status)) return;
  await db.expense.update({ where: { id }, data: { status } });
  herlaad();
  revalidatePath(detail(id));
}

/**
 * BTW uit het formulier lezen. Twee wegen: een gekozen tarief (21/9/0) → BTW
 * berekenen uit het (incl.) bedrag, óf een handmatig BTW-bedrag. Leeg tarief én
 * leeg bedrag = null (onbekend — telt niet stil als €0 mee, zie boekhouding.ts).
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
    const vat = rate > 0 ? round2(amountIncl - amountIncl / (1 + rate / 100)) : 0;
    return { vatRate: rate, vatAmount: vat };
  }
  return { vatRate: null, vatAmount: null };
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
  // Checkbox: direct lezen (projectconventie); ongevinkt = niet in de FormData.
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
      rebill: formData.get("rebill") === "on" && Boolean(consultantId),
    },
  });

  herlaad();
  revalidatePath(detail(id));
  redirect(TAB);
}

/** Handmatige bon zonder foto — meteen invoeren, zonder op een upload te wachten. */
export async function createManualExpense(formData: FormData) {
  const amount = round2(Number(String(formData.get("amount") ?? "0").replace(",", ".")) || 0);
  if (amount <= 0) redirect(`${TAB}&fout=bedrag`);

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
      rebill: formData.get("rebill") === "on" && Boolean(consultantId),
    },
  });

  herlaad();
  redirect(TAB);
}

export async function deleteExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const exp = await db.expense.findUnique({ where: { id } });
  if (!exp) return;
  // Eerst de rij weg (de archief-hook kopieert de bon), daarna het bestand.
  await db.expense.delete({ where: { id } });
  if (exp.fileName) await deleteExpenseUpload(exp.fileName);
  herlaad();
  redirect(TAB);
}
