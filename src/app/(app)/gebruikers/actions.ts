"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { APP_USER_ROLE_VALUES } from "@/lib/domain";
import { hashPassword } from "@/lib/password";

const UserSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  email: z.string().min(1, "E-mail is verplicht").email("Geen geldig e-mailadres"),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(APP_USER_ROLE_VALUES).default("GEBRUIKER"),
  password: z.string().optional(),
});

/**
 * Normaliseer de rechten-JSON uit het formulier tot een schone string-array-JSON.
 * Kapotte invoer → "[]". Bij een ADMIN slaan we bewust lege lijsten op (die rol
 * ziet toch alles), zodat er geen verouderde selectie blijft hangen.
 */
function cleanHrefJson(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") return "[]";
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return "[]";
    const list = v.filter((x): x is string => typeof x === "string");
    return JSON.stringify([...new Set(list)]);
  } catch {
    return "[]";
  }
}

function readAccess(formData: FormData, role: string): { allowedHubs: string; allowedPages: string } {
  if (role === "ADMIN") return { allowedHubs: "[]", allowedPages: "[]" };
  return {
    allowedHubs: cleanHrefJson(formData.get("allowedHubs")),
    allowedPages: cleanHrefJson(formData.get("allowedPages")),
  };
}

export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(UserSchema, formData);
  if (!parsed.success) return parsed.state;

  const active = formData.get("active") === "on";
  const pw = parsed.data.password?.trim();
  const access = readAccess(formData, parsed.data.role);

  try {
    await db.appUser.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.trim().toLowerCase(),
        jobTitle: parsed.data.jobTitle?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        role: parsed.data.role,
        active,
        passwordHash: pw ? hashPassword(pw) : null,
        allowedHubs: access.allowedHubs,
        allowedPages: access.allowedPages,
      },
    });
  } catch {
    return { error: "Er bestaat al een gebruiker met dit e-mailadres." };
  }

  revalidatePath("/gebruikers");
  redirect("/gebruikers");
}

export async function updateUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende gebruiker." };

  const parsed = parseForm(UserSchema, formData);
  if (!parsed.success) return parsed.state;

  const active = formData.get("active") === "on";
  const pw = parsed.data.password?.trim();
  const access = readAccess(formData, parsed.data.role);

  const data: {
    name: string;
    email: string;
    jobTitle: string | null;
    phone: string | null;
    role: string;
    active: boolean;
    allowedHubs: string;
    allowedPages: string;
    passwordHash?: string;
  } = {
    name: parsed.data.name,
    email: parsed.data.email.trim().toLowerCase(),
    jobTitle: parsed.data.jobTitle?.trim() || null,
    phone: parsed.data.phone?.trim() || null,
    role: parsed.data.role,
    active,
    allowedHubs: access.allowedHubs,
    allowedPages: access.allowedPages,
  };
  // Only change the password when a new one is entered.
  if (pw) data.passwordHash = hashPassword(pw);

  try {
    await db.appUser.update({ where: { id }, data });
  } catch {
    return { error: "Opslaan mislukt — e-mailadres mogelijk al in gebruik." };
  }

  revalidatePath("/gebruikers");
  redirect("/gebruikers");
}

export async function deleteUser(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.appUser.delete({ where: { id } });
  revalidatePath("/gebruikers");
  redirect("/gebruikers");
}
