"use server";

import { z } from "zod";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { CHALLENGE_STATUS_VALUES } from "@/lib/domain";
import { slugify } from "@/lib/vakproef";

const ChallengeSchema = z.object({
  title: z.string().min(1, "Titel is verplicht").max(160),
  discipline: z.string().optional(),
  question: z.string().min(1, "Vraag/casus is verplicht").max(2000),
  explanation: z.string().max(2000).optional(),
  status: z.enum(CHALLENGE_STATUS_VALUES).default("DRAFT"),
});

/** Read the 4 option slots + the chosen-correct slot into options[] + index. */
function readOptions(formData: FormData): {
  options: string[];
  correctIndex: number;
} {
  const slots = [1, 2, 3, 4].map((n) =>
    String(formData.get(`option${n}`) ?? "").trim().slice(0, 240),
  );
  const correctSlot = Number(formData.get("correctSlot") ?? "1"); // 1-based
  const options = slots.filter((o) => o !== "");
  // Map the chosen slot to its POSITION among the non-empty options — by
  // position, NOT by text, so duplicate option labels can't mis-target it.
  // -1 signals an empty/invalid correct slot (rejected by the caller).
  const chosenEmpty =
    !Number.isInteger(correctSlot) ||
    correctSlot < 1 ||
    correctSlot > 4 ||
    slots[correctSlot - 1] === "";
  const correctIndex = chosenEmpty
    ? -1
    : slots.slice(0, correctSlot - 1).filter((o) => o !== "").length;
  return { options, correctIndex };
}

export async function createChallenge(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(ChallengeSchema, formData);
  if (!parsed.success) return parsed.state;

  const { options, correctIndex } = readOptions(formData);
  if (options.length < 2) {
    return { error: "Geef minimaal 2 antwoordopties op." };
  }
  if (correctIndex < 0) {
    return {
      fieldErrors: { correctSlot: "Kies een ingevulde optie als juist antwoord." },
    };
  }

  const slug = `${slugify(parsed.data.title)}-${randomBytes(3).toString("hex")}`;
  const created = await db.challenge.create({
    data: {
      slug,
      title: parsed.data.title,
      discipline: parsed.data.discipline ?? null,
      question: parsed.data.question,
      optionsJson: JSON.stringify(options),
      correctIndex,
      explanation: parsed.data.explanation ?? null,
      status: parsed.data.status,
    },
  });
  revalidatePath("/socials/vakproef");
  redirect(`/socials/vakproef/${created.id}`);
}

export async function updateChallenge(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende vakproef." };

  const parsed = parseForm(ChallengeSchema, formData);
  if (!parsed.success) return parsed.state;

  const { options, correctIndex } = readOptions(formData);
  if (options.length < 2) {
    return { error: "Geef minimaal 2 antwoordopties op." };
  }
  if (correctIndex < 0) {
    return {
      fieldErrors: { correctSlot: "Kies een ingevulde optie als juist antwoord." },
    };
  }

  await db.challenge.update({
    where: { id },
    data: {
      title: parsed.data.title,
      discipline: parsed.data.discipline ?? null,
      question: parsed.data.question,
      optionsJson: JSON.stringify(options),
      correctIndex,
      explanation: parsed.data.explanation ?? null,
      status: parsed.data.status,
    },
  });
  revalidatePath("/socials/vakproef");
  revalidatePath(`/socials/vakproef/${id}`);
  redirect(`/socials/vakproef/${id}`);
}

export async function setChallengeStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !CHALLENGE_STATUS_VALUES.includes(status)) return;
  await db.challenge.update({ where: { id }, data: { status } });
  revalidatePath("/socials/vakproef");
  revalidatePath(`/socials/vakproef/${id}`);
}

export async function deleteChallenge(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.challenge.delete({ where: { id } });
  revalidatePath("/socials/vakproef");
  redirect("/socials/vakproef");
}
