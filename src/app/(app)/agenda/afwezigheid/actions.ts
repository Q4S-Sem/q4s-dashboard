"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LEAVE_TYPE_VALUES } from "@/lib/domain";
import { workdaysExcludingHolidays } from "@/lib/holidays";

/** Meld afwezigheid (vakantie/ziek/…) voor een collega — schrijft een EmployeeLeave
 *  weg die meteen in de agenda-kalender verschijnt. */
export async function addAbsence(formData: FormData) {
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) redirect("/agenda/afwezigheid?error=persoon");
  const emp = await db.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!emp) redirect("/agenda/afwezigheid?error=persoon");

  const start = new Date(String(formData.get("startDate") ?? ""));
  if (isNaN(start.getTime())) redirect("/agenda/afwezigheid?error=datum");
  const endRaw = String(formData.get("endDate") ?? "").trim();
  const parsedEnd = endRaw ? new Date(endRaw) : start;
  const end = isNaN(parsedEnd.getTime()) || parsedEnd < start ? start : parsedEnd;

  const type = String(formData.get("type") ?? "VAKANTIE");
  // Werkdagen excl. weekend + officiële NL-feestdagen (kosten geen verlof).
  const days = workdaysExcludingHolidays(start, end);

  await db.employeeLeave.create({
    data: {
      employeeId,
      type: (LEAVE_TYPE_VALUES as string[]).includes(type) ? type : "VAKANTIE",
      startDate: start,
      endDate: end,
      days,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidatePath("/agenda/afwezigheid");
  revalidatePath("/agenda");
  redirect("/agenda/afwezigheid?ok=1");
}

export async function deleteAbsence(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await db.employeeLeave.delete({ where: { id } }).catch(() => {});
  revalidatePath("/agenda/afwezigheid");
  revalidatePath("/agenda");
  redirect("/agenda/afwezigheid");
}
