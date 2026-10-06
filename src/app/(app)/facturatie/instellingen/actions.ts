"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/session";
import { wisFacturatieTestdata } from "@/lib/facturatie-wissen";
import { parseForm, type FormState } from "@/lib/form";
import { getCompanySettings } from "@/lib/settings";
import { sampleSalesSendData } from "@/lib/verzenden";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { sendMail } from "@/lib/email";

const SettingsSchema = z.object({
  companyName: z.string().default("Q4S"),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  vatNumber: z.string().optional(),
  kvkNumber: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  gAccount: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  invoicePrefix: z.string().optional(),
  quotationNumber: z.string().optional(),
  invoiceStartNumber: z.coerce
    .number()
    .int("Vul een heel nummer in")
    .min(1, "Het startnummer is minimaal 1")
    .max(9999, "Het startnummer past in vier cijfers (maximaal 9999)")
    .default(1),
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
    bic: data.bic ?? "",
    gAccount: data.gAccount ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    website: data.website ?? "",
    invoicePrefix: data.invoicePrefix ?? "",
    quotationNumber: data.quotationNumber ?? "",
    invoiceStartNumber: data.invoiceStartNumber,
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
  revalidatePath("/facturatie/instellingen");
  revalidatePath("/facturatie/verkoop");
  redirect("/facturatie/instellingen?opgeslagen=1");
}

/** Alle facturen en urenstaten wissen (testdata) — alleen beheerder, na bevestiging. */
export async function wisTestdata() {
  if (!(await isAdminSession())) redirect("/facturatie/instellingen");
  await wisFacturatieTestdata();
  revalidatePath("/", "layout");
  redirect("/facturatie/instellingen?gewist=1");
}

/** Voorbeeld van de verkoopfactuur-mail (fictieve factuur) naar een intern adres — alleen beheerder. */
export async function stuurVoorbeeldFactuurmail(formData: FormData) {
  if (!(await isAdminSession())) redirect("/facturatie/instellingen");
  const to = String(formData.get("to") ?? "").trim().toLowerCase();
  // Alleen naar eigen Q4S-adressen: dit is een opmaakvoorbeeld, nooit naar klanten.
  if (!/^[^\s@]+@q4s\.nl$/.test(to)) redirect("/facturatie/instellingen?voorbeeld=adres");
  const data = sampleSalesSendData(await getCompanySettings());
  const pdf = await renderInvoicePdf(data.pdfDoc);
  const res = await sendMail({
    to,
    from: "Q4S <admin@q4s.nl>",
    subject: `[Voorbeeld] ${data.subject}`,
    html: data.html,
    text: data.text,
    attachments: [{ filename: data.pdfName, content: Buffer.from(pdf), contentType: "application/pdf" }],
  });
  redirect(`/facturatie/instellingen?voorbeeld=${!res.ok ? "fout" : res.simulated ? "test" : "verstuurd"}`);
}
