import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/api-auth";
import { startOfISOWeek } from "@/lib/utils";

/**
 * Kijkt vooruit of het invoeren van deze urenstaat dubbel werk is.
 *
 * Twee gevallen die je pas ná het invullen zou merken, en dan is je werk weg:
 *  • er staat al een urenstaat voor deze plaatsing in deze week;
 *  • er ligt al een ingelezen staat in de timesheet-inbox (uit de mail of een
 *    upload) die de AI heeft uitgelezen en die alleen nog bevestigd hoeft.
 */
export async function GET(req: Request) {
  const gate = await requireApiSession();
  if (gate) return gate;

  const url = new URL(req.url);
  const placementId = url.searchParams.get("placement")?.trim();
  const week = url.searchParams.get("week")?.trim();
  if (!placementId || !week) {
    return Response.json({ existing: null, inbox: null });
  }

  const parsed = new Date(`${week}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return Response.json({ existing: null, inbox: null });
  }
  const monday = startOfISOWeek(parsed);

  // Zoek op een venster rond die maandag in plaats van op een exacte tijdstempel.
  // `weekStart` is soms als UTC-middernacht opgeslagen en soms als lokale
  // middernacht (dat scheelt hier twee uur), waardoor een exacte match de
  // bestaande staat zou missen — precies de waarschuwing die we willen tonen.
  // Weken liggen zeven dagen uit elkaar, dus ±12 uur kan nooit de verkeerde
  // week raken.
  const HALF_DAY = 12 * 60 * 60 * 1000;
  const from = new Date(monday.getTime() - HALF_DAY);
  const to = new Date(monday.getTime() + HALF_DAY);

  const [existing, inbox] = await Promise.all([
    db.timesheet.findFirst({
      where: { placementId, weekStart: { gte: from, lte: to } },
      select: { id: true, status: true },
    }),
    // Alleen een inbox-regel die nog wat betekent: afgewezen staten en al
    // omgezette staten (die hebben een timesheetId) zijn geen waarschuwing waard.
    db.timesheetInbox.findFirst({
      where: {
        placementId,
        extractedWeekStart: { gte: from, lte: to },
        status: { in: ["NEW", "EXTRACTED"] },
        timesheetId: null,
      },
      select: {
        id: true,
        status: true,
        confidence: true,
        extractedTotalHours: true,
        originalName: true,
      },
    }),
  ]);

  return Response.json({ existing, inbox });
}
