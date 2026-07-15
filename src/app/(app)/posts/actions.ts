"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { aiText } from "@/lib/ai";
import {
  SOCIAL_PLATFORM_VALUES,
  SOCIAL_PLATFORMS,
  DISCIPLINES,
  labelFor,
} from "@/lib/domain";

const PostSchema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  platform: z.enum(SOCIAL_PLATFORM_VALUES).default("LINKEDIN"),
  topic: z.string().optional(),
  hashtags: z.string().optional(),
  vacancyId: z.string().optional(),
  scheduledFor: z.coerce.date().optional(),
  content: z.string().optional(),
});

// Build the DB payload, turning undefined optionals into null so that
// clearing a field on edit actually clears it.
function toData(data: z.infer<typeof PostSchema>) {
  return {
    title: data.title,
    platform: data.platform,
    topic: data.topic ?? null,
    hashtags: data.hashtags ?? null,
    vacancyId: data.vacancyId ?? null,
    scheduledFor: data.scheduledFor ?? null,
    content: data.content ?? null,
  };
}

export async function createPost(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(PostSchema, formData);
  if (!parsed.success) return parsed.state;

  const created = await db.socialPost.create({ data: toData(parsed.data) });
  revalidatePath("/posts");
  redirect(`/posts/${created.id}`);
}

export async function updatePost(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende post." };

  const parsed = parseForm(PostSchema, formData);
  if (!parsed.success) return parsed.state;

  await db.socialPost.update({ where: { id }, data: toData(parsed.data) });
  revalidatePath("/posts");
  revalidatePath(`/posts/${id}`);
  redirect(`/posts/${id}`);
}

export async function deletePost(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.socialPost.delete({ where: { id } });
  } catch {
    redirect(`/posts/${id}?error=in-use`);
  }
  revalidatePath("/posts");
  redirect("/posts");
}

const SYSTEM_SOCIAL = `Je bent de social-media manager van Q4S, een Nederlands detacherings- en wervingsbureau gespecialiseerd in technische kwaliteitsdisciplines: QA (Quality Assurance), QC (Quality Control), lassen/welding, fitters en NDO/NDT (niet-destructief onderzoek).

Je schrijft een pakkende, professionele social-mediapost in het Nederlands.

Strikte regels:
- Schrijf in vloeiend, natuurlijk Nederlands (je-vorm), met een energieke maar geloofwaardige toon. Geen overdreven verkooppraat of clichés.
- Pas lengte en stijl aan op het platform:
  - LinkedIn: 3–6 korte regels/alinea's, professioneel; 1–2 relevante emoji's mogen.
  - Instagram of Facebook: korter en visueler, meer emoji's, een duidelijke call-to-action.
  - X / Twitter: kernachtig, maximaal ongeveer 280 tekens.
- Begin met een sterke openingszin (hook).
- Als er een vacature gekoppeld is, verwerk de functietitel, discipline en locatie, en eindig met een uitnodiging om te reageren of iemand te taggen.
- Sluit af met passende hashtags: gebruik de opgegeven hashtags als die er zijn en vul aan met relevante (zoals #vacature #techniek #Q4S).
- Geef ALLEEN de posttekst terug, zonder uitleg, zonder aanhalingstekens, zonder labels.`;

export async function draftPost(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const post = await db.socialPost.findUnique({
    where: { id },
    include: { vacancy: true },
  });
  if (!post) redirect("/posts");

  try {
    const platformLabel = labelFor(SOCIAL_PLATFORMS, post.platform);
    const lines: string[] = [];
    lines.push(`Platform: ${platformLabel}`);
    lines.push(`Titel / onderwerp van de post: ${post.title}`);
    if (post.topic) lines.push(`Aanleiding / context: ${post.topic}`);
    if (post.hashtags) lines.push(`Gewenste hashtags: ${post.hashtags}`);
    if (post.vacancy) {
      lines.push(`Gekoppelde vacature: ${post.vacancy.title}`);
      if (post.vacancy.discipline)
        lines.push(
          `Discipline van de vacature: ${labelFor(DISCIPLINES, post.vacancy.discipline)}`,
        );
      if (post.vacancy.location)
        lines.push(`Locatie van de vacature: ${post.vacancy.location}`);
    }

    const prompt = `Schrijf de social-mediapost op basis van de volgende gegevens:\n\n${lines.join("\n")}`;

    const content = await aiText({
      system: SYSTEM_SOCIAL,
      prompt,
      maxTokens: 1200,
      effort: "medium",
    });

    await db.socialPost.update({
      where: { id },
      // Regenerating copy makes it a working draft again; drop the published mark.
      data: { content, status: "DRAFT", publishedAt: null },
    });
  } catch {
    redirect(`/posts/${id}?error=ai`);
  }

  revalidatePath(`/posts/${id}`);
  redirect(`/posts/${id}`);
}

export async function schedulePost(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.socialPost.update({ where: { id }, data: { status: "SCHEDULED" } });
  revalidatePath("/posts");
  revalidatePath(`/posts/${id}`);
  redirect(`/posts/${id}`);
}

export async function publishPost(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.socialPost.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  revalidatePath("/posts");
  revalidatePath(`/posts/${id}`);
  redirect(`/posts/${id}`);
}

export async function reopenPost(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.socialPost.update({
    where: { id },
    data: { status: "DRAFT", publishedAt: null },
  });
  revalidatePath("/posts");
  revalidatePath(`/posts/${id}`);
  redirect(`/posts/${id}`);
}
