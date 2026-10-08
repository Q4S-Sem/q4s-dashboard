"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { pullInboxMail } from "@/lib/mail-intake";
import { authRequired, currentUser } from "@/lib/session";

const PAD = "/facturatie/bonnetjes";

async function ingelogd() {
  if (authRequired() && !(await currentUser())) redirect("/login");
}

/** "Mail nu ophalen": dezelfde intake als de dagelijkse cron (bonnetjes, urenstaten, CV's). */
export async function haalMailOp() {
  await ingelogd();
  const r = await pullInboxMail({ max: 30 });
  revalidatePath(PAD);
  revalidatePath("/facturatie");
  const q = r.connected ? `opgehaald=${r.receipts}&mails=${r.mails}` : "fout=niet-gekoppeld";
  redirect(`${PAD}?${q}${r.reason ? `&reden=${encodeURIComponent(r.reason)}` : ""}`);
}

/** Een niet-herkende bon op naam zetten — van een persoon of van Q4S zelf. */
export async function wijsBonToe(formData: FormData) {
  await ingelogd();
  const id = String(formData.get("id") ?? "");
  const keuze = String(formData.get("consultantId") ?? "");
  const data =
    keuze === "Q4S"
      ? { consultantId: null, forQ4S: true, rebill: false }
      : { consultantId: keuze || null, forQ4S: false };
  if (id) await db.expense.update({ where: { id }, data });
  revalidatePath(PAD);
  revalidatePath("/facturatie/inkoop");
  redirect(PAD);
}
