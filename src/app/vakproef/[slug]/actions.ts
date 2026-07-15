"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { rematchCandidate } from "@/lib/matching";
import { parseOptions } from "@/lib/vakproef";
import { clientIp, rateLimited } from "@/lib/ratelimit";

const AttemptSchema = z.object({
  firstName: z.string().min(1, "Voornaam is verplicht").max(100),
  lastName: z.string().max(100).optional(),
  email: z.string().email("Vul een geldig e-mailadres in").max(254).optional(),
  discipline: z.string().max(80).optional(),
});

/**
 * Public: someone does the Vakproef. Records the attempt, captures them as a
 * Talentpool candidate (attributed to the challenge), and shows their result.
 */
export async function submitAttempt(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: "Onbekende vakproef." };

  // Honeypot: bots fill this; pretend success.
  if (String(formData.get("website") ?? "").trim() !== "") {
    redirect(`/vakproef/${slug}?done=1&ok=0`);
  }
  // Layered gates: the IP key is spoofable (x-forwarded-for), so a global
  // per-challenge cap bounds the worst case regardless, and an email throttle
  // (below, once parsed) stops repeat submits. Real bot protection (trusted-proxy
  // IP or captcha) is a pre-production hardening step.
  if (
    rateLimited(`vakproef-ip:${await clientIp()}`, 8, 60_000) ||
    rateLimited(`vakproef-all:${slug}`, 60, 60_000)
  ) {
    return { error: "Te veel inzendingen op dit moment. Probeer het zo opnieuw." };
  }

  const challenge = await db.challenge.findUnique({ where: { slug } });
  if (!challenge || challenge.status !== "ACTIVE") {
    return { error: "Deze vakproef is niet (meer) beschikbaar." };
  }

  const parsed = parseForm(AttemptSchema, formData);
  if (!parsed.success) return parsed.state;
  const data = parsed.data;

  // Non-spoofable throttle: one e-mail can't flood a challenge with rows.
  if (
    data.email &&
    rateLimited(`vakproef-email:${data.email.toLowerCase()}`, 3, 600_000)
  ) {
    return { error: "Je hebt deze vakproef al ingestuurd." };
  }

  const options = parseOptions(challenge.optionsJson);
  const chosenIndex = Number(formData.get("chosenIndex"));
  if (
    !Number.isInteger(chosenIndex) ||
    chosenIndex < 0 ||
    chosenIndex >= options.length
  ) {
    return { fieldErrors: { chosenIndex: "Kies een antwoord." } };
  }

  const correct = chosenIndex === challenge.correctIndex;

  const candidate = await db.candidate.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName ?? "",
      email: data.email ?? null,
      discipline: data.discipline ?? challenge.discipline ?? null,
      source: "TALENTPOOL",
      sourceDetail: `vakproef:${slug}`.slice(0, 120),
      notes: `Aangemeld via Vakproef "${challenge.title}" — ${
        correct ? "goed beantwoord" : "deelgenomen"
      }`,
    },
  });

  await db.challengeAttempt.create({
    data: { challengeId: challenge.id, candidateId: candidate.id, chosenIndex, correct },
  });

  try {
    await rematchCandidate(candidate.id);
  } catch {
    // never lose the lead on a matching hiccup
  }

  redirect(`/vakproef/${slug}?done=1&ok=${correct ? 1 : 0}`);
}
