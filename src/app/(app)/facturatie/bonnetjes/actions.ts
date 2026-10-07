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

/** Een niet-herkende bon op naam zetten. */
export async function wijsBonToe(formData: FormData) {
  await ingelogd();
  const id = String(formData.get("id") ?? "");
  const consultantId = String(formData.get("consultantId") ?? "") || null;
  if (id) await db.expense.update({ where: { id }, data: { consultantId } });
  revalidatePath(PAD);
  revalidatePath("/facturatie/inkoop");
  redirect(PAD);
}
