"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CV_SECTIONS, DEFAULT_SECTION_ORDER } from "@/lib/cv-template";

const HEX = /^#[0-9a-f]{6}$/i;

/** Sla de vormgeving van het Q4S-CV op. Eén huisstijl voor het hele bedrijf. */
export async function saveCvTemplate(formData: FormData): Promise<void> {
  const ingevoerd = String(formData.get("cvAccent") ?? "").trim();
  // Het kleurveld levert altijd een geldige hex; valt hij toch weg, dan houden
  // we de huidige kleur aan in plaats van het formulier te laten mislukken.
  const huidig = await db.companySettings.findUnique({
    where: { id: "default" },
    select: { cvAccent: true },
  });
  const accent = HEX.test(ingevoerd) ? ingevoerd : (huidig?.cvAccent ?? "#e8430a");

  // De volgorde komt als "sectie:positie"-paren uit de nummervelden.
  const geldig = new Set<string>(CV_SECTIONS.map((s) => s.key));
  const posities = CV_SECTIONS.map((s) => ({
    key: s.key,
    pos: Number(formData.get(`pos-${s.key}`) ?? 99),
  }))
    .filter((x) => geldig.has(x.key))
    .sort((a, b) => (Number.isFinite(a.pos) ? a.pos : 99) - (Number.isFinite(b.pos) ? b.pos : 99))
    .map((x) => x.key);

  await db.companySettings.update({
    where: { id: "default" },
    data: {
      cvAccent: accent,
      cvLayout: formData.get("cvLayout") === "EEN_KOLOM" ? "EEN_KOLOM" : "TWEE_KOLOMS",
      cvShowPhoto: formData.get("cvShowPhoto") === "on",
      cvShowSkillBars: formData.get("cvShowSkillBars") === "on",
      cvShowLogo: formData.get("cvShowLogo") === "on",
      cvSectionOrder: JSON.stringify(posities.length ? posities : DEFAULT_SECTION_ORDER),
      cvFooterNote: String(formData.get("cvFooterNote") ?? "").trim().slice(0, 200),
    },
  });

  revalidatePath("/gebruikers/cv-template");
  revalidatePath("/socials/cv-generator", "layout");
  redirect("/gebruikers/cv-template?opgeslagen=1");
}
