"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { AUTOMATION_TRIGGER_VALUES, AUTOMATION_PRESETS, runAutomations } from "@/lib/automation";
import { CRM_NOTE_TYPE_VALUES } from "@/lib/domain";

const RuleSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  trigger: z.enum(AUTOMATION_TRIGGER_VALUES),
  thresholdDays: z.coerce.number().int().min(0).max(3650).default(30),
  taskType: z.enum(CRM_NOTE_TYPE_VALUES).default("TASK"),
  template: z.string().min(1, "Tekst is verplicht"),
  dueOffsetDays: z.coerce.number().int().min(0).max(365).default(0),
});

export async function createRule(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(RuleSchema, formData);
  if (!parsed.success) return parsed.state;
  await db.automationRule.create({ data: { ...parsed.data, active: true } });
  revalidatePath("/dashboard/automatisering");
  redirect("/dashboard/automatisering?saved=1");
}

export async function toggleRule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) {
    const r = await db.automationRule.findUnique({ where: { id }, select: { active: true } });
    if (r) await db.automationRule.update({ where: { id }, data: { active: !r.active } });
  }
  revalidatePath("/dashboard/automatisering");
}

export async function deleteRule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await db.automationRule.delete({ where: { id } });
  revalidatePath("/dashboard/automatisering");
}

export async function addPreset(formData: FormData) {
  const idx = Number(formData.get("idx") ?? -1);
  const preset = AUTOMATION_PRESETS[idx];
  if (preset) await db.automationRule.create({ data: { ...preset, active: true } });
  revalidatePath("/dashboard/automatisering");
}

export async function runNow() {
  const res = await runAutomations();
  revalidatePath("/dashboard/automatisering");
  revalidatePath("/", "layout");
  redirect(`/dashboard/automatisering?ran=${res.total}`);
}
