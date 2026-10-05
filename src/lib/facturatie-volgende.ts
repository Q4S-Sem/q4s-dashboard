// ---------------------------------------------------------------------------
// "Persoon voor persoon" door de week: wie is de volgende die nog werk heeft?
// Puur (geen DB), zodat het weekoverzicht, het dossier en de akkoord-actie
// dezelfde volgorde gebruiken als de tabel (die al op naam gesorteerd is).
// ---------------------------------------------------------------------------

export type VolgendeRij = {
  key: string;
  naam: string;
  href: string | null;
  gefactureerd: boolean;
  vastgelegd: boolean;
  wachtkamerSinds: Date | null;
};

/** Heeft deze persoon deze week nog iets te doen (en is er een dossier)? */
export function nogTeDoen(r: VolgendeRij): boolean {
  return Boolean(r.href) && !r.gefactureerd && !r.vastgelegd && !r.wachtkamerSinds;
}

/**
 * De eerstvolgende persoon met werk NA `huidigeKey` (in tabelvolgorde, rond naar
 * het begin). Zonder `huidigeKey` = de eerste. Null als iedereen klaar is.
 */
export function volgendePersoon<R extends VolgendeRij>(rows: R[], huidigeKey?: string | null): R | null {
  const start = huidigeKey ? rows.findIndex((r) => r.key === huidigeKey) : -1;
  for (let i = 1; i <= rows.length; i++) {
    const r = rows[(start + i + rows.length) % rows.length];
    if (r.key !== huidigeKey && nogTeDoen(r)) return r;
  }
  return null;
}

/** "3 van 9" — hoeveel personen zijn deze week klaar (vastgelegd/gefactureerd)? */
export function voortgang(rows: VolgendeRij[]): { klaar: number; totaal: number } {
  const metDossier = rows.filter((r) => r.href);
  return { klaar: metDossier.filter((r) => r.gefactureerd || r.vastgelegd).length, totaal: metDossier.length };
}
