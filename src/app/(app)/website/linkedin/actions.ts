"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

// "Gepost" = een gepubliceerde LinkedIn-post aan de vacature hangen. Daarmee gaat
// de vacature in de studio naar het archief en telt hij mee in "Gepost deze maand".

export async function markeerGepost(vacancyId: string, content: string) {
  const v = await db.vacancy.findUnique({ where: { id: vacancyId }, select: { title: true } });
  if (!v) return;
  await db.socialPost.create({
    data: { title: v.title, platform: "LINKEDIN", status: "PUBLISHED", publishedAt: new Date(), vacancyId, content },
  });
  revalidatePath("/website/linkedin");
  revalidatePath("/socials");
}

/** Per ongeluk op Gepost gedrukt: terug naar de lijst. */
export async function zetTerug(vacancyId: string) {
  await db.socialPost.deleteMany({ where: { vacancyId, platform: "LINKEDIN", status: "PUBLISHED" } });
  revalidatePath("/website/linkedin");
  revalidatePath("/socials");
}
