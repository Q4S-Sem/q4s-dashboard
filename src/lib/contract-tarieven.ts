/**
 * Tarieven uit een overeenkomst van opdracht → de velden van een plaatsing.
 * Bron = de art. 6-cellen zoals ze op het contract staan (vrije tekst, bijv.
 * "€ 78,-", "+ 10 %"), uit een dashboard-contract óf door de AI uit een PDF.
 *
 * Het contract met de ZZP'er is de INKOOP-kant; een contract met de klant de
 * VERKOOP-kant. Zaterdag/zondag/shift/offshore staan op het contract als totaal
 * uurtarief → op de plaatsing als vaste toeslag (€/u bovenop het basistarief),
 * of als percentage als het contract een % noemt.
 */
export type ContractTarieven = {
  rateDay?: string | null;
  rateDayFixed?: string | null;
  rateOvertime?: string | null;
  rateSaturday?: string | null;
  rateSunday?: string | null;
  rateShift?: string | null;
  rateOffshore?: string | null;
  kmRate?: string | null;
  startDate?: string | null; // "YYYY-MM-DD"
  endDate?: string | null;
};

export type TariefKant = "inkoop" | "verkoop";

type Waarde = { bedrag: number } | { pct: number } | null;

/** "€ 1.234,50" → 1234.5 · "78,-" → 78 · "+ 10 %" → {pct:10} · leeg/"zie uurtarief" → null. */
export function leesWaarde(tekst: string | null | undefined): Waarde {
  const t = (tekst ?? "").trim();
  const m = /(\d[\d.,]*)/.exec(t);
  if (!m) return null;
  let n = m[1].replace(/[.,]-?$/, "");
  // NL-notatie: punt = duizendtal, komma = decimaal. Alleen een punt met 1-2
  // cijfers erachter is een decimaalpunt ("78.50").
  n = /,/.test(n) ? n.replace(/\./g, "").replace(",", ".") : /\.\d{1,2}$/.test(n) ? n : n.replace(/\./g, "");
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return /%/.test(t) ? { pct: v } : { bedrag: v };
}

const rond = (n: number) => Math.round(n * 100) / 100;

function datum(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? "").trim());
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/**
 * De update voor de plaatsing + een leesbare lijst van wat er verandert. Alleen
 * wat het contract echt noemt wordt gezet; de rest van de plaatsing blijft staan.
 */
export function plaatsingUitContract(
  t: ContractTarieven,
  kant: TariefKant,
): { data: Record<string, string | number | boolean | Date>; regels: string[] } {
  const data: Record<string, string | number | boolean | Date> = {};
  const regels: string[] = [];
  const buy = kant === "inkoop";
  const eur = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;

  const uur = leesWaarde(t.rateDay);
  const dag = leesWaarde(t.rateDayFixed);
  let basis: number | null = null;
  if (uur && "bedrag" in uur) {
    basis = uur.bedrag;
    data.rateUnit = "HOUR";
  } else if (dag && "bedrag" in dag) {
    basis = dag.bedrag;
    data.rateUnit = "DAY";
  }
  if (basis !== null) {
    data[buy ? "costRate" : "chargeRate"] = basis;
    regels.push(`${buy ? "Inkoop" : "Verkoop"}tarief ${eur(basis)} ${data.rateUnit === "DAY" ? "per dag" : "per uur"}`);
  }

  const ot = leesWaarde(t.rateOvertime);
  if (ot && "bedrag" in ot) {
    data[buy ? "overtimeCostRate" : "overtimeChargeRate"] = ot.bedrag;
    regels.push(`Overuren ${eur(ot.bedrag)} per uur`);
  }

  const toeslagen: [keyof ContractTarieven, string, string, boolean][] = [
    ["rateSaturday", "saturday", "Zaterdag", false],
    ["rateSunday", "sunday", "Zon-/feestdag", false],
    ["rateShift", "shift", "Shift", true],
    ["rateOffshore", "offshore", "Offshore", true],
  ];
  for (const [veld, k, label, heeftSchakelaar] of toeslagen) {
    const w = leesWaarde(t[veld]);
    if (!w) continue;
    let waarde: number;
    let unit: "PCT" | "FIXED";
    if ("pct" in w) {
      waarde = w.pct;
      unit = "PCT";
    } else {
      // Totaal uurtarief op het contract → het verschil met het basistarief.
      if (basis === null || data.rateUnit === "DAY" || w.bedrag <= basis) continue;
      waarde = rond(w.bedrag - basis);
      unit = "FIXED";
    }
    data[`${k}Surcharge${buy ? "Buy" : "Sell"}`] = waarde;
    data[`${k}Surcharge${buy ? "" : "Sell"}Unit`] = unit;
    if (heeftSchakelaar) data[`${k}Enabled`] = true;
    regels.push(`${label}: ${unit === "PCT" ? `+${waarde}%` : `+${eur(waarde)} per uur`}`);
  }

  const km = leesWaarde(t.kmRate);
  if (km && "bedrag" in km) {
    data[buy ? "kmRateBuy" : "kmRateSell"] = km.bedrag;
    regels.push(`Kilometers ${eur(km.bedrag)} per km`);
  }

  const start = datum(t.startDate);
  const eind = datum(t.endDate);
  if (start) {
    data.startDate = start;
    regels.push(`Startdatum ${start.toLocaleDateString("nl-NL")}`);
  }
  if (eind) {
    data.endDate = eind;
    regels.push(`Einddatum ${eind.toLocaleDateString("nl-NL")}`);
  }
  return { data, regels };
}
