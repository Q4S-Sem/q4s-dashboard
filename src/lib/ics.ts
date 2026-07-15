// Minimal iCalendar (.ics) parser — enough to import VEVENTs from e-mailed
// invites or exported calendars (Outlook/Google/Apple). No external deps.

export type ParsedIcsEvent = {
  uid?: string;
  /** RECURRENCE-ID — set on a single overridden occurrence of a recurring event. */
  recurrenceId?: string;
  title: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  location?: string;
  description?: string;
};

/**
 * Stable de-dup key for storage. Override instances of a recurring series share
 * one UID but differ by RECURRENCE-ID, so combine them — otherwise every
 * occurrence would upsert onto the same row and only the last would survive.
 * Returns null when the event has no UID (then we just create a fresh row).
 */
export function icsStorageUid(ev: ParsedIcsEvent): string | null {
  if (!ev.uid) return null;
  return ev.recurrenceId ? `${ev.uid}::${ev.recurrenceId}` : ev.uid;
}

/** RFC 5545 line unfolding: a leading space/tab continues the previous line. */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Parse an iCal date(-time) value into a JS Date + an all-day flag. */
function parseIcsDate(
  value: string,
  params: string,
): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  const dateOnly = /VALUE=DATE(?!-TIME)/i.test(params) || /^\d{8}$/.test(v);
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, z] = m;
  if (dateOnly || hh === undefined) {
    return { date: new Date(Number(y), Number(mo) - 1, Number(d)), allDay: true };
  }
  const H = Number(hh);
  const M = Number(mm);
  const S = ss ? Number(ss) : 0;
  if (z) {
    return {
      date: new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), H, M, S)),
      allDay: false,
    };
  }
  // Floating / TZID time — treat as local; we ignore TZID conversion here.
  return { date: new Date(Number(y), Number(mo) - 1, Number(d), H, M, S), allDay: false };
}

/** Parse a full .ics document into its events. Invalid blocks are skipped. */
export function parseIcs(text: string): ParsedIcsEvent[] {
  if (!text || !text.includes("BEGIN:VEVENT")) return [];
  const lines = unfold(text);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let uid: string | undefined;
  let recurrenceId: string | undefined;
  let title: string | undefined;
  let location: string | undefined;
  let description: string | undefined;
  let start: { date: Date; allDay: boolean } | undefined;
  let end: Date | undefined;

  const reset = () => {
    uid = recurrenceId = title = location = description = undefined;
    start = end = undefined;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      reset();
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (inEvent && start) {
        events.push({
          uid,
          recurrenceId,
          title: (title ?? "").trim() || "Afspraak",
          start: start.date,
          end,
          allDay: start.allDay,
          location: location || undefined,
          description: description || undefined,
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const semi = left.indexOf(";");
    const name = (semi === -1 ? left : left.slice(0, semi)).toUpperCase();
    const params = semi === -1 ? "" : left.slice(semi + 1);

    switch (name) {
      case "UID":
        uid = value.trim();
        break;
      case "RECURRENCE-ID": {
        const p = parseIcsDate(value.trim(), params);
        recurrenceId = p ? String(p.date.getTime()) : value.trim();
        break;
      }
      case "SUMMARY":
        title = unescapeText(value);
        break;
      case "LOCATION":
        location = unescapeText(value);
        break;
      case "DESCRIPTION":
        description = unescapeText(value);
        break;
      case "DTSTART": {
        const p = parseIcsDate(value, params);
        if (p) start = p;
        break;
      }
      case "DTEND": {
        const p = parseIcsDate(value, params);
        if (p) end = p.date;
        break;
      }
    }
  }

  return events;
}
