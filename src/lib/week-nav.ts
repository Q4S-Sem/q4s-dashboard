import { startOfISOWeek } from "./utils";

// ---------------------------------------------------------------------------
// WEEK-NAVIGATIE — het rekenwerk onder de week-balk (src/components/week-balk.tsx).
//
// Elke facturatiepagina heeft dezelfde balk: "‹ Vorige week", de klikbare
// week-box en "Volgende week ›". Vroeger had elke pagina daar zijn eigen kopie
// van `shiftWeek` voor (uren, inbox, inbox/status, ontvangen-facturen, verzenden)
// — vijf keer bijna hetzelfde, en de verzendmap-variant rekende met een string
// terwijl de rest met een Date rekende. Dit is die ene rekenaar.
//
// PUUR: geen Prisma, geen `new Date()` van binnenuit, geen I/O. Alles wat met
// "nu" te maken heeft komt als parameter binnen, zodat de server-pagina, de
// client-kiezer en de tests (tests/week-nav.test.ts) exact hetzelfde uitrekenen.
//
// Er wordt hier NIETS zelf geteld: startOfISOWeek (src/lib/utils.ts) blijft de
// enige die bepaalt welke maandag bij een dag hoort.
// ---------------------------------------------------------------------------

/** Een dag als "YYYY-MM-DD" in de LOKALE tijdzone — precies wat `?week=` wil. */
export function ymd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Een `?week=`-waarde terug naar de MAANDAG van die week, op lokale middernacht
 * (nooit via `new Date("YYYY-MM-DD")`: dat leest UTC en schuift in een westelijke
 * tijdzone een dag terug). Een dag midden in de week wordt naar zijn maandag
 * getrokken. Onleesbaar, leeg of kalender-ongeldig → null.
 */
export function parseWeek(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfISOWeek(value);
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  // Kalender-ongeldig (30-02, maand 13) rolt in JS door naar een andere datum.
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return startOfISOWeek(d);
}

/**
 * De maandag van de week `delta` weken verder (negatief = terug), als
 * "YYYY-MM-DD". Rekent met `setDate` en niet met kale millisecondes, zodat de
 * zomertijd-overgang de dag niet laat verspringen. Onleesbare invoer → "".
 */
export function shiftWeek(week: Date | string, delta: number): string {
  const monday = parseWeek(week);
  if (!monday) return "";
  monday.setDate(monday.getDate() + delta * 7);
  return ymd(monday);
}

/**
 * De link naar één week op `basePath`, mét behoud van de filters die al aan
 * stonden (tab, zoekopdracht, "voor wie"). Zonder week → geen `week=`-param:
 * dat is de "Alle weken"-stand van de verzendmap en de ontvangen facturen.
 * Lege, null- en undefined-filters vallen weg.
 */
export function weekHref(
  basePath: string,
  week: string | null | undefined,
  extra?: Record<string, string | null | undefined>,
): string {
  const params = new URLSearchParams();
  if (week) params.set("week", week);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
