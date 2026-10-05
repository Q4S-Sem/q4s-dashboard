// Bulk-import voor de wachtwoordenmap: tab-gescheiden tekst (Excel "Opslaan als
// tekst (tab)") met kolommen naam · link · gebruikersnaam · wachtwoord · notitie.

export type PortalImportRow = { name: string; url: string; username: string; password: string; notes: string };

/** Zonder schema wordt een link relatief aan het dashboard; voeg https:// toe. */
export function normaliseUrl(u: string): string {
  const t = u.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function parsePortalTsv(text: string): PortalImportRow[] {
  const rows: PortalImportRow[] = [];
  for (const raw of text.replace(/^\uFEFF/, "").split("\n")) {
    const cells = raw.replace(/\r$/, "").split("\t").map((c) => c.trim());
    const [name = "", url = "", username = "", password = "", notes = ""] = cells;
    if (!name || /^(naam|name|portaal)$/i.test(name)) continue; // lege regel of kopregel
    rows.push({ name, url: normaliseUrl(url), username, password, notes });
  }
  return rows;
}
