import { db } from "./db";
import { vulXlsx, type Waarde } from "./excel-sjabloon";
import { formatDate } from "./utils";

// ---------------------------------------------------------------------------
// Export "Plaatsingen" in Q4S-stijl: alle lopende plaatsingen (actief + nog niet
// actief) met tarief en de factuur-/contactgegevens van de werknemer. Sjabloon:
// assets/excel/plaatsingen.xlsx (scripts/plaatsingen-sjabloon.py).
// ---------------------------------------------------------------------------

/** Eerste datarij en aantal voorbereide regels — gelijk aan het build-script. */
export const PLAATSINGEN_SJABLOON = { eersteRij: 6, regels: 300 };
const KOLOMMEN = "ABCDEFGHIJKLMNOPQRSTUVWX".split("");

type Rij = {
  naam: string;
  status: string;
  klant: string | null;
  functie: string;
  locatie: string | null;
  start: Date;
  einde: Date | null;
  per: string;
  inkoop: number;
  verkoop: number;
  allIn: boolean;
  kmIn: number;
  kmUit: number;
  bedrijf: string | null;
  kvk: string | null;
  btw: string | null;
  iban: string | null;
  email: string | null;
  telefoon: string | null;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  po: string | null;
};

/** Rijen → celwaarden. Kolom K (marge) is een formule in het sjabloon. */
export function plaatsingenCellen(rijen: Rij[]): Record<string, Waarde> {
  const cellen: Record<string, Waarde> = {};
  rijen.slice(0, PLAATSINGEN_SJABLOON.regels).forEach((r, i) => {
    const rij = PLAATSINGEN_SJABLOON.eersteRij + i;
    const v: Waarde[] = [
      r.naam, r.status, r.klant, r.functie, r.locatie, r.start, r.einde, r.per,
      r.inkoop || null, r.verkoop || null, undefined, r.allIn ? "Ja" : "Nee", r.kmIn || null, r.kmUit || null,
      r.bedrijf, r.kvk, r.btw, r.iban, r.email, r.telefoon, r.adres, r.postcode, r.plaats, r.po,
    ];
    v.forEach((w, k) => {
      if (w !== undefined) cellen[`${KOLOMMEN[k]}${rij}`] = w;
    });
  });
  return cellen;
}

export async function plaatsingenExcel(now = new Date()): Promise<{ bytes: Uint8Array; naam: string; aantal: number }> {
  const ps = await db.placement.findMany({
    where: { status: { in: ["ACTIVE", "INCOMPLETE"] } },
    include: { client: { select: { companyName: true } }, consultant: true },
    orderBy: [{ consultant: { lastName: "asc" } }, { consultant: { firstName: "asc" } }],
  });
  const rijen: Rij[] = ps.map((p) => {
    const c = p.consultant;
    return {
      naam: `${c.firstName} ${c.lastName}`,
      status: p.status === "ACTIVE" ? "Actief" : "Nog niet actief",
      klant: p.client?.companyName ?? null,
      functie: p.title,
      locatie: p.workLocation,
      start: p.startDate,
      einde: p.endDate,
      per: p.rateUnit === "DAY" ? "dag" : "uur",
      inkoop: p.costRate,
      verkoop: p.chargeRate,
      allIn: p.allIn,
      kmIn: p.kmRateBuy,
      kmUit: p.kmRateSell,
      bedrijf: c.companyName,
      kvk: c.kvkNumber,
      btw: c.vatNumber,
      iban: c.iban,
      email: c.email,
      telefoon: c.phone,
      adres: c.address,
      postcode: c.postalCode,
      plaats: c.city,
      po: p.poNumber,
    };
  });
  const cellen = plaatsingenCellen(rijen);
  cellen.C2 = `Lopende plaatsingen — ${rijen.length} · export ${formatDate(now)}`;
  const d = now.toISOString().slice(0, 10);
  return { bytes: vulXlsx("plaatsingen.xlsx", { "xl/worksheets/sheet1.xml": cellen }), naam: `Plaatsingen Q4S ${d}.xlsx`, aantal: rijen.length };
}
