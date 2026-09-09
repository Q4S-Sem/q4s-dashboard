"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/** Sla de bedrijfsbrede e-mailhandtekening op. */
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
      emailSigName: str("name", 120),
      emailSigRole: str("role", 120),
      emailSigPhone: str("phone", 60),
      emailSigEmail: str("email", 160),
      emailSigWebsite: str("website", 160),
      emailSigAddress: str("address", 400),
      emailSigBadgesJson: JSON.stringify(badges),
      emailSigDisclaimer: str("disclaimer", 1000),
    },
  });

  revalidatePath("/gebruikers/handtekening");
  redirect("/gebruikers/handtekening?opgeslagen=1");
}
