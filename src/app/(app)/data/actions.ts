"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { explorerConfig } from "@/lib/cloud";
import { graphCreateFolder, graphUpload, sanitizeName, veiligPad } from "@/lib/onedrive";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { authRequired, currentUser } from "@/lib/session";

// Bestandsverkenner-acties: werken RECHTSTREEKS in de bestaande OneDrive-mappen.
// Nooit overschrijven (Graph: conflictBehavior=rename) en nooit verwijderen.

const terug = (pad: string, extra = "") =>
  `/data${pad ? `?pad=${encodeURIComponent(pad)}` : ""}${extra ? `${pad ? "&" : "?"}${extra}` : ""}`;

async function toegang() {
  if (authRequired() && !(await currentUser())) redirect("/login");
  const cfg = await explorerConfig();
  if (!cfg) redirect("/data?fout=geen-koppeling");
  return cfg;
}

export async function uploadNaarMap(formData: FormData) {
  const pad = veiligPad(String(formData.get("pad") ?? ""));
  const cfg = await toegang();
  const bestanden = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  let gelukt = 0;
  const fouten: string[] = [];
  for (const f of bestanden) {
    if (f.size > MAX_UPLOAD_BYTES) {
      fouten.push(`${f.name} (te groot)`);
      continue;
    }
    const res = await graphUpload(
      cfg,
      [pad, sanitizeName(f.name)].filter(Boolean).join("/"),
      new Uint8Array(await f.arrayBuffer()),
      f.type,
      true,
    );
    if (res.ok) gelukt++;
    else fouten.push(`${f.name} (${res.error})`);
  }
  revalidatePath("/data");
  redirect(terug(pad, `geupload=${gelukt}${fouten.length ? `&fout=${encodeURIComponent(fouten.join(", "))}` : ""}`));
}

export async function nieuweMap(formData: FormData) {
  const pad = veiligPad(String(formData.get("pad") ?? ""));
  const naam = String(formData.get("naam") ?? "").trim();
  if (!naam) redirect(terug(pad));
  const cfg = await toegang();
  const res = await graphCreateFolder(cfg, pad, naam);
  revalidatePath("/data");
  redirect(terug(pad, res.ok ? "map=1" : `fout=${encodeURIComponent(res.error)}`));
}
