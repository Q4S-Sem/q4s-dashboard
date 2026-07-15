"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { CRM_SCOPE_VALUES, BADGE_COLOR_VALUES } from "@/lib/domain";
import { currentRecruiterId, getStages } from "@/lib/crm";

const SettingsSchema = z.object({
  defaultScope: z.enum(CRM_SCOPE_VALUES).default("mine"),
  staleAfterDays: z.coerce.number().int().min(1).max(365).default(14),
  accent: z.string().default("brand"),
  targetDealsPerMonth: z.coerce.number().int().min(0).max(9999).default(0),
  targetPlacementsPerMonth: z.coerce.number().int().min(0).max(9999).default(0),
  targetRevenuePerMonth: z.coerce.number().min(0).default(0),
});

/** Sla de persoonlijke CRM-voorkeuren van de huidige recruiter op. */
export async function saveCrmSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await currentRecruiterId();
  if (!userId) return { error: "Geen recruiter geselecteerd. Maak eerst een gebruiker aan." };

  const parsed = parseForm(SettingsSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  // Visible stages: the checked stage keys. All (or none) checked → null = "toon alles".
  const allStages = await getStages();
  const checked = formData.getAll("visibleStages").map(String).filter(Boolean);
  const visibleStagesJson =
    checked.length === 0 || checked.length === allStages.length ? null : JSON.stringify(checked);

  const data = {
    defaultScope: d.defaultScope,
    staleAfterDays: d.staleAfterDays,
    accent: d.accent,
    targetDealsPerMonth: d.targetDealsPerMonth,
    targetPlacementsPerMonth: d.targetPlacementsPerMonth,
    targetRevenuePerMonth: d.targetRevenuePerMonth,
    visibleStagesJson,
  };

  await db.crmSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  revalidatePath("/crm");
  revalidatePath("/crm/instellingen");
  return { error: undefined, fieldErrors: undefined };
}

// --- Pipeline stage editor (global) ----------------------------------------

function stageKey(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "fase"}-${randomUUID().slice(0, 4)}`;
}

const StageSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  color: z.enum(BADGE_COLOR_VALUES).default("slate"),
  probability: z.coerce.number().int().min(0).max(100).default(0),
});

export async function createStage(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(StageSchema, formData);
  if (!parsed.success) return parsed.state;

  const last = await db.crmStage.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  // Insert new open stages before the closing (won/lost) columns by using the
  // lost stage's order as an anchor when present.
  const lost = await db.crmStage.findFirst({ where: { isLost: true }, select: { order: true } });
  const order = lost ? lost.order : (last?.order ?? 0) + 1;
  if (lost) {
    await db.crmStage.updateMany({ where: { order: { gte: lost.order } }, data: { order: { increment: 1 } } });
  }

  await db.crmStage.create({
    data: {
      key: stageKey(parsed.data.name),
      name: parsed.data.name,
      color: parsed.data.color,
      probability: parsed.data.probability,
      order,
    },
  });
  revalidatePath("/crm/instellingen");
  revalidatePath("/crm");
  return {};
}

export async function updateStage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "slate");
  const probability = Math.max(0, Math.min(100, Number(formData.get("probability") ?? 0) || 0));
  if (!id || !name) return;
  await db.crmStage.update({ where: { id }, data: { name, color, probability } });
  revalidatePath("/crm/instellingen");
  revalidatePath("/crm");
}

/** Wissel een fase één plek naar links/rechts. */
export async function moveStage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "");
  if (!id || (dir !== "up" && dir !== "down")) return;

  const stages = await db.crmStage.findMany({ orderBy: { order: "asc" } });
  const idx = stages.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= stages.length) return;

  const a = stages[idx];
  const b = stages[swapIdx];
  await db.$transaction([
    db.crmStage.update({ where: { id: a.id }, data: { order: b.order } }),
    db.crmStage.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  revalidatePath("/crm/instellingen");
  revalidatePath("/crm");
}

export async function deleteStage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.crmStage.delete({ where: { id } });
  } catch {
    // Has deals attached (onDelete: Restrict) — can't remove.
    redirect("/crm/instellingen?error=stage-in-use");
  }
  revalidatePath("/crm/instellingen");
  revalidatePath("/crm");
  redirect("/crm/instellingen");
}
