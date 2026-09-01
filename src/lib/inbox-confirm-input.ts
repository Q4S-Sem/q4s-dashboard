import { parseHours, round2, startOfISOWeek } from "./utils";

// ---------------------------------------------------------------------------
// De invoer-kant van "inbox-item bevestigen": ruwe velden (plaatsing, week,
// dag-uren, km, overuren) → gecontroleerde waarden waar een urenstaat van
// gemaakt kan worden.
//
// PUUR: geen Prisma, geen redirect, geen datum-van-nu. Zowel het formulier in de
// inbox (FormData) als de "keur alle groene goed"-knop op /verwerken/controle
// (uitgelezen waarden) lopen hier langs, zodat één week op precies dezelfde
// manier gelezen wordt — waar hij ook vandaan komt.
// ---------------------------------------------------------------------------

/** Ruwe velden zoals ze uit een formulier of uit de uitlezing komen. */
export type ConfirmInboxRaw = {
  placementId: string | null | undefined;
  /** "YYYY-MM-DD"; wordt naar de maandag van die ISO-week getrokken. */
  weekStart: string | null | undefined;
  kilometers?: string | number | null;
  overtimeHours?: string | number | null;
  /** Uren per dag, Ma..Zo (index 0..6); leeg/0 = die dag niet gewerkt. */
  hours: (string | number | null | undefined)[];
};

/** Wat er nodig is om de urenstaat aan te maken. */
export type ConfirmInboxFields = {
  placementId: string;
  monday: Date;
  entries: { date: Date; hours: number }[];
  kilometers: number | null;
  overtimeHours: number | null;
  /** Weektotaal van de dagregels (reguliere uren, ex overuren). */
  totalHours: number;
};

/**
 * Waarom de invoer niet bruikbaar is — dezelfde codes als de `?error=`-melding
 * op de inbox-detailpagina.
 */
export type ConfirmInputError = "match" | "week" | "hours";

export type ConfirmInputResult =
  | { ok: true; fields: ConfirmInboxFields }
  | { ok: false; error: ConfirmInputError };

/**
 * Controleer en normaliseer de bevestig-velden.
 *
 * - Geen plaatsing → `match`; geen (of onleesbare) week → `week`; geen enkele
 *   dag met uren → `hours`.
 * - De week wordt altijd naar de maandag getrokken (startOfISOWeek).
 * - Alleen dagen met méér dan 0 uur worden een dagregel; km en overuren van 0
 *   worden `null` (niet gemeld i.p.v. "nul gereden").
 */
export function parseConfirmInput(raw: ConfirmInboxRaw): ConfirmInputResult {
  const placementId = String(raw.placementId ?? "").trim();
  if (!placementId) return { ok: false, error: "match" };

  const weekStartRaw = String(raw.weekStart ?? "").trim();
  if (!weekStartRaw) return { ok: false, error: "week" };
  const parsedWeek = new Date(`${weekStartRaw}T00:00:00`);
  if (Number.isNaN(parsedWeek.getTime())) return { ok: false, error: "week" };
  const monday = startOfISOWeek(parsedWeek);

  const kilometers = parseHours(raw.kilometers ?? "") || null;
  const overtimeHours = parseHours(raw.overtimeHours ?? "") || null;

  const entries: { date: Date; hours: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const hours = parseHours(raw.hours?.[i] ?? "");
    if (hours > 0) {
      const date = new Date(monday);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      entries.push({ date, hours });
    }
  }
  if (entries.length === 0) return { ok: false, error: "hours" };

  return {
    ok: true,
    fields: {
      placementId,
      monday,
      entries,
      kilometers,
      overtimeHours,
      totalHours: round2(entries.reduce((sum, e) => sum + e.hours, 0)),
    },
  };
}
