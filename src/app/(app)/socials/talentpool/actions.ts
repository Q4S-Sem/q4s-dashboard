"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  RECRUITMENT_CHANNEL_VALUES,
  RECRUITMENT_CHANNELS,
  DEFAULT_CHANNEL_KEYS,
  labelFor,
} from "@/lib/domain";

/** Short, URL-safe token for a tracked link. */
function genToken(): string {
  return randomBytes(6).toString("base64url"); // ~8 chars
}

/** A token guaranteed not to collide with an existing one. */
async function uniqueToken(): Promise<string> {
  let token = genToken();
  for (let i = 0; i < 5; i++) {
    const exists = await db.postLink.findUnique({ where: { token } });
    if (!exists) return token;
    token = genToken();
  }
  return token;
}

/** Keep redirect destinations internal (no off-origin). */
function safeInternalPath(raw: string, fallback = "/talentpool"): string {
  try {
    const u = new URL(raw, "http://x.invalid");
    return u.origin === "http://x.invalid" ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}

export async function createPostLink(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim().slice(0, 120);
  if (!label) redirect("/socials/talentpool");

  const channelRaw = String(formData.get("channel") ?? "").trim();
  const channel = RECRUITMENT_CHANNEL_VALUES.includes(channelRaw) ? channelRaw : null;
  const destination = safeInternalPath(
    String(formData.get("destination") ?? "/talentpool").trim() || "/talentpool",
  );
  const socialPostId =
    String(formData.get("socialPostId") ?? "").trim() || null;

  await db.postLink.create({
    data: { token: await uniqueToken(), label, channel, destination, socialPostId },
  });
  revalidatePath("/socials/talentpool");
  redirect("/socials/talentpool");
}

/**
 * One click → a tracked talentpool link for every recruitment channel that
 * doesn't have one yet. Idempotent: re-running only fills the gaps.
 */
export async function createChannelLinks() {
  const existing = await db.postLink.findMany({ select: { channel: true } });
  const have = new Set(existing.map((l) => l.channel).filter(Boolean));

  for (const channel of DEFAULT_CHANNEL_KEYS) {
    if (have.has(channel)) continue;
    await db.postLink.create({
      data: {
        token: await uniqueToken(),
        label: `${labelFor(RECRUITMENT_CHANNELS, channel)} — Talentpool`,
        channel,
        destination: "/talentpool",
      },
    });
  }

  revalidatePath("/socials/talentpool");
  redirect("/socials/talentpool");
}

export async function deletePostLink(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.postLink.delete({ where: { id } });
  revalidatePath("/socials/talentpool");
  redirect("/socials/talentpool");
}
