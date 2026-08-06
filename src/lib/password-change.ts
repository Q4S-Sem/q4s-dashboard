import "server-only";
import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import {
  sendMail,
  isEmailConfigured,
  renderQ4sEmail,
  renderQ4sEmailText,
} from "./email";
import { getCompanySettings } from "./settings";

/**
 * Zelf je wachtwoord wijzigen vanuit Instellingen, met een code per e-mail.
 *
 * Waarom een code en niet meteen opslaan: iemand die even bij je open scherm
 * zit kan anders je wachtwoord veranderen en je buitensluiten. Door de
 * bevestiging via de mailbox te laten lopen moet je bij twéé dingen kunnen.
 *
 * Verdere keuzes:
 * - Je huidige wachtwoord is óók nodig. De code alleen zou betekenen dat wie in
 *   de mailbox kan, genoeg heeft.
 * - Het nieuwe wachtwoord staat gehasht klaar in het verzoek en is pas actief
 *   na de juiste code — nooit als leesbare tekst opgeslagen.
 * - In de database staat alleen de SHA-256 van de code. Een databaselek levert
 *   dus geen bruikbare codes op.
 * - 15 minuten geldig, maximaal 5 pogingen, en een nieuwe aanvraag maakt oudere
 *   verzoeken ongeldig.
 */

const TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
export const CODE_LENGTH = 6;

function hashCode(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

/** Vergelijk in constante tijd, zodat de duur niets over de code verklapt. */
function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type ChangeStart =
  | { ok: true; simulated: boolean }
  | { ok: false; reason: "wachtwoord" | "geen-account" | "geen-mail" };

/**
 * Stap 1: controleer het huidige wachtwoord, leg het nieuwe klaar en mail een
 * code. Geeft `simulated` terug als e-mail niet is ingesteld (dan is er niets
 * verstuurd).
 */
export async function startPasswordChange(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangeStart> {
  const user = await db.appUser.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, reason: "geen-account" };
  if (!user.passwordHash || !verifyPassword(currentPassword, user.passwordHash)) {
    return { ok: false, reason: "wachtwoord" };
  }
  if (!isEmailConfigured()) return { ok: false, reason: "geen-mail" };

  // Eén openstaand verzoek per gebruiker: eerdere codes vervallen.
  await db.passwordChangeRequest.deleteMany({ where: { userId, usedAt: null } });

  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
  await db.passwordChangeRequest.create({
    data: {
      userId,
      codeHash: hashCode(code),
      newHash: hashPassword(newPassword),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  const company = await getCompanySettings();
  const content = {
    kicker: "Beveiliging",
    heading: "Bevestig je nieuwe wachtwoord",
    greeting: `Hallo ${user.name},`,
    paragraphs: [
      "Er is zojuist een nieuw wachtwoord ingesteld voor je Q4S-dashboard. Vul de code hieronder in het dashboard in om het te activeren.",
      "De code is 15 minuten geldig. Heb je dit niet zelf gedaan? Dan hoef je niets te doen — je huidige wachtwoord blijft gewoon werken. Waarschuw wel even een beheerder.",
    ],
    summary: [
      { label: "Verificatiecode", value: code },
      { label: "Geldig tot", value: new Date(Date.now() + TTL_MS).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) },
    ],
    footerLines: [company.companyName ?? "Q4S Project Partners"].filter(Boolean) as string[],
  };

  const res = await sendMail({
    to: user.email,
    subject: `Je verificatiecode: ${code}`,
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
  });

  return { ok: true, simulated: Boolean(res.simulated) };
}

export type ChangeConfirm =
  | { ok: true }
  | { ok: false; reason: "geen-verzoek" | "verlopen" | "code" | "te-vaak" };

/** Stap 2: code controleren en het klaargezette wachtwoord activeren. */
export async function confirmPasswordChange(
  userId: string,
  code: string,
): Promise<ChangeConfirm> {
  const req = await db.passwordChangeRequest.findFirst({
    where: { userId, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!req) return { ok: false, reason: "geen-verzoek" };
  if (req.expiresAt < new Date()) {
    await db.passwordChangeRequest.delete({ where: { id: req.id } });
    return { ok: false, reason: "verlopen" };
  }
  if (req.attempts >= MAX_ATTEMPTS) {
    await db.passwordChangeRequest.delete({ where: { id: req.id } });
    return { ok: false, reason: "te-vaak" };
  }
  if (!sameHash(hashCode(code), req.codeHash)) {
    await db.passwordChangeRequest.update({
      where: { id: req.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "code" };
  }

  // Alles-of-niets: wachtwoord zetten, verzoek verbruiken en openstaande
  // herstel-links van deze gebruiker ongeldig maken.
  await db.$transaction([
    db.appUser.update({ where: { id: userId }, data: { passwordHash: req.newHash } }),
    db.passwordChangeRequest.update({
      where: { id: req.id },
      data: { usedAt: new Date() },
    }),
    db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
  ]);

  return { ok: true };
}

/** Staat er een code klaar voor deze gebruiker? Voor de juiste stap in beeld. */
export async function hasOpenRequest(userId: string): Promise<boolean> {
  const req = await db.passwordChangeRequest.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return Boolean(req);
}
