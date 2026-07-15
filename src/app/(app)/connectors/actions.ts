"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { VMS_STATUS_VALUES } from "@/lib/domain";
import { isBlockedHost } from "@/lib/msp";
import { MSP_PROVIDERS } from "@/lib/msp-providers";

/** Alleen https + geen privé/loopback-host (SSRF-verdediging). Lege waarde = ok. */
const apiBaseUrl = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (!v) return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" && !isBlockedHost(u.hostname);
      } catch {
        return false;
      }
    },
    { message: "Gebruik een geldige https-URL (geen privé/loopback-adres)." },
  );

const ConnectorSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  key: z.string().min(1, "Sleutel is verplicht"),
  status: z.enum(VMS_STATUS_VALUES).default("MANUAL"),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  website: z.string().optional(),
  notes: z.string().optional(),
  apiBaseUrl,
  apiKey: z.string().optional(),
});

/** Host van een URL, of null bij een lege/ongeldige waarde. */
function hostOf(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    return new URL(v).host.toLowerCase();
  } catch {
    return null;
  }
}

// Build the DB payload, turning undefined optionals into null so that
// clearing a field on edit actually clears it. Checkbox-booleans worden
// (conform de projectconventie) direct uit de FormData gelezen.
function toData(data: z.infer<typeof ConnectorSchema>, formData: FormData) {
  return {
    name: data.name,
    key: data.key,
    status: data.status,
    priority: data.priority,
    website: data.website ?? null,
    notes: data.notes ?? null,
    apiBaseUrl: data.apiBaseUrl ?? null,
    autoFilter: formData.get("autoFilter") === "on",
    autoImprove: formData.get("autoImprove") === "on",
    autoPublishSite: formData.get("autoPublishSite") === "on",
    autoDraftPost: formData.get("autoDraftPost") === "on",
    autoMatch: formData.get("autoMatch") === "on",
    notifyRecruiter: formData.get("notifyRecruiter") === "on",
  };
}

export async function createConnector(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(ConnectorSchema, formData);
  if (!parsed.success) return parsed.state;

  const created = await db.vmsConnector.create({
    data: { ...toData(parsed.data, formData), apiKey: parsed.data.apiKey ?? null },
  });
  revalidatePath("/connectors");
  redirect(`/connectors/${created.id}`);
}

/**
 * Eén-klik: koppel een bekende NL-MSP uit het register (of open de bestaande).
 * Alle automatische pijplijn-stappen staan meteen aan; het endpoint/de creds vul
 * je later in — tot die tijd loopt de intake via de webhook en testlevering.
 */
export async function addKnownConnector(formData: FormData) {
  const key = String(formData.get("key") ?? "").trim();
  const provider = MSP_PROVIDERS.find((p) => p.key === key);
  if (!provider) redirect("/connectors/nieuw");

  const existing = await db.vmsConnector.findUnique({ where: { key: provider.key } });
  if (existing) redirect(`/connectors/${existing.id}?exists=1`);

  const created = await db.vmsConnector.create({
    data: {
      name: provider.name,
      key: provider.key,
      status: "MANUAL",
      priority: provider.recommended ? 5 : 3,
      website: provider.website ?? null,
      notes: provider.description,
      apiBaseUrl: provider.apiBaseUrl ?? null,
      apiKey: null,
      autoFilter: true,
      autoImprove: true,
      autoPublishSite: true,
      autoDraftPost: true,
      autoMatch: true,
      notifyRecruiter: true,
    },
  });
  revalidatePath("/connectors");
  revalidatePath("/msp");
  redirect(`/connectors/${created.id}?added=1`);
}

export async function updateConnector(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende connector." };

  const parsed = parseForm(ConnectorSchema, formData);
  if (!parsed.success) return parsed.state;

  const existing = await db.vmsConnector.findUnique({
    where: { id },
    select: { apiBaseUrl: true, apiKey: true },
  });

  // De API-key blijft staan als het veld leeg wordt gelaten (het is een
  // password-veld); wissen kan expliciet via het vinkje "API-key wissen".
  const data: Record<string, unknown> = toData(parsed.data, formData);
  if (formData.get("apiKeyClear") === "on") data.apiKey = null;
  else if (parsed.data.apiKey) data.apiKey = parsed.data.apiKey;

  // Als de host van de basis-URL wijzigt maar er geen nieuwe key wordt gegeven,
  // wis dan de bestaande key: die hoort bij de oude host en mag niet automatisch
  // naar een nieuwe (mogelijk kwaadaardige) host worden meegestuurd.
  const hostChanged = hostOf(parsed.data.apiBaseUrl) !== hostOf(existing?.apiBaseUrl);
  if (hostChanged && !parsed.data.apiKey && formData.get("apiKeyClear") !== "on" && existing?.apiKey) {
    data.apiKey = null;
  }

  await db.vmsConnector.update({ where: { id }, data });
  revalidatePath("/connectors");
  revalidatePath(`/connectors/${id}`);
  revalidatePath("/msp");
  redirect(`/connectors/${id}`);
}

export async function deleteConnector(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.vmsConnector.delete({ where: { id } });
  } catch {
    // Likely has vacancies or targets attached (onDelete: Restrict).
    redirect(`/connectors/${id}?error=in-use`);
  }
  revalidatePath("/connectors");
  redirect("/connectors");
}

/** Make a URL-safe slug from a title with a short random suffix. */
function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "vacature"}-${suffix}`;
}

/**
 * Manual intake: paste a vacancy for a connector. Real API hookup is
 * credential-gated; until then vacancies are pasted in by hand.
 */
export async function intakeVacancy(formData: FormData) {
  const connectorId = String(formData.get("connectorId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const rawText = String(formData.get("rawText") ?? "").trim();

  if (!connectorId) redirect("/connectors");
  if (!title || !rawText) {
    redirect(`/connectors/${connectorId}?error=intake`);
  }

  const created = await db.vacancy.create({
    data: {
      title,
      rawText,
      source: "VMS",
      vmsConnectorId: connectorId,
      status: "CONCEPT",
      slug: makeSlug(title),
    },
  });

  revalidatePath("/vacatures");
  revalidatePath(`/connectors/${connectorId}`);
  redirect(`/vacatures/${created.id}`);
}
