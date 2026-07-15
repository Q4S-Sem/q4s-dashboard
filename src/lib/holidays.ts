// Officiële Nederlandse feestdagen — gebruikt om verlof/vakantie correct te tellen:
// weekend en feestdagen kosten geen vakantiedag. Paas-gebonden dagen worden
// berekend uit de paasdatum; Koningsdag schuift naar 26 april als 27 april zondag is.

/** Paaszondag (Gregoriaans) via het "anonymous Gregorian" algoritme. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = maart, 4 = april
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(base: Date, n: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Lokale YYYY-MM-DD sleutel (timezone-veilig t.o.v. de datumvergelijking hieronder). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Koningsdag: 27 april, tenzij dat een zondag is → dan 26 april. */
function koningsdag(year: number): Date {
  const d = new Date(year, 3, 27);
  return d.getDay() === 0 ? new Date(year, 3, 26) : d;
}

const holidayCache = new Map<number, Set<string>>();

/** Officiële NL-feestdagen voor een jaar, als set van YYYY-MM-DD. */
export function dutchHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const dates: Date[] = [
    new Date(year, 0, 1), // Nieuwjaarsdag
    addDays(easter, -2), // Goede Vrijdag
    easter, // Eerste Paasdag
    addDays(easter, 1), // Tweede Paasdag
    koningsdag(year), // Koningsdag
    new Date(year, 4, 5), // Bevrijdingsdag
    addDays(easter, 39), // Hemelvaartsdag
    addDays(easter, 49), // Eerste Pinksterdag
    addDays(easter, 50), // Tweede Pinksterdag
    new Date(year, 11, 25), // Eerste Kerstdag
    new Date(year, 11, 26), // Tweede Kerstdag
  ];
  const set = new Set(dates.map(ymd));
  holidayCache.set(year, set);
  return set;
}

/** Is deze datum een officiële NL-feestdag? */
export function isDutchHoliday(d: Date): boolean {
  return dutchHolidays(d.getFullYear()).has(ymd(d));
}

/**
 * Aantal werkdagen tussen twee data (incl. begin en eind), met weekend (za/zo)
 * én officiële NL-feestdagen eruit. Zo kost een vakantie over een weekend of
 * feestdag geen extra verlofdagen.
 */
export function workdaysExcludingHolidays(start: Date, end: Date): number {
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  let count = 0;
  while (d <= last) {
    const day = d.getDay();
    if (day !== 0 && day !== 6 && !dutchHolidays(d.getFullYear()).has(ymd(d))) count += 1;
    d.setDate(d.getDate() + 1);
  }
  return count;
}
