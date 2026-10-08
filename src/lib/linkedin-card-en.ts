"use server";

import { aiJSON } from "@/lib/ai";
import type { LinkedInCardData } from "@/lib/linkedin-card";

// De LinkedIn-afbeelding is altijd in het Engels (internationale vakmensen).
// De post-tekst blijft Nederlands. Bij een AI-fout: de kaart ongewijzigd terug.

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    location: { type: "string" },
    hours: { type: "string" },
    duration: { type: "string" },
    intro: { type: "string" },
    points: { type: "array", items: { type: "string" } },
  },
  required: ["title", "location", "hours", "duration", "intro", "points"],
  additionalProperties: false,
};

type Vertaald = Pick<LinkedInCardData, "title" | "location" | "hours" | "duration" | "intro" | "points">;

export async function kaartInHetEngels(card: LinkedInCardData): Promise<LinkedInCardData> {
  try {
    const en = await aiJSON<Vertaald>({
      fast: true,
      schema: SCHEMA,
      schemaName: "linkedin_card_en",
      system:
        "You translate Dutch job-ad snippets for a LinkedIn recruitment image into natural, concise British English for technical professionals (steel construction, QA/QC, welding, NDT). " +
        "Keep job titles that are already English unchanged; translate Dutch titles to the usual English job title (Voorman → Foreman, Lasser → Welder, Werkvoorbereider → Work Planner). " +
        "Keep abbreviations (NDO→NDT, VCA, EN 1090, ISO) correct. Country/city names in English (Nederland → the Netherlands, Duitsland → Germany). " +
        "\"12+ maanden\" → \"12+ months\", \"Fulltime\" → \"Full-time\". Keep each point about as short as the original. Return the same number of points.",
      prompt: JSON.stringify({
        title: card.title,
        location: card.location,
        hours: card.hours,
        duration: card.duration,
        intro: card.intro,
        points: card.points,
      }),
    });
    return { ...card, ...en, points: en.points.length ? en.points : card.points };
  } catch (err) {
    console.error("kaartInHetEngels mislukt:", err);
    return card;
  }
}
