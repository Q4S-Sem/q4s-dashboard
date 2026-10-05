"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/session";
import { encryptSecret, decryptSecret } from "@/lib/vault";
import { normaliseUrl, parsePortalTsv } from "@/lib/portal-import";

const PAD = "/gebruikers/wachtwoorden";

function veld(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

/** Nieuw of bijwerken. Leeg wachtwoord bij bijwerken = huidige behouden. */
export async function savePortal(fd: FormData) {
  if (!(await isAdminSession())) redirect(`${PAD}?fout=geen-rechten`);
  const id = veld(fd, "id");
  const name = veld(fd, "name");
  if (!name) redirect(`${PAD}?fout=naam`);
  const data = {
    name,
    url: normaliseUrl(veld(fd, "url")),
    username: veld(fd, "username"),
    notes: veld(fd, "notes"),
  };
  const pw = String(fd.get("password") ?? "");
  if (id) {
    await db.portalLogin.update({ where: { id }, data: pw ? { ...data, passwordEnc: encryptSecret(pw) } : data });
  } else {
    await db.portalLogin.create({ data: { ...data, passwordEnc: encryptSecret(pw) } });
  }
  revalidatePath(PAD);
  redirect(`${PAD}?ok=1`);
}

export async function deletePortal(fd: FormData) {
  if (!(await isAdminSession())) redirect(`${PAD}?fout=geen-rechten`);
  await db.portalLogin.delete({ where: { id: veld(fd, "id") } });
  revalidatePath(PAD);
  redirect(`${PAD}?verwijderd=1`);
}

/** Alleen op klik: ontsleutel één wachtwoord voor tonen/kopiëren. */
export async function revealPortalPassword(id: string): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  if (!(await isAdminSession())) return { ok: false, error: "Alleen een beheerder kan wachtwoorden zien." };
  const row = await db.portalLogin.findUnique({ where: { id }, select: { passwordEnc: true } });
  if (!row) return { ok: false, error: "Niet gevonden." };
  try {
    return { ok: true, password: decryptSecret(row.passwordEnc) };
  } catch {
    return { ok: false, error: "Kan niet ontsleutelen (sleutel gewijzigd?). Vul het wachtwoord opnieuw in." };
  }
}

/** Bulk-import uit een tab-gescheiden bestand. Bestaande portaalnamen worden overgeslagen (veilig opnieuw draaien). */
export async function importPortals(fd: FormData) {
  if (!(await isAdminSession())) redirect(`${PAD}?fout=geen-rechten`);
  const file = fd.get("bestand");
  if (!(file instanceof File) || file.size === 0 || file.size > 500_000) redirect(`${PAD}?fout=bestand`);
  const rows = parsePortalTsv(await file.text());
  const bestaand = new Set((await db.portalLogin.findMany({ select: { name: true } })).map((p) => p.name.toLowerCase()));
  const nieuw = rows.filter((r) => !bestaand.has(r.name.toLowerCase()));
  await db.portalLogin.createMany({
    data: nieuw.map(({ password, ...r }) => ({ ...r, passwordEnc: encryptSecret(password) })),
  });
  revalidatePath(PAD);
  redirect(`${PAD}?geimporteerd=${nieuw.length}&overgeslagen=${rows.length - nieuw.length}`);
}
