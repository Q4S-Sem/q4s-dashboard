import { db } from "./db";
import { companyCostsThisYear, invoicingOverview } from "./facturatie";
import { wekenInPeriode } from "./facturatie-volgende";
import { weekSlotVanDatum } from "./week-koppeling";
import { round2 } from "./utils";

// ---------------------------------------------------------------------------
// KOSTEN & WINST — de balans per maand (omzet − inkoop − eigen kosten) en het
// weekoverzicht verkoop/inkoop. Alle sommen komen uit de bestaande bronnen
// (invoicingOverview, companyCostsThisYear); hier wordt alleen gegroepeerd.
// ---------------------------------------------------------------------------

export const KOSTEN_CATEGORIEEN = [
  { value: "HUUR", label: "Huur & kantoor" },
  { value: "SOFTWARE", label: "Software & abonnementen" },
  { value: "AUTO", label: "Auto & reizen" },
  { value: "VERZEKERING", label: "Verzekeringen" },
  { value: "MARKETING", label: "Marketing & werving" },
  { value: "ADVIES", label: "Advies, boekhouder & juridisch" },
  { value: "BANK", label: "Bank & rente" },
  { value: "OPLEIDING", label: "Opleiding & certificering" },
  { value: "OVERIG", label: "Overig" },
] as const;

export function kostenLabel(value: string): string {
  return KOSTEN_CATEGORIEEN.find((c) => c.value === value)?.label ?? value;
}

export type BalansMaand = {
  label: string;
  omzet: number;
  inkoop: number;
  brutomarge: number;
  loonkosten: number;
  bonussen: number;
  declaraties: number;
  bedrijfskosten: number;
  kosten: number;
  winst: number;
};

/** De balans van een kalenderjaar, per maand + totaal. */
export async function balansJaar(jaar: number): Promise<{ maanden: BalansMaand[]; totaal: BalansMaand }> {
  const start = new Date(jaar, 0, 1);
  const eind = new Date(jaar + 1, 0, 1);
  const [overzicht, ...perMaand] = await Promise.all([
    invoicingOverview({ start, end: eind }),
    // ponytail: 12× de bestaande kostenfunctie (≈50 kleine queries); één
    // gegroepeerde query als deze pagina traag wordt.
    ...Array.from({ length: 12 }, (_, m) =>
      companyCostsThisYear({ start: new Date(jaar, m, 1), end: new Date(jaar, m + 1, 1) }),
    ),
  ]);
  const maanden = overzicht.perMonth.slice(0, 12).map((m, i): BalansMaand => {
    const k = perMaand[i];
    const brutomarge = round2(m.omzet - m.inkoop);
    return {
      label: m.label,
      omzet: m.omzet,
      inkoop: m.inkoop,
      brutomarge,
      loonkosten: k.loonkosten,
      bonussen: k.bonussen,
      declaraties: k.declaraties,
      bedrijfskosten: k.bedrijfskosten,
      kosten: k.totaal,
      winst: round2(brutomarge - k.totaal),
    };
  });
  const som = (f: keyof Omit<BalansMaand, "label">) => round2(maanden.reduce((s, m) => s + m[f], 0));
  return {
    maanden,
    totaal: {
      label: `Totaal ${jaar}`,
      omzet: som("omzet"),
      inkoop: som("inkoop"),
      brutomarge: som("brutomarge"),
      loonkosten: som("loonkosten"),
      bonussen: som("bonussen"),
      declaraties: som("declaraties"),
      bedrijfskosten: som("bedrijfskosten"),
      kosten: som("kosten"),
      winst: som("winst"),
    },
  };
}

export type WeekRegel = { week: string; personen: number; verkoop: number; inkoop: number; marge: number };

/**
 * Per ISO-week: verkoop (factuurregels, ex btw) en inkoop (ontvangen
 * freelancerfacturen, ex btw). Een verzamelfactuur over N weken telt 1/N per week.
 */
export async function weekOverzicht(jaar: number): Promise<WeekRegel[]> {
  const van = new Date(jaar - 1, 11, 20);
  const tot = new Date(jaar + 1, 0, 10);
  const [regels, ontvangen] = await Promise.all([
    db.invoiceLine.findMany({
      where: { invoice: { status: { not: "CANCELLED" }, issueDate: { gte: van, lt: tot } } },
      select: {
        amount: true,
        weekNumber: true,
        placement: { select: { consultantId: true } },
        timesheet: { select: { weekStart: true } },
        invoice: { select: { issueDate: true } },
      },
    }),
    db.receivedInvoice.findMany({
      where: { status: { notIn: ["REJECTED", "CANCELLED"] } },
      select: { consultantId: true, amount: true, vatAmount: true, weekKey: true, periodStart: true, periodEnd: true, issueDate: true },
    }),
  ]);
  const map = new Map<string, { personen: Set<string>; verkoop: number; inkoop: number }>();
  const pak = (k: string) => {
    let r = map.get(k);
    if (!r) map.set(k, (r = { personen: new Set(), verkoop: 0, inkoop: 0 }));
    return r;
  };
  const sleutel = (d: Date) => weekSlotVanDatum(new Date(d.getTime() + 12 * 3_600_000))?.key;
  for (const l of regels) {
    const k = l.timesheet ? sleutel(l.timesheet.weekStart) : sleutel(l.invoice.issueDate);
    if (!k) continue;
    const r = pak(k);
    r.verkoop += l.amount;
    if (l.placement?.consultantId) r.personen.add(l.placement.consultantId);
  }
  for (const f of ontvangen) {
    const weken = f.weekKey ? [f.weekKey] : wekenInPeriode(f.periodStart, f.periodEnd);
    const lijst = weken.length ? weken : f.issueDate ? [sleutel(f.issueDate)!] : [];
    const ex = round2(f.amount - (f.vatAmount ?? 0));
    for (const k of lijst) {
      const r = pak(k);
      r.inkoop += ex / lijst.length;
      r.personen.add(f.consultantId);
    }
  }
  return [...map.entries()]
    .filter(([k]) => k.startsWith(`${jaar}-`))
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week, r]) => ({
      week,
      personen: r.personen.size,
      verkoop: round2(r.verkoop),
      inkoop: round2(r.inkoop),
      marge: round2(r.verkoop - r.inkoop),
    }));
}
