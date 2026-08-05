"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";

const ClientSchema = z.object({
  companyName: z.string().min(1, "Bedrijfsnaam is verplicht"),
  contactName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional().default("Nederland"),
  vatNumber: z.string().optional(),
  kvkNumber: z.string().optional(),
  invoiceEmail: z.string().optional(),
  website: z.string().optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(365).default(30),
  notes: z.string().optional(),
});

// Build the DB payload, turning undefined optionals into null so that
// clearing a field on edit actually clears it.
function toData(data: z.infer<typeof ClientSchema>) {
  return {
    companyName: data.companyName,
    contactName: data.contactName ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    address: data.address ?? null,
    postalCode: data.postalCode ?? null,
    city: data.city ?? null,
    country: data.country ?? "Nederland",
    vatNumber: data.vatNumber ?? null,
    kvkNumber: data.kvkNumber ?? null,
    invoiceEmail: data.invoiceEmail ?? null,
    website: data.website ?? null,
    paymentTermDays: data.paymentTermDays,
    notes: data.notes ?? null,
  };
}

export async function createClient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(ClientSchema, formData);
  if (!parsed.success) return parsed.state;

  const created = await db.client.create({ data: toData(parsed.data) });
  revalidatePath("/klanten");
  redirect(`/klanten/${created.id}`);
}

// Minimal "snel toevoegen" used inline from other forms (e.g. de plaatsing-flow
// als je een bedrijf vergeet). Maakt een klant met alleen de essentie aan en
// geeft 'm terug zodat de aanroeper 'm meteen kan selecteren — je verliest je
// half-ingevulde formulier niet. De rest vul je later op de klantpagina aan.
const QuickClientSchema = z.object({
  companyName: z.string().trim().min(1, "Bedrijfsnaam is verplicht"),
  contactName: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  city: z.string().trim().optional(),
  kvkNumber: z.string().trim().optional(),
  vatNumber: z.string().trim().optional(),
});

export type QuickClientResult =
  | { ok: true; client: { id: string; companyName: string } }
  | { ok: false; error: string };

export async function quickCreateClient(input: {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  kvkNumber?: string;
  vatNumber?: string;
}): Promise<QuickClientResult> {
  const parsed = QuickClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }
  const d = parsed.data;
  try {
    const created = await db.client.create({
      data: {
        companyName: d.companyName,
        contactName: d.contactName || null,
        email: d.email || null,
        phone: d.phone || null,
        address: d.address || null,
        postalCode: d.postalCode || null,
        city: d.city || null,
        kvkNumber: d.kvkNumber || null,
        vatNumber: d.vatNumber || null,
        country: "Nederland",
        paymentTermDays: 30,
      },
    });
    revalidatePath("/klanten");
    revalidatePath("/plaatsingen/nieuw");
    return { ok: true, client: { id: created.id, companyName: created.companyName } };
  } catch {
    return { ok: false, error: "Aanmaken mislukt — probeer het opnieuw." };
  }
}

export async function updateClient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende klant." };

  const parsed = parseForm(ClientSchema, formData);
  if (!parsed.success) return parsed.state;

  await db.client.update({ where: { id }, data: toData(parsed.data) });
  revalidatePath("/klanten");
  revalidatePath(`/klanten/${id}`);
  redirect(`/klanten/${id}`);
}

export async function deleteClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.client.delete({ where: { id } });
  } catch {
    // Likely has placements or invoices (onDelete: Restrict).
    redirect(`/klanten/${id}?error=in-use`);
  }
  revalidatePath("/klanten");
  redirect("/klanten");
}

// ---- Extra contactpersonen (zodat je altijd iemand kunt bereiken) ----

export async function addClientContact(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!clientId) return;
  if (!name) redirect(`/klanten/${clientId}?error=contact`);

  await db.clientContact.create({
    data: {
      clientId,
      name,
      role: String(formData.get("role") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidatePath(`/klanten/${clientId}`);
  redirect(`/klanten/${clientId}`);
}

export async function updateClientContact(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !clientId) return;
  if (!name) redirect(`/klanten/${clientId}?error=contact`);

  await db.clientContact.update({
    where: { id },
    data: {
      name,
      role: String(formData.get("role") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidatePath(`/klanten/${clientId}`);
  redirect(`/klanten/${clientId}`);
}

export async function deleteClientContact(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (id) await db.clientContact.delete({ where: { id } }).catch(() => {});
  revalidatePath(`/klanten/${clientId}`);
  redirect(`/klanten/${clientId}`);
}

// ---- Vaste notitie bij de klant (tabblad Notities) ----

export async function saveClientNotes(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.client.update({
    where: { id },
    data: { notes: String(formData.get("notes") ?? "").trim() || null },
  });
  revalidatePath(`/klanten/${id}`);
  revalidatePath(`/klanten/${id}/notities`);
  redirect(`/klanten/${id}/notities?saved=1`);
}
