"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/** Sla de BEDRIJFSBREDE delen van de e-mailhandtekening op (adres, website,
 *  keurmerken, disclaimer). Naam/functie/telefoon/e-mail horen bij het account
 *  en worden bij Gebruikers beheerd, niet hier. */
export async function saveSignature(formData: FormData): Promise<void> {
  const str = (k: string, max = 300) =>
    String(formData.get(k) ?? "").trim().slice(0, max);

  // Keurmerk-logo's: één URL per regel → JSON-lijst (alleen https).
  const badges = str("badges", 2000)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^https?:\/\//i.test(l));

  await db.companySettings.update({
    where: { id: "default" },
    data: {
      emailSigAddress: str("address", 400),
      emailSigWebsite: str("website", 160),
      emailSigBadgesJson: JSON.stringify(badges),
      emailSigDisclaimer: str("disclaimer", 1000),
    },
  });

  revalidatePath("/gebruikers/handtekening");
  redirect("/gebruikers/handtekening?opgeslagen=1");
}
