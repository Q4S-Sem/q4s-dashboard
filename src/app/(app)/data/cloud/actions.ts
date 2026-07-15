"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { mirrorToCloud, alreadyMirrored } from "@/lib/cloud";
import { readUpload, uploadKey, expenseKey, cvKey } from "@/lib/uploads";

const CloudSettingsSchema = z.object({
  cloudProvider: z.enum(["ONEDRIVE", "SHAREPOINT", "BOTH"]).default("BOTH"),
  cloudTenantId: z.string().optional(),
  cloudClientId: z.string().optional(),
  cloudClientSecret: z.string().optional(),
  cloudDriveUser: z.string().optional(),
  cloudSiteId: z.string().optional(),
  cloudDriveId: z.string().optional(),
  cloudRootFolder: z.string().optional(),
});

/** Sla de SharePoint/OneDrive-koppeling op. Het secret is een wachtwoordveld:
 *  leeg laten = ongewijzigd; wissen via het vinkje "secret wissen". */
export async function saveCloudSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(CloudSettingsSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const enabled = formData.get("cloudEnabled") === "on";

  const data: Record<string, unknown> = {
    cloudEnabled: enabled,
    cloudProvider: d.cloudProvider,
    cloudTenantId: d.cloudTenantId ?? "",
    cloudClientId: d.cloudClientId ?? "",
    cloudDriveUser: d.cloudDriveUser ?? "",
    cloudSiteId: d.cloudSiteId ?? "",
    cloudDriveId: d.cloudDriveId ?? "",
    cloudRootFolder: d.cloudRootFolder || "Q4S Dashboard",
  };
  if (formData.get("cloudSecretClear") === "on") data.cloudClientSecret = "";
  else if (d.cloudClientSecret) data.cloudClientSecret = d.cloudClientSecret;

  await db.companySettings.update({ where: { id: "default" }, data });
  revalidatePath("/data/cloud");
  revalidatePath("/", "layout");
  redirect("/data/cloud?saved=1");
}

/**
 * Backfill: spiegel alle bestaande bestanden die nog niet gesynct zijn naar de
 * cloud, netjes gesorteerd in mappen. Idempotent (slaat al-gespiegelde over) en
 * best-effort (ontbrekende bestanden op schijf worden overgeslagen). In
 * klaarzet-modus worden ze als SIMULATED gelogd zodat je de mapstructuur ziet.
 */
export async function syncExistingData() {
  const CAP = 500;
  let count = 0;

  async function push(
    key: string,
    storedFileName: string,
    originalName: string,
    category: string,
    subfolder?: string,
  ) {
    if (count >= CAP) return;
    if (await alreadyMirrored(storedFileName)) return;
    let bytes: Buffer;
    try {
      bytes = await readUpload(key);
    } catch {
      return; // bestand niet (meer) in opslag — overslaan
    }
    await mirrorToCloud({ category, subfolder, storedFileName, originalName, bytes });
    count++;
  }

  const [docs, certs, empDocs, expenses, candidates] = await Promise.all([
    db.document.findMany({ select: { consultantId: true, fileName: true, originalName: true } }),
    db.certificate.findMany({
      where: { fileName: { not: null } },
      select: { consultantId: true, fileName: true, originalName: true },
    }),
    db.employeeDocument.findMany({ select: { employeeId: true, fileName: true, originalName: true } }),
    db.expense.findMany({ select: { fileName: true, originalName: true } }),
    db.candidate.findMany({
      where: { cvFileName: { not: null } },
      select: { cvFileName: true, cvOriginalName: true },
    }),
  ]);

  for (const d of docs) {
    if (d.fileName) await push(uploadKey(d.consultantId, d.fileName), d.fileName, d.originalName ?? d.fileName, "Personeelsdossiers", d.consultantId);
  }
  for (const c of certs) {
    if (c.fileName) await push(uploadKey(c.consultantId, c.fileName), c.fileName, c.originalName ?? c.fileName, "Personeelsdossiers", c.consultantId);
  }
  for (const e of empDocs) {
    if (e.fileName) await push(uploadKey(e.employeeId, e.fileName), e.fileName, e.originalName ?? e.fileName, "Personeelsdossiers", e.employeeId);
  }
  for (const x of expenses) {
    if (x.fileName) await push(expenseKey(x.fileName), x.fileName, x.originalName ?? x.fileName, "Declaraties");
  }
  for (const c of candidates) {
    if (c.cvFileName) await push(cvKey(c.cvFileName), c.cvFileName, c.cvOriginalName ?? c.cvFileName, "Kandidaten-CV");
  }

  revalidatePath("/data/cloud");
  redirect(`/data/cloud?synced=${count}`);
}
