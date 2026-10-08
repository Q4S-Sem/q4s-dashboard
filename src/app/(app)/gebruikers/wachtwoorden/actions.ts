"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/session";
import { encryptSecret, decryptSecret } from "@/lib/vault";
import { normaliseUrl, parsePortalTsv } from "@/lib/portal-import";
import { aiJSON, isAIConfigured } from "@/lib/ai";
import { connectorKey, portaalLink, portaalSoort, raadPortaalSoort, type PortaalSoort } from "@/lib/portaal-soort";

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

/**
 * Portaal-agent: deelt elk portaal in (MSP/VMS, bedrijfsportaal, overig) en
 * legt uit wat je er voor de werving kunt halen. Ziet alleen naam, link en
 * notitie — nooit gebruikersnaam of wachtwoord. Zonder AI: vaste regels.
 */
export async function analyseerPortalen() {
  if (!(await isAdminSession())) redirect(`${PAD}?fout=geen-rechten`);
  const portals = await db.portalLogin.findMany({ select: { id: true, name: true, url: true, notes: true } });
  const uitkomst = new Map<string, { soort: PortaalSoort; analyse: string }>();
  for (const p of portals) uitkomst.set(p.id, { soort: raadPortaalSoort(p), analyse: "" });

  if (isAIConfigured()) {
    for (let i = 0; i < portals.length; i += 40) {
      const deel = portals.slice(i, i + 40);
      try {
        const r = await aiJSON<{ items: { i: number; soort: string; analyse: string }[] }>({
          fast: true,
          system:
            "Je bent de portaal-analist van Q4S, een detacheringsbureau voor staalbouw, QA/QC, inspectie, lassen, E&I, offshore en projectmanagement. " +
            "Deel elk portaal in: MSP = MSP/VMS/inhuur- of aanbestedingsplatform waar opdrachtgevers vacatures of aanvragen voor externe inhuur zetten (bv. Nétive, iCIMS, Fieldglass, Magnit, een /vms-portaal van een klant); " +
            "KLANT = portaal van een opdrachtgever zonder vacatures (leveranciersregistratie, toegang/aanmelden van mensen, facturen, inkoop); OVERIG = overheid, bank, eigen tools. " +
            "Geef per portaal één korte Nederlandse zin: wat Q4S er voor de werving mee kan. Verzin geen feiten; twijfel = zeg dat.",
          prompt: JSON.stringify(deel.map((p, n) => ({ i: n, naam: p.name, link: p.url, notitie: p.notes.slice(0, 200) }))),
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: { i: { type: "integer" }, soort: { type: "string", enum: ["MSP", "KLANT", "OVERIG"] }, analyse: { type: "string" } },
                  required: ["i", "soort", "analyse"],
                },
              },
            },
            required: ["items"],
          },
        });
        for (const it of r.items) {
          const p = deel[it.i];
          const soort = portaalSoort(it.soort);
          if (p && soort) uitkomst.set(p.id, { soort, analyse: it.analyse.slice(0, 300) });
        }
      } catch {
        // AI faalt → de vaste regels blijven staan.
      }
    }
  }
  for (const [id, data] of uitkomst) await db.portalLogin.update({ where: { id }, data });
  revalidatePath(PAD);
  redirect(`${PAD}?geanalyseerd=${portals.length}`);
}

/** Zet de soort met de hand (overrulet de agent). */
export async function zetPortaalSoort(fd: FormData) {
  if (!(await isAdminSession())) redirect(`${PAD}?fout=geen-rechten`);
  const soort = portaalSoort(veld(fd, "soort"));
  if (soort) await db.portalLogin.update({ where: { id: veld(fd, "id") }, data: { soort } });
  revalidatePath(PAD);
}

/** MSP-portaal → koppeling in MSP-vacatures (bestaat hij al, dan daarheen). */
export async function koppelAlsMsp(fd: FormData) {
  if (!(await isAdminSession())) redirect(`${PAD}?fout=geen-rechten`);
  const p = await db.portalLogin.findUnique({ where: { id: veld(fd, "id") }, select: { name: true, url: true, notes: true } });
  if (!p) redirect(PAD);
  const key = connectorKey(p.name);
  const bestaand = await db.vmsConnector.findUnique({ where: { key } });
  if (!bestaand) {
    await db.vmsConnector.create({
      data: {
        name: p.name,
        key,
        status: "MANUAL",
        website: portaalLink(p) || null,
        notes: "Gekoppeld vanuit Wachtwoorden (inloggegevens staan daar).",
        autoPublishSite: false,
      },
    });
  }
  revalidatePath("/vacaturehub", "layout");
  redirect("/vacaturehub/koppelingen?conn=saved");
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
