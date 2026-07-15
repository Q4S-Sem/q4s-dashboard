"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { aiJSON } from "@/lib/ai";
import {
  OPPORTUNITY_POTENTIAL_VALUES,
  OPPORTUNITY_STATUS_VALUES,
} from "@/lib/domain";

const OpportunitySchema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  sector: z.string().optional(),
  region: z.string().optional().default("Nederland"),
  description: z.string().min(1, "Omschrijving is verplicht"),
  rationale: z.string().optional(),
  potential: z.enum(OPPORTUNITY_POTENTIAL_VALUES).default("MIDDEL"),
  status: z.enum(OPPORTUNITY_STATUS_VALUES).default("NEW"),
  targetCompanies: z.string().optional(),
});

// Build the DB payload, turning undefined optionals into null so that
// clearing a field on edit actually clears it.
function toData(data: z.infer<typeof OpportunitySchema>) {
  return {
    title: data.title,
    sector: data.sector ?? null,
    region: data.region ?? "Nederland",
    description: data.description,
    rationale: data.rationale ?? null,
    potential: data.potential,
    status: data.status,
    targetCompanies: data.targetCompanies ?? null,
  };
}

export async function createOpportunity(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(OpportunitySchema, formData);
  if (!parsed.success) return parsed.state;

  const created = await db.opportunity.create({
    data: { ...toData(parsed.data), source: "MANUAL" },
  });
  revalidatePath("/marktkansen");
  redirect(`/marktkansen/${created.id}`);
}

export async function updateOpportunity(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende kans." };

  const parsed = parseForm(OpportunitySchema, formData);
  if (!parsed.success) return parsed.state;

  await db.opportunity.update({ where: { id }, data: toData(parsed.data) });
  revalidatePath("/marktkansen");
  revalidatePath(`/marktkansen/${id}`);
  redirect(`/marktkansen/${id}`);
}

export async function deleteOpportunity(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.opportunity.delete({ where: { id } });
  } catch {
    redirect(`/marktkansen/${id}?error=in-use`);
  }
  revalidatePath("/marktkansen");
  redirect("/marktkansen");
}

/** Move an opportunity through the pipeline by setting its status. */
export async function setOpportunityStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const status = String(formData.get("status") ?? "");
  if (!OPPORTUNITY_STATUS_VALUES.includes(status)) {
    redirect(`/marktkansen/${id}`);
  }

  await db.opportunity.update({ where: { id }, data: { status } });
  revalidatePath("/marktkansen");
  revalidatePath(`/marktkansen/${id}`);
  redirect(`/marktkansen/${id}`);
}

type GeneratedOpportunity = {
  title: string;
  sector: string;
  region: string;
  description: string;
  rationale: string;
  potential: string;
  targetCompanies: string;
};

const GENERATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    opportunities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          sector: { type: "string" },
          region: { type: "string" },
          description: { type: "string" },
          rationale: { type: "string" },
          potential: { type: "string", enum: ["LAAG", "MIDDEL", "HOOG"] },
          targetCompanies: { type: "string" },
        },
        required: [
          "title",
          "sector",
          "region",
          "description",
          "rationale",
          "potential",
          "targetCompanies",
        ],
      },
    },
  },
  required: ["opportunities"],
} as const;

const GENERATE_SYSTEM = `Je bent een strategisch business-development adviseur voor Q4S, een Nederlands detacheringsbureau dat gespecialiseerd is in QA (Quality Assurance), QC (Quality Control), lassen (welding), fitters en NDO/NDT (niet-destructief onderzoek).

Jouw opdracht: stel ongeveer 5 concrete, realistische marktkansen voor om de business van Q4S te laten groeien — denk aan nieuwe sectoren, nieuwe projectrichtingen, nieuwe diensten of nieuwe regio's.

Denk aan kansrijke sectoren zoals scheepsbouw, offshore/wind, petrochemie, energie, infra en hoogbouw, en aan nieuwe diensten en regio's binnen en buiten Nederland.

Voor elke kans lever je:
- title: een korte, krachtige titel
- sector: de relevante sector of discipline
- region: de regio (standaard "Nederland")
- description: een heldere omschrijving van de kans
- rationale: waarom dit kansrijk is voor Q4S, aansluitend op hun expertise in QA, QC, lassen, fitters en NDO/NDT
- potential: het groeipotentieel — exact "LAAG", "MIDDEL" of "HOOG"
- targetCompanies: concrete voorbeeldbedrijven die je zou kunnen benaderen

Wees concreet en realistisch voor de Nederlandse markt. Schrijf alle tekst in het Nederlands.`;

export async function generateOpportunities(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const focus = String(formData.get("focus") ?? "").trim();

  try {
    const prompt = focus
      ? `Genereer ongeveer 5 marktkansen voor Q4S. De gebruiker wil specifiek focussen op het volgende: ${focus}`
      : "Genereer ongeveer 5 brede marktkansen voor Q4S over verschillende sectoren en regio's.";

    const result = await aiJSON<{ opportunities: GeneratedOpportunity[] }>({
      system: GENERATE_SYSTEM,
      prompt,
      schema: GENERATE_SCHEMA,
      schemaName: "opportunities",
    });

    const items = result.opportunities ?? [];
    if (items.length === 0) {
      return { error: "De AI leverde geen kansen op. Probeer het opnieuw." };
    }

    await db.opportunity.createMany({
      data: items.map((o) => ({
        title: o.title,
        sector: o.sector || null,
        region: o.region || "Nederland",
        description: o.description,
        rationale: o.rationale || null,
        potential: OPPORTUNITY_POTENTIAL_VALUES.includes(o.potential)
          ? o.potential
          : "MIDDEL",
        targetCompanies: o.targetCompanies || null,
        source: "AI",
        status: "NEW",
      })),
    });
  } catch {
    return {
      error:
        "AI-actie mislukt. Controleer of ANTHROPIC_API_KEY is ingesteld en probeer opnieuw.",
    };
  }

  revalidatePath("/marktkansen");
  redirect("/marktkansen");
}
