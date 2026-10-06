import fs from "node:fs";
import path from "node:path";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

// ---------------------------------------------------------------------------
// Het Q4S-factuuroverzicht (zelfde opmaak als het handmatige Excel-bestand)
// vullen met data. Het sjabloon (assets/excel/factuuroverzicht.xlsx) wordt
// gemaakt door scripts/factuuroverzicht-sjabloon.py en heeft logo, kleuren,
// formules, filters en keuzelijsten al; hier zetten we alleen waarden in de
// lege, voorbereide cellen. Excel rekent bij openen alles opnieuw uit.
// ---------------------------------------------------------------------------

export type Waarde = string | number | Date | null | undefined;
/** Per blad: celadres → waarde, bv. { Facturen: { C6: "Jordy" } }. */
export type Vulling = Partial<Record<"Overzicht" | "Facturen" | "Kosten", Record<string, Waarde>>>;

/** Bladnaam → xml-bestand in het sjabloon (vaste volgorde uit het build-script). */
const BLAD = { Overzicht: "xl/worksheets/sheet1.xml", Facturen: "xl/worksheets/sheet2.xml", Kosten: "xl/worksheets/sheet3.xml" };
/** Eerste datarij en aantal voorbereide regels per blad (zie het build-script). */
export const SJABLOON = { eersteRij: 6, facturen: 1500, kosten: 800 };

const xmlEsc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Excel-datumgetal (dagen sinds 1899-12-30) van de kalenderdag, tijdzone-onafhankelijk. */
export function excelDatum(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000 + 25_569;
}

function cel(ref: string, stijl: string, v: Waarde): string {
  const s = stijl ? ` s="${stijl}"` : "";
  if (v == null || v === "") return `<c r="${ref}"${s}/>`;
  if (v instanceof Date) return `<c r="${ref}"${s}><v>${excelDatum(v)}</v></c>`;
  if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}"${s}><v>${v}</v></c>` : `<c r="${ref}"${s}/>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
}

/** Zet waarden in bestaande cellen van één blad-xml; de opmaak (s=) blijft staan. */
export function vulBlad(xml: string, waarden: Record<string, Waarde>): string {
  return xml.replace(/<c r="([A-Z]+\d+)"([^>]*?)(\/>|>[\s\S]*?<\/c>)/g, (heel, ref: string, attrs: string) => {
    if (!(ref in waarden)) return heel;
    const stijl = /\ss="(\d+)"/.exec(attrs)?.[1] ?? "";
    return cel(ref, stijl, waarden[ref]);
  });
}

export function vulSjabloon(vulling: Vulling): Uint8Array {
  return vulXlsx(
    "factuuroverzicht.xlsx",
    Object.fromEntries(Object.entries(vulling).map(([blad, w]) => [BLAD[blad as keyof typeof BLAD], w!])),
  );
}

/** Elk sjabloon in assets/excel: blad-xml-pad → (celadres → waarde). */
export function vulXlsx(bestand: string, bladen: Record<string, Record<string, Waarde>>): Uint8Array {
  const bestanden = unzipSync(fs.readFileSync(path.join(process.cwd(), "assets", "excel", bestand)));
  for (const [pad, waarden] of Object.entries(bladen)) {
    bestanden[pad] = strToU8(vulBlad(strFromU8(bestanden[pad]), waarden));
  }
  return zipSync(bestanden, { level: 6 });
}
