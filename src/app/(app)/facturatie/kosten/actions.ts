"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { KOSTEN_CATEGORIEEN } from "@/lib/kosten";

const getal = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").replace(/[€\s]/g, "");
  // "1.234,56" (NL) en "1234.56" allebei goed lezen.
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
};

/** Eigen bedrijfskost toevoegen (bedrag ex btw). */
export async function voegKostToe(formData: FormData) {
  const datum = new Date(`${String(formData.get("date") ?? "")}T12:00:00`);
  const bedrag = getal(formData.get("amount"));
  const btw = getal(formData.get("vatAmount") || "0");
  const cat = String(formData.get("category") ?? "OVERIG");
  const jaar = Number.isNaN(datum.getTime()) ? new Date().getFullYear() : datum.getFullYear();
  if (Number.isNaN(datum.getTime()) || !(bedrag > 0) || Number.isNaN(btw) || btw < 0) {
    redirect(`/facturatie/kosten?jaar=${jaar}&fout=1`);
  }
  await db.bedrijfsKost.create({
    data: {
      date: datum,
      category: KOSTEN_CATEGORIEEN.some((c) => c.value === cat) ? cat : "OVERIG",
      description: String(formData.get("description") ?? "").trim().slice(0, 200),
      amount: Math.round(bedrag * 100) / 100,
      vatAmount: Math.round(btw * 100) / 100,
    },
  });
  revalidatePath("/", "layout");
  redirect(`/facturatie/kosten?jaar=${jaar}&toegevoegd=1`);
}

export async function verwijderKost(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const kost = id ? await db.bedrijfsKost.delete({ where: { id } }).catch(() => null) : null;
  revalidatePath("/", "layout");
  redirect(`/facturatie/kosten?jaar=${kost?.date.getFullYear() ?? new Date().getFullYear()}`);
}
