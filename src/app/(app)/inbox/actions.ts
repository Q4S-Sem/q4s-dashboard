"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collectIncomingFiles } from "@/lib/file-intake";
import { isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { ensureAiKeysLoaded } from "@/lib/ai-keys";
import { saveInboxBytes, deleteInboxUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { isSpreadsheet } from "@/lib/excel";
import { startOfISOWeek, parseHours, round2, formatHours, formatDate } from "@/lib/utils";
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

/**
 * Leer-lus: vergelijk wat de AI las met wat er bij het bevestigen is vastgezet,
 * en bewaar de verschillen als aandachtspunten bij de afzender (SenderProfile).
 * Die worden bij een volgende staat van dezelfde afzender aan de AI meegegeven.
 * Best-effort: mag de bevestiging nooit blokkeren.
 */
async function recordCorrection(
  item: {
    senderEmail: string | null;
    extractedName: string | null;
    extractedTotalHours: number | null;
    extractedKilometers: number | null;
    extractedOvertimeHours: number | null;
    extractedWeekStart: Date | null;
  },
  confirmed: { hours: number; km: number | null; overtime: number | null; monday: Date },
) {
  const key = item.senderEmail?.trim().toLowerCase();
  if (!key) return; // leren gebeurt per e-mailafzender (bekend bij de mail-intake)

  const lines: string[] = [];
  const aiH = item.extractedTotalHours ?? 0;
  if (Math.abs(aiH - confirmed.hours) > 0.01) {
    lines.push(
      `Uren: AI las ${formatHours(aiH)} u, moest ${formatHours(confirmed.hours)} u zijn — tel per dag ALLE reguliere regels op (overuren erbuiten).`,
    );
  }
  const aiKm = item.extractedKilometers ?? 0;
  const cKm = confirmed.km ?? 0;
  if (Math.abs(aiKm - cKm) > 0.01) {
    lines.push(
      `Kilometers: AI las ${formatHours(aiKm)} km, moest ${formatHours(cKm)} km zijn — km staan mogelijk in een apart reisblok of los totaal dat gemist werd.`,
    );
  }
  const aiOt = item.extractedOvertimeHours ?? 0;
  const cOt = confirmed.overtime ?? 0;
  if (Math.abs(aiOt - cOt) > 0.01) {
    lines.push(
      `Overuren: AI las ${formatHours(aiOt)} u, moest ${formatHours(cOt)} u zijn — kijk naar de aparte overuren-sectie.`,
    );
  }
  if (
    item.extractedWeekStart &&
    startOfISOWeek(item.extractedWeekStart).getTime() !== confirmed.monday.getTime()
  ) {
    lines.push(
      `Week: AI koos de week van ${formatDate(item.extractedWeekStart)}, moest week van ${formatDate(confirmed.monday)} zijn — let op het jaar en de datums.`,
    );
  }
  if (lines.length === 0) return; // niks te leren

  const existing = await db.senderProfile.findUnique({ where: { key } });
  const prev = existing?.hints ? existing.hints.split("\n").filter(Boolean) : [];
  // Nieuwe aandachtspunten vooraan, dedup, cap op 8 regels / ~1200 tekens.
  const merged = [...lines, ...prev.filter((p) => !lines.includes(p))].slice(0, 8);
  const hints = merged.join("\n").slice(0, 1200);
  await db.senderProfile.upsert({
    where: { key },
    update: {
      hints,
      corrections: { increment: 1 },
      label: item.extractedName ?? existing?.label ?? null,
    },
    create: { key, hints, corrections: 1, label: item.extractedName ?? null },
  });
}

export async function confirmInbox(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const placementId = String(formData.get("placementId") ?? "");
  const weekStartRaw = String(formData.get("weekStart") ?? "");
  if (!id) return;

  const item = await db.timesheetInbox.findUnique({ where: { id } });
  if (!item) redirect("/inbox");
  if (!placementId) redirect(`/inbox/${id}?error=match`);
  if (!weekStartRaw) redirect(`/inbox/${id}?error=week`);

  const monday = startOfISOWeek(new Date(`${weekStartRaw}T00:00:00`));
  const kilometers = parseHours(String(formData.get("kilometers") ?? "")) || null;
  const overtimeHours = parseHours(String(formData.get("overtimeHours") ?? "")) || null;

  const entries: { date: Date; hours: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const raw = formData.get(`hours_${i}`);
    const hours = parseHours(typeof raw === "string" ? raw : "");
    if (hours > 0) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      entries.push({ date: d, hours });
    }
  }
  if (entries.length === 0) redirect(`/inbox/${id}?error=hours`);

  const placement = await db.placement.findUnique({ where: { id: placementId } });
  if (!placement) redirect(`/inbox/${id}?error=match`);

  let timesheetId: string | null = null;
  try {
    const ts = await db.timesheet.create({
      data: {
        placementId,
        weekStart: monday,
        status: "APPROVED",
        note: null,
        kilometers,
        overtimeHours,
        entries: { create: entries },
      },
    });
    timesheetId = ts.id;
  } catch {
    redirect(`/inbox/${id}?error=exists`);
  }

  await db.timesheetInbox.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      consultantId: placement!.consultantId,
      placementId,
      timesheetId,
      extractedWeekStart: monday,
    },
  });

  // Leer-lus: onthoud wat de AI anders had dan de bevestigde waarden (per afzender).
  const confirmedHours = round2(entries.reduce((s, e) => s + e.hours, 0));
  await recordCorrection(item!, {
    hours: confirmedHours,
    km: kilometers,
    overtime: overtimeHours,
    monday,
  }).catch(() => {});

  revalidatePath("/inbox");
  revalidatePath("/uren");
  revalidatePath("/", "layout");
  redirect(`/uren/${timesheetId}`);
}

// ---------- Reject / delete ----------

export async function rejectInbox(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.timesheetInbox.update({ where: { id }, data: { status: "REJECTED" } });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${id}`);
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
