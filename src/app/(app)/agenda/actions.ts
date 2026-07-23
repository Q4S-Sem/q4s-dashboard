"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { EVENT_TYPE_VALUES, EVENT_STATUS_VALUES } from "@/lib/domain";
import { parseIcs, icsStorageUid } from "@/lib/ics";

const EventSchema = z
  .object({
    title: z.string().min(1, "Titel is verplicht"),
    type: z.enum(EVENT_TYPE_VALUES).default("MEETING"),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    location: z.string().optional(),
    status: z.enum(EVENT_STATUS_VALUES).default("PLANNED"),
    targetClientId: z.string().optional(),
    clientId: z.string().optional(),
    candidateId: z.string().optional(),
    vacancyId: z.string().optional(),
    assigneeId: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => !d.end || d.end >= d.start, {
    message: "Einde ligt vóór de start",
    path: ["end"],
  });

function toData(data: z.infer<typeof EventSchema>, allDay: boolean) {
  return {
    title: data.title,
    type: data.type,
    start: data.start,
    end: data.end ?? null,
    allDay,
    location: data.location ?? null,
    status: data.status,
    targetClientId: data.targetClientId ?? null,
    clientId: data.clientId ?? null,
    candidateId: data.candidateId ?? null,
    vacancyId: data.vacancyId ?? null,
    assigneeId: data.assigneeId || null,
    notes: data.notes ?? null,
  };
}

export async function createEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(EventSchema, formData);
  if (!parsed.success) return parsed.state;

  const allDay = formData.get("allDay") === "on";
  const created = await db.calendarEvent.create({
    data: { ...toData(parsed.data, allDay), source: "MANUAL" },
  });
  revalidatePath("/agenda");
  redirect(`/agenda/${created.id}`);
}

export async function updateEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende afspraak." };

  const parsed = parseForm(EventSchema, formData);
  if (!parsed.success) return parsed.state;

  const allDay = formData.get("allDay") === "on";
  await db.calendarEvent.update({
    where: { id },
    data: toData(parsed.data, allDay),
  });
  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  redirect(`/agenda/${id}`);
}

export async function deleteEvent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.calendarEvent.delete({ where: { id } });
  revalidatePath("/agenda");
  redirect("/agenda");
}

/** Verwijderen vanuit de kalender-popover: wist + revalideert, zónder redirect,
 *  zodat de popover sluit en je op dezelfde maand blijft. */
export async function deleteEventStay(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.calendarEvent.delete({ where: { id } });
  revalidatePath("/agenda");
}

/**
 * Snel een afspraak inplannen vanuit de maandkalender (klik op een dag → mini-
 * formulier). Blijft bewust op de agenda staan (geen redirect) zodat je meteen
 * doorplant; leeg/ongeldig wordt genegeerd. Voor alle velden → /agenda/nieuw.
 */
export async function quickCreateEvent(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) return;

  const rawType = String(formData.get("type") ?? "MEETING");
  const type = EVENT_TYPE_VALUES.includes(rawType) ? rawType : "MEETING";
  const time = String(formData.get("time") ?? "");
  const [y, mo, d] = date.split("-").map(Number);
  let h = 9;
  let mi = 0;
  if (/^\d{1,2}:\d{2}$/.test(time)) [h, mi] = time.split(":").map(Number);

  await db.calendarEvent.create({
    data: {
      title,
      type,
      start: new Date(y, mo - 1, d, h, mi, 0, 0),
      status: "PLANNED",
      source: "MANUAL",
    },
  });
  revalidatePath("/agenda");
}

/**
 * Move an appointment to another date/time ("verschuiven") while keeping its
 * duration. For all-day events only the date changes. Redirects to the day view
 * of the new date so you follow the appointment.
 */
export async function rescheduleEvent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const dateStr = String(formData.get("date") ?? "");
  const timeStr = String(formData.get("time") ?? "");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

  const ev = await db.calendarEvent.findUnique({ where: { id } });
  if (!ev) return;

  const [y, mo, d] = dateStr.split("-").map(Number);
  const cur = new Date(ev.start);
  let hours = cur.getHours();
  let minutes = cur.getMinutes();
  if (!ev.allDay && /^\d{1,2}:\d{2}$/.test(timeStr)) {
    [hours, minutes] = timeStr.split(":").map(Number);
  }

  const newStart = new Date(y, mo - 1, d, ev.allDay ? 0 : hours, ev.allDay ? 0 : minutes, 0, 0);
  let newEnd: Date | null = null;
  if (ev.end) {
    const dur = new Date(ev.end).getTime() - cur.getTime();
    newEnd = new Date(newStart.getTime() + dur);
  }

  await db.calendarEvent.update({
    where: { id },
    data: { start: newStart, end: newEnd },
  });
  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  redirect(`/agenda/dag/${dateStr}`);
}

/** Mark an event done/planned/cancelled from the detail page. */
export async function setEventStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !EVENT_STATUS_VALUES.includes(status)) return;
  await db.calendarEvent.update({ where: { id }, data: { status } });
  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
}

/**
 * Import events from pasted .ics text and/or an uploaded .ics file. De-dupes on
 * the iCalendar UID (re-importing the same invite updates it instead of
 * duplicating). Redirects back to the calendar with a count.
 */
export async function importIcs(formData: FormData) {
  let text = String(formData.get("ics") ?? "");
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    text += "\n" + (await file.text());
  }

  const events = parseIcs(text);
  let imported = 0;
  for (const ev of events) {
    const data = {
      title: ev.title,
      type: "MEETING",
      start: ev.start,
      end: ev.end ?? null,
      allDay: ev.allDay,
      location: ev.location ?? null,
      notes: ev.description ?? null,
      source: "ICS",
    };
    const uid = icsStorageUid(ev);
    if (uid) {
      await db.calendarEvent.upsert({
        where: { uid },
        create: { ...data, uid },
        update: data,
      });
    } else {
      await db.calendarEvent.create({ data });
    }
    imported++;
  }

  revalidatePath("/agenda");
  redirect(`/agenda?imported=${imported}`);
}
