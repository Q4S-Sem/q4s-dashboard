import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { db } from "./db";
import { hashPassword } from "./password";
import {
  sendMail,
  isEmailConfigured,
  renderQ4sEmail,
  renderQ4sEmailText,
  type MailResult,
} from "./email";
import { getCompanySettings } from "./settings";

/**
 * Wachtwoord-herstel via een e-maillink.
 *
 * Veiligheidskeuzes:
 * - Het token in de URL is 32 willekeurige bytes; in de database staat alleen de
 *   SHA-256 HASH ervan. Een database-lek levert dus geen bruikbare tokens op.
 * - Eenmalig te gebruiken (usedAt) en 1 uur houdbaar (expiresAt).
 * - Bij een aanvraag verklappen we NOOIT of een e-mailadres bestaat (geen user-
 *   enumeration): de aanvraagpagina toont altijd dezelfde boodschap.
 * - Bij een geslaagde reset worden alle openstaande tokens van die gebruiker
 *   ongeldig, zodat een tweede (gestolen) link niet meer werkt.
 */

const TTL_MS = 60 * 60 * 1000; // 1 uur

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Maak een nieuw reset-token voor een gebruiker; geeft het RUWE token terug (voor in de link). */
export async function createResetToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  return raw;
}

/** Zoek de geldige (niet-gebruikte, niet-verlopen) gebruiker bij een ruw token. */
export async function userIdForToken(raw: string): Promise<string | null> {
  if (!raw) return null;
  const rec = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return null;
  return rec.userId;
}

/**
 * Verbruik het token en zet het nieuwe wachtwoord. Alles-of-niets in één
 * transactie; markeert het token als gebruikt en wist de overige tokens.
 * Geeft false als het token ongeldig/verlopen is.
 */
export async function resetPasswordWithToken(raw: string, newPassword: string): Promise<boolean> {
  const rec = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return false;

  await db.$transaction([
    db.appUser.update({ where: { id: rec.userId }, data: { passwordHash: hashPassword(newPassword) } }),
    db.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    // overige openstaande tokens van deze gebruiker ongeldig maken
    db.passwordResetToken.deleteMany({ where: { userId: rec.userId, usedAt: null, id: { not: rec.id } } }),
  ]);
  return true;
}

/**
 * Verwerk een "wachtwoord vergeten"-aanvraag: maak een token en mail de link.
 * Geeft alleen terug wat er intern gebeurde (voor logging/gating); de PAGINA toont
 * altijd dezelfde neutrale boodschap, ongeacht of het adres bestaat.
 */
export async function requestPasswordReset(
  email: string,
  origin: string,
): Promise<{ found: boolean; mail: MailResult | null }> {
  const clean = email.trim().toLowerCase();
  const user = clean ? await db.appUser.findUnique({ where: { email: clean } }) : null;
  if (!user || !user.active) return { found: false, mail: null };

  const raw = await createResetToken(user.id);
  const link = `${origin.replace(/\/+$/, "")}/wachtwoord-herstellen?token=${encodeURIComponent(raw)}`;

  const settings = await getCompanySettings();
  const company = settings.companyName || "Q4S";
  const content = {
    kicker: "Wachtwoord",
    heading: "Stel je wachtwoord opnieuw in",
    greeting: `Beste ${user.name || "collega"},`,
    paragraphs: [
      `Er is een verzoek gedaan om het wachtwoord van je ${company}-account opnieuw in te stellen.`,
      "Klik op de knop hieronder om een nieuw wachtwoord te kiezen. Deze link is 1 uur geldig en werkt maar één keer.",
      "Heb je dit niet zelf aangevraagd? Dan kun je deze e-mail negeren — je wachtwoord blijft ongewijzigd.",
    ],
    cta: { label: "Nieuw wachtwoord instellen", url: link },
    summary: [],
    footerLines: [
      company,
      [settings.email, settings.phone, settings.website].filter(Boolean).join("  ·  "),
    ].filter(Boolean),
  };

  const mail = await sendMail({
    to: user.email,
    subject: `Wachtwoord opnieuw instellen — ${company}`,
    html: renderQ4sEmail(content),
    text: renderQ4sEmailText(content),
  });
  return { found: true, mail };
}

export { isEmailConfigured };
