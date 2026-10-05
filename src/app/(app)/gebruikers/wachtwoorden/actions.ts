"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/session";
import { encryptSecret, decryptSecret } from "@/lib/vault";

const PAD = "/gebruikers/wachtwoorden";

function veld(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

/** Zonder schema in de URL wordt een link relatief aan het dashboard; voeg https:// toe. */
function normaliseUrl(u: string) {
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
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
