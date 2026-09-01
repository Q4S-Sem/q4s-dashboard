import { db } from "./db";
import { formatDate, formatHours, startOfISOWeek } from "./utils";
import {
  parseConfirmInput,
  type ConfirmInboxRaw,
  type ConfirmInputError,
} from "./inbox-confirm-input";

// ---------------------------------------------------------------------------
// De kern van "inbox-item bevestigen": van een uitgelezen weekstaat een échte
// urenstaat maken (Timesheet + dagregels), het inbox-item op CONFIRMED zetten en
// de leer-lus per afzender bijwerken.
//
// Bewust ZONDER redirect/revalidate: die horen bij de server action. Zo kunnen
// zowel de losse knop (confirmInbox in src/app/(app)/inbox/actions.ts) als het
// in één keer goedkeuren op /verwerken/controle exact dezelfde stappen doen.
//
// Hier wordt NOOIT iets verstuurd en NOOIT een factuur gemaakt.
// ---------------------------------------------------------------------------

/** Status waarin een uitgelezen, nog niet bevestigd inbox-item hoort te staan. */
const PENDING_STATUS = "EXTRACTED";

export type ConfirmInboxItemInput = ConfirmInboxRaw & {
  /** TimesheetInbox.id */
  id: string;
  /**
   * Alleen bevestigen als het item nog écht openstaat (EXTRACTED, nog geen
   * urenstaat). Gebruikt door de batch-knop: wat intussen al verwerkt is wordt
   * overgeslagen in plaats van dubbel gedaan.
   */
  requirePending?: boolean;
};

export type ConfirmInboxError =
  | ConfirmInputError
  /** Geen id meegegeven. */
  | "id"
  /** Het inbox-item bestaat niet (meer). */
  | "missing"
  /** Het item staat niet meer open (al bevestigd/afgewezen). */
  | "state"
  /** Er is al een urenstaat voor deze plaatsing + week. */
  | "exists";

export type ConfirmInboxItemResult =
  | { ok: true; timesheetId: string }
  | { ok: false; error: ConfirmInboxError };

/**
 * Leer-lus: vergelijk wat de AI las met wat er bij het bevestigen is vastgezet,
 * en bewaar de verschillen als aandachtspunten bij de afzender (SenderProfile).
 * Die worden bij een volgende staat van dezelfde afzender aan de AI meegegeven.
 * Best-effort: mag de bevestiging nooit blokkeren.
 */
async function recordCorrection(
  item: {
    senderEmail: string | null;
    extractedName: string | null;
    extractedTotalHours: number | null;
    extractedKilometers: number | null;
    extractedOvertimeHours: number | null;
    extractedWeekStart: Date | null;
  },
  confirmed: { hours: number; km: number | null; overtime: number | null; monday: Date },
) {
  const key = item.senderEmail?.trim().toLowerCase();
  if (!key) return; // leren gebeurt per e-mailafzender (bekend bij de mail-intake)

  const lines: string[] = [];
  const aiH = item.extractedTotalHours ?? 0;
  if (Math.abs(aiH - confirmed.hours) > 0.01) {
    lines.push(
      `Uren: AI las ${formatHours(aiH)} u, moest ${formatHours(confirmed.hours)} u zijn — tel per dag ALLE reguliere regels op (overuren erbuiten).`,
    );
  }
  const aiKm = item.extractedKilometers ?? 0;
  const cKm = confirmed.km ?? 0;
  if (Math.abs(aiKm - cKm) > 0.01) {
    lines.push(
      `Kilometers: AI las ${formatHours(aiKm)} km, moest ${formatHours(cKm)} km zijn — km staan mogelijk in een apart reisblok of los totaal dat gemist werd.`,
    );
  }
  const aiOt = item.extractedOvertimeHours ?? 0;
  const cOt = confirmed.overtime ?? 0;
  if (Math.abs(aiOt - cOt) > 0.01) {
    lines.push(
      `Overuren: AI las ${formatHours(aiOt)} u, moest ${formatHours(cOt)} u zijn — kijk naar de aparte overuren-sectie.`,
    );
  }
  if (
    item.extractedWeekStart &&
    startOfISOWeek(item.extractedWeekStart).getTime() !== confirmed.monday.getTime()
  ) {
    lines.push(
      `Week: AI koos de week van ${formatDate(item.extractedWeekStart)}, moest week van ${formatDate(confirmed.monday)} zijn — let op het jaar en de datums.`,
    );
  }
  if (lines.length === 0) return; // niks te leren

  const existing = await db.senderProfile.findUnique({ where: { key } });
  const prev = existing?.hints ? existing.hints.split("\n").filter(Boolean) : [];
  // Nieuwe aandachtspunten vooraan, dedup, cap op 8 regels / ~1200 tekens.
  const merged = [...lines, ...prev.filter((p) => !lines.includes(p))].slice(0, 8);
  const hints = merged.join("\n").slice(0, 1200);
  await db.senderProfile.upsert({
    where: { key },
    update: {
      hints,
      corrections: { increment: 1 },
      label: item.extractedName ?? existing?.label ?? null,
    },
    create: { key, hints, corrections: 1, label: item.extractedName ?? null },
  });
}

/**
 * Zet één inbox-item om in een echte urenstaat (status APPROVED) en koppel ze aan
 * elkaar. Geeft terug wat er gebeurd is; de aanroeper beslist over redirect,
 * revalidate en meldingen.
 */
export async function confirmInboxItem(
  input: ConfirmInboxItemInput,
): Promise<ConfirmInboxItemResult> {
  const id = String(input.id ?? "").trim();
  if (!id) return { ok: false, error: "id" };

  const item = await db.timesheetInbox.findUnique({ where: { id } });
  if (!item) return { ok: false, error: "missing" };
  if (input.requirePending && (item.status !== PENDING_STATUS || item.timesheetId)) {
    return { ok: false, error: "state" };
  }

  const parsed = parseConfirmInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { placementId, monday, entries, kilometers, overtimeHours, totalHours } = parsed.fields;

  const placement = await db.placement.findUnique({ where: { id: placementId } });
  if (!placement) return { ok: false, error: "match" };

  let timesheetId: string;
  try {
    const ts = await db.timesheet.create({
      data: {
        placementId,
        weekStart: monday,
        status: "APPROVED",
        note: null,
        kilometers,
        overtimeHours,
        entries: { create: entries },
      },
    });
    timesheetId = ts.id;
  } catch {
    // Al een urenstaat voor deze plaatsing + week (@@unique) — niet nog een keer.
    return { ok: false, error: "exists" };
  }

  await db.timesheetInbox.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      consultantId: placement.consultantId,
      placementId,
      timesheetId,
      extractedWeekStart: monday,
      // Afgehandeld = niet meer aan het wachten: uit de wachtkamer halen.
      wachtkamerSince: null,
      wachtkamerReason: null,
    },
  });

  // Leer-lus: onthoud wat de AI anders had dan de bevestigde waarden (per afzender).
  await recordCorrection(item, {
    hours: totalHours,
    km: kilometers,
    overtime: overtimeHours,
    monday,
  }).catch(() => {});

  return { ok: true, timesheetId };
}
