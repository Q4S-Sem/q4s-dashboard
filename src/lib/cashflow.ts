// Cashflow: wanneer is een betalingsherinnering aan de beurt, en wat komt er de
// komende weken binnen en gaat er uit? PURE functies — geen db, geen IO.

const DAG = 86_400_000;

/** Minimaal aantal dagen tussen twee herinneringen (1e herinnering mag direct na de vervaldatum). */
export const HERINNERING_INTERVAL_DAGEN = 7;

export type HerinnerFactuur = { status: string; dueDate: Date; reminderSentAt: Date | null };

/** Verzonden, over de vervaldatum en (nog nooit of ≥ interval geleden) herinnerd. */
export function herinneringAanDeBeurt(inv: HerinnerFactuur, now: Date): boolean {
  if (inv.status !== "SENT" || inv.dueDate.getTime() >= now.getTime()) return false;
  if (!inv.reminderSentAt) return true;
  return now.getTime() - inv.reminderSentAt.getTime() >= HERINNERING_INTERVAL_DAGEN * DAG;
}

export type PrognoseWeek = { label: string; start: Date; in: number; uit: number; saldo: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

function maandag(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/**
 * Verwachte geldstroom per week: open verkoopfacturen op vervaldatum (in) en
 * openstaande freelancerfacturen op betaaldatum (uit). Alles wat al vervallen is
 * telt in de huidige week. `saldo` = cumulatief netto vanaf vandaag.
 * ponytail: gaat uit van betalen-op-vervaldatum; corrigeer met de DSO per klant als de prognose structureel te rooskleurig blijkt.
 */
export function cashflowPrognose(
  inkomend: { bedrag: number; datum: Date }[],
  uitgaand: { bedrag: number; datum: Date }[],
  now: Date,
  weken = 8,
): PrognoseWeek[] {
  const start = maandag(now);
  const rijen: PrognoseWeek[] = Array.from({ length: weken }, (_, i) => {
    const s = new Date(start);
    s.setDate(s.getDate() + i * 7);
    return { label: i === 0 ? "Deze week (incl. te laat)" : `Week van ${s.getDate()}-${s.getMonth() + 1}`, start: s, in: 0, uit: 0, saldo: 0 };
  });
  const idx = (d: Date) => Math.max(0, Math.floor((maandag(d).getTime() - start.getTime()) / (7 * DAG) + 0.5));
  for (const x of inkomend) {
    const i = idx(x.datum);
    if (i < weken) rijen[i].in += x.bedrag;
  }
  for (const x of uitgaand) {
    const i = idx(x.datum);
    if (i < weken) rijen[i].uit += x.bedrag;
  }
  let saldo = 0;
  for (const r of rijen) {
    r.in = r2(r.in);
    r.uit = r2(r.uit);
    saldo = r2(saldo + r.in - r.uit);
    r.saldo = saldo;
  }
  return rijen;
}
