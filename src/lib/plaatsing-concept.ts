import { db } from "./db";

// Half ingevulde plaatsing als concept bewaren (verschijnt onder Plaatsingen →
// Concepten). Gedeeld door de knop "Bewaar als concept" en de automatische
// tussentijdse opslag (/api/plaatsingen/concept).

export async function bewaarPlacementDraft(formData: FormData): Promise<string> {
  // Alle ingevulde tekstvelden verzamelen (bestanden overslaan).
  const data: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string" || k === "draftId") continue;
    if (v.trim() !== "") data[k] = v;
  }

  // Herkenbaar label: werknemer + klant (+ functie).
  let personLabel = [String(formData.get("firstName") ?? ""), String(formData.get("lastName") ?? "")]
    .filter(Boolean)
    .join(" ")
    .trim();
  const consultantId = String(formData.get("consultantId") ?? "").trim();
  if (!personLabel && consultantId) {
    const c = await db.consultant.findUnique({
      where: { id: consultantId },
      select: { firstName: true, lastName: true },
    });
    if (c) personLabel = `${c.firstName} ${c.lastName}`;
  }
  let clientLabel = "";
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (clientId) {
    const cl = await db.client.findUnique({ where: { id: clientId }, select: { companyName: true } });
    clientLabel = cl?.companyName ?? "";
  }
  const title = String(formData.get("title") ?? "").trim();
  const label =
    [personLabel || "Nieuwe werknemer", clientLabel].filter(Boolean).join(" · ") +
    (title ? ` — ${title}` : "");

  const json = JSON.stringify(data);
  const existingId = String(formData.get("draftId") ?? "").trim() || null;
  if (existingId) {
    const ok = await db.placementDraft
      .update({ where: { id: existingId }, data: { data: json, label } })
      .then(() => true)
      .catch(() => false);
    if (ok) return existingId;
  }
  return (await db.placementDraft.create({ data: { data: json, label }, select: { id: true } })).id;
}
