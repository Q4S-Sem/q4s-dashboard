"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";

const SettingsSchema = z.object({
  companyName: z.string().default("Q4S"),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  vatNumber: z.string().optional(),
  kvkNumber: z.string().optional(),
  iban: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  invoicePrefix: z.string().optional(),
  defaultVatRate: z.coerce.number().min(0).max(100).default(21),
  defaultPaymentTermDays: z.coerce.number().int().min(0).max(365).default(30),
  invoiceFooter: z.string().optional(),
  mailRedirectTo: z
    .string()
    .optional()
    .refine((v) => !v || !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), {
      message: "Vul een geldig e-mailadres in (of laat leeg om normaal te versturen).",
    }),
});

// Build the DB payload. These columns are non-null with defaults, so undefined
// optionals become empty strings rather than null.
function toData(data: z.infer<typeof SettingsSchema>) {
  return {
    companyName: data.companyName,
    address: data.address ?? "",
    postalCode: data.postalCode ?? "",
    city: data.city ?? "",
    country: data.country ?? "",
    vatNumber: data.vatNumber ?? "",
    kvkNumber: data.kvkNumber ?? "",
    iban: data.iban ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    website: data.website ?? "",
    invoicePrefix: data.invoicePrefix ?? "",
    defaultVatRate: data.defaultVatRate,
    defaultPaymentTermDays: data.defaultPaymentTermDays,
    invoiceFooter: data.invoiceFooter ?? "",
    mailRedirectTo: data.mailRedirectTo?.trim() ?? "",
  };
}

export async function updateSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(SettingsSchema, formData);
  if (!parsed.success) return parsed.state;

  const data = toData(parsed.data);
  await db.companySettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
  revalidatePath("/instellingen");
  redirect("/instellingen?saved=1");
}
