import { requireApiSession } from "@/lib/api-auth";
import { bewaarPlacementDraft } from "@/lib/plaatsing-concept";

export const dynamic = "force-dynamic";

/**
 * Automatisch tussentijds opslaan van een nieuwe plaatsing als concept.
 * Bewust een API-route en geen server action: die blijft werken als er
 * intussen een nieuwe versie live staat (een oude server-action-id niet).
 */
export async function POST(req: Request) {
  const gate = await requireApiSession();
  if (gate) return gate;
  const form = await req.formData();
  // Bestanden niet meesturen/bewaren: alleen tekstvelden.
  const tekst = new FormData();
  for (const [k, v] of form.entries()) if (typeof v === "string") tekst.append(k, v);
  const id = await bewaarPlacementDraft(tekst);
  return Response.json({ id });
}
