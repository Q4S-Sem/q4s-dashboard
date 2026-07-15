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
  role: z.enum(APP_USER_ROLE_VALUES).default("GEBRUIKER"),
  password: z.string().optional(),
});

export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(UserSchema, formData);
  if (!parsed.success) return parsed.state;

  const active = formData.get("active") === "on";
  const pw = parsed.data.password?.trim();

  try {
    await db.appUser.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.trim().toLowerCase(),
        jobTitle: parsed.data.jobTitle?.trim() || null,
        role: parsed.data.role,
        active,
        passwordHash: pw ? hashPassword(pw) : null,
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

  const data: {
    name: string;
    email: string;
    jobTitle: string | null;
    role: string;
    active: boolean;
    passwordHash?: string;
  } = {
    name: parsed.data.name,
    email: parsed.data.email.trim().toLowerCase(),
    jobTitle: parsed.data.jobTitle?.trim() || null,
    role: parsed.data.role,
    active,
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
