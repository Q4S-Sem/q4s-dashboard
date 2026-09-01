"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collectIncomingFiles } from "@/lib/file-intake";
import { isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { ensureAiKeysLoaded } from "@/lib/ai-keys";
import { saveInboxBytes, deleteInboxUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { isSpreadsheet } from "@/lib/excel";
import { confirmInboxItem } from "@/lib/inbox-confirm";
import { runInboxExtraction } from "@/lib/inbox-extract";
import { pullInboxMail } from "@/lib/mail-intake";

// ---------- Upload (single, multiple, or a ZIP of timesheets) ----------

export async function uploadInboxTimesheet(formData: FormData) {
  const incoming = await collectIncomingFiles(formData);
  if (incoming.length === 0) redirect("/inbox?error=upload");

  // Dashboard-sleutels uit de DB in env laden (serverless: deze instance kan ze nog
  // niet hebben) — anders zou het automatisch uitlezen onterecht worden overgeslagen.
  await ensureAiKeysLoaded();
  // Excel-urenstaten gaan via tekst-AI (aiJSON), PDF/afbeelding via vision
  // (aiJSONFromFile) — dus AI is bruikbaar zodra één van beide klaarstaat.
  const aiReady = isAIConfigured() || isVisionConfigured();
  const createdIds: string[] = [];

  for (const c of incoming) {
    if (c.bytes.length > MAX_UPLOAD_BYTES) continue; // skip oversized, keep the rest
    const fileName = await saveInboxBytes(c.bytes, c.name);
    const created = await db.timesheetInbox.create({
      data: {
        source: "UPLOAD",
        status: "NEW",
        fileName,
        originalName: c.name,
        mimeType: c.mime,
        size: c.bytes.length,
      },
    });
    createdIds.push(created.id);

    // Auto-read each one so the per-week/per-person sort works immediately.
    if (aiReady) {
      try {
        await runInboxExtraction(created.id);
      } catch {
        // leave as NEW for manual extraction
      }
    }
  }

  if (createdIds.length === 0) redirect("/inbox?error=size");

  revalidatePath("/inbox");
  revalidatePath("/", "layout");
  // One file → open it; a batch/ZIP → back to the grouped inbox.
  if (createdIds.length === 1) redirect(`/inbox/${createdIds[0]}`);
  redirect("/inbox");
}

// ---------- Postvak nu ophalen (M365-intake, handmatige trigger) ----------

export async function pullMailNow(_formData: FormData) {
  const r = await pullInboxMail();
  revalidatePath("/inbox");
  revalidatePath("/", "layout");
  if (!r.connected) redirect("/inbox?pull=off");
  if (!r.ok) redirect("/inbox?pull=err");
  redirect(`/inbox?pull=ok&mails=${r.mails}&ts=${r.timesheets}&inv=${r.invoices}&skip=${r.skipped}`);
}

// ---------- AI extraction ----------
// De uitlees-kern (runInboxExtraction) staat in @/lib/inbox-extract, zodat zowel
// deze handmatige knop/upload als de e-mail-webhook (api/inbox/email) elke bijlage
// apart uitlezen en op de EIGEN week sorteren.

export async function extractInbox(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const item = await db.timesheetInbox.findUnique({ where: { id } });
  if (!item) redirect("/inbox");

  // Unsupported type → dedicated message (not an AI error).
  const lowerName = item.originalName.toLowerCase();
  const supported =
    isSpreadsheet(item.originalName, item.mimeType) ||
    item.mimeType.includes("pdf") ||
    lowerName.endsWith(".pdf") ||
    /^image\/(png|jpe?g|gif|webp)$/.test(item.mimeType);
  if (!supported) redirect(`/inbox/${id}?error=type`);

  await ensureAiKeysLoaded();
  try {
    await runInboxExtraction(id);
  } catch {
    redirect(`/inbox/${id}?error=ai`);
  }

  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
  redirect(`/inbox/${id}`);
}

// ---------- Confirm into a real Timesheet ----------
// De kern (urenstaat aanmaken + leer-lus per afzender) staat in
// @/lib/inbox-confirm, zodat deze knop en het in één keer goedkeuren op
// /verwerken/controle precies hetzelfde doen. Hier alleen nog: FormData lezen,
// foutcode → melding, en de redirect.

export async function confirmInbox(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const result = await confirmInboxItem({
    id,
    placementId: String(formData.get("placementId") ?? ""),
    weekStart: String(formData.get("weekStart") ?? ""),
    kilometers: String(formData.get("kilometers") ?? ""),
    overtimeHours: String(formData.get("overtimeHours") ?? ""),
    hours: Array.from({ length: 7 }, (_, i) => {
      const raw = formData.get(`hours_${i}`);
      return typeof raw === "string" ? raw : "";
    }),
  });

  if (!result.ok) {
    if (result.error === "missing" || result.error === "id") redirect("/inbox");
    redirect(`/inbox/${id}?error=${result.error}`);
  }

  revalidatePath("/inbox");
  revalidatePath("/uren");
  revalidatePath("/", "layout");
  redirect(`/uren/${result.timesheetId}`);
}

// ---------- Reject / delete ----------

export async function rejectInbox(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Afgewezen = niet meer aan het wachten: ook uit de wachtkamer halen.
  await db.timesheetInbox.update({
    where: { id },
    data: { status: "REJECTED", wachtkamerSince: null, wachtkamerReason: null },
  });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
  revalidatePath("/verwerken/wachtkamer");
  redirect(`/inbox/${id}`);
}

export async function deleteInbox(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const item = await db.timesheetInbox.findUnique({ where: { id } });
  if (!item) return;
  // Delete first so the archive hook can copy the file, then remove the original.
  await db.timesheetInbox.delete({ where: { id } });
  await deleteInboxUpload(item.fileName);
  revalidatePath("/inbox");
  redirect("/inbox");
}
