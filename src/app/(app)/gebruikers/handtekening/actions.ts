"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/** Sla de BEDRIJFSBREDE delen van de e-mailhandtekening op (adres, website,
 *  disclaimer). Naam/functie/telefoon/e-mail horen bij het account/medewerker
 *  en worden daar beheerd. De keurmerk-logo's (DNV/VCU/SNA) staan standaard
 *  ingebed en blijven ongemoeid. */
export async function saveSignature(formData: FormData): Promise<void> {
  const str = (k: string, max = 300) =>
    String(formData.get(k) ?? "").trim().slice(0, max);

  await db.companySettings.update({
    where: { id: "default" },
    data: {
      emailSigAddress: str("address", 400),
      emailSigWebsite: str("website", 160),
      emailSigDisclaimer: str("disclaimer", 1000),
    },
  });

  revalidatePath("/gebruikers/handtekening");
  redirect("/gebruikers/handtekening?opgeslagen=1");
}
