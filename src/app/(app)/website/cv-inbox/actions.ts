"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { scanMailbox } from "@/lib/mailbox";

/** Gated scan van de cv@q4s.nl-mailbox → nieuwe kandidaten (bron EMAIL). */
export async function scanMailboxAction() {
  const res = await scanMailbox();
  revalidatePath("/website/cv-inbox");
  revalidatePath("/", "layout");
  const params = new URLSearchParams({ bron: "email" });
  if (res.ok) params.set("scanned", String(res.imported));
  else params.set("scanfail", res.connected ? "pending" : "notconnected");
  redirect(`/website/cv-inbox?${params.toString()}`);
}
