import { db } from "./db";
import { aiText } from "./ai";
import { DISCIPLINES, labelFor } from "./domain";

// Public URL of the talentpool landing page (set NEXT_PUBLIC_SITE_URL for a full
// link; otherwise the relative path is used and finalised before publishing).
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
export const TALENTPOOL_URL = SITE_URL ? `${SITE_URL}/talentpool` : "/talentpool";

const SYSTEM_SUCCESS = `Je bent de social-media manager van Q4S, een Nederlands technisch detacheringsbureau (QA/QC, lassen, fitters, NDT/NDO, HSE).
Je schrijft een kort, anoniem succesverhaal voor LinkedIn: Q4S heeft opnieuw een vakspecialist aan het werk geholpen.

Strikte regels:
- Vloeiend Nederlands (je-vorm), trots maar geloofwaardig, geen clichés.
- NOEM GEEN NAMEN van personen of opdrachtgevers.
- 3–5 korte regels, 1–2 emoji's mogen.
- Eindig met een uitnodiging om lid te worden van de Q4S Talentpool, met de link.
- Sluit af met passende hashtags (#Q4S #techniek #vacature).
- Geef ALLEEN de posttekst terug, zonder uitleg of aanhalingstekens.`;

/**
 * Best-effort: when an application is placed, draft an anonymous success-story
 * social post with a talentpool CTA — the "proof loop" that turns each placement
 * into the next recruitment content. Always leaves a usable DRAFT (templated
 * fallback) even without an AI key, and never throws (must not block placement).
 */
export async function createSuccessPostForPlacement(
  applicationId: string,
): Promise<void> {
  try {
    const app = await db.application.findUnique({
      where: { id: applicationId },
      include: { candidate: true, vacancy: true },
    });
    if (!app) return;

    const disciplineVal =
      app.candidate.discipline ?? app.vacancy?.discipline ?? null;
    const discipline = labelFor(DISCIPLINES, disciplineVal);
    const role =
      app.vacancy?.title ?? (discipline !== "—" ? discipline : "technisch specialist");

    const fallback = `🎉 Weer een vakspecialist via Q4S aan het werk als ${role}!\n\nWil jij ook werken aan de mooiste technische opdrachten? Word lid van de Q4S Talentpool 👉 ${TALENTPOOL_URL}\n\n#Q4S #techniek #vacature`;

    const post = await db.socialPost.create({
      data: {
        title: `Succesverhaal — ${role}`,
        platform: "LINKEDIN",
        topic:
          "Automatisch gegenereerd bij een nieuwe plaatsing (anoniem succesverhaal met talentpool-CTA).",
        hashtags: "#Q4S #techniek #vacature",
        status: "DRAFT",
        content: fallback,
        vacancyId: app.vacancyId ?? null,
      },
    });

    try {
      const content = await aiText({
        system: SYSTEM_SUCCESS,
        prompt: `Schrijf een anoniem succesverhaal. Context: Q4S heeft opnieuw een specialist geplaatst als ${role}${
          discipline !== "—" ? ` (vakgebied: ${discipline})` : ""
        }. Noem geen namen. Sluit af met een uitnodiging om lid te worden van de Q4S Talentpool via: ${TALENTPOOL_URL}`,
        maxTokens: 800,
        effort: "medium",
      });
      if (content && content.trim()) {
        await db.socialPost.update({
          where: { id: post.id },
          data: { content },
        });
      }
    } catch {
      // keep the templated fallback content
    }
  } catch {
    // never block the placement flow
  }
}
