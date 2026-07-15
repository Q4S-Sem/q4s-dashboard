"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { TARGET_STATUS_VALUES } from "@/lib/domain";

const TargetClientSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  vmsConnectorId: z.string().optional(),
  sector: z.string().optional(),
  status: z.enum(TARGET_STATUS_VALUES).default("PROSPECT"),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  notes: z.string().optional(),
});

// Build the DB payload, turning undefined optionals into null so that
// clearing a field on edit actually clears it.
function toData(data: z.infer<typeof TargetClientSchema>) {
  return {
    name: data.name,
    priority: data.priority,
    vmsConnectorId: data.vmsConnectorId ?? null,
    sector: data.sector ?? null,
    status: data.status,
    contactName: data.contactName ?? null,
    contactEmail: data.contactEmail ?? null,
    notes: data.notes ?? null,
  };
}

export async function createTargetClient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(TargetClientSchema, formData);
  if (!parsed.success) return parsed.state;

  const created = await db.targetClient.create({ data: toData(parsed.data) });
  revalidatePath("/opdrachtgevers");
  redirect(`/opdrachtgevers/${created.id}`);
}

export async function updateTargetClient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende opdrachtgever." };

  const parsed = parseForm(TargetClientSchema, formData);
  if (!parsed.success) return parsed.state;

  await db.targetClient.update({ where: { id }, data: toData(parsed.data) });
  revalidatePath("/opdrachtgevers");
  revalidatePath(`/opdrachtgevers/${id}`);
  redirect(`/opdrachtgevers/${id}`);
}

export async function deleteTargetClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.targetClient.delete({ where: { id } });
  } catch {
    // Likely has applications attached (onDelete: Restrict).
    redirect(`/opdrachtgevers/${id}?error=in-use`);
  }
  revalidatePath("/opdrachtgevers");
  redirect("/opdrachtgevers");
}
