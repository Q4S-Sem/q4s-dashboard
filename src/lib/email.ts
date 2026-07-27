import nodemailer from "nodemailer";
import { getCompanySettings } from "./settings";

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
};

export type MailResult = {
  ok: boolean;
  /** True when no SMTP is configured: everything was composed but NOT sent. */
  simulated: boolean;
  messageId?: string;
  error?: string;
};

/**
 * SMTP is "configured" only when the core env vars are present. Until then the
 * verzendmap runs in klaarzet-modus: it composes the mail + PDF + preview but
 * does NOT actually send anything (safe by default). Set these in `.env` to
 * switch on real sending:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE(optional)
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

/** The From header — SMTP_FROM, else the SMTP user, else a safe default. */
export function emailFrom(name = "Q4S"): string {
  const from = process.env.SMTP_FROM?.trim();
  if (from) return from;
  const user = process.env.SMTP_USER?.trim();
  return user ? `${name} <${user}>` : `${name} <no-reply@q4s.nl>`;
}

/**
 * TESTMODUS — mail-omleiding. Staat er een omleidingsadres (env MAIL_REDIRECT_TO,
 * anders de bedrijfsinstelling mailRedirectTo), dan gaat ELKE uitgaande mail naar
 * dat adres i.p.v. de echte ontvanger. Zo test je facturen/herinneringen zonder
 * dat klanten of medewerkers per ongeluk mail krijgen. Leeg = normaal versturen.
 */
export async function getMailRedirect(): Promise<string | null> {
  const env = process.env.MAIL_REDIRECT_TO?.trim();
  if (env) return env;
  try {
    const s = await getCompanySettings();
    return s.mailRedirectTo?.trim() || null;
  } catch {
    return null;
  }
}

/** Send a mail via SMTP — or, when SMTP isn't configured, report a simulated send.
 *  Bij een actieve omleiding (testmodus) gaat de mail naar het omleidingsadres. */
export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!isEmailConfigured()) return { ok: true, simulated: true };

  // Veiligheidsnet: leid alle mail om zolang testmodus aanstaat.
  const redirect = await getMailRedirect();
  const to = redirect || input.to;
  const subject = redirect ? `[TEST → ${input.to}] ${input.subject}` : input.subject;
  const html = redirect
    ? `<div style="background:#fef3c7;color:#92400e;padding:10px 14px;font:13px Arial,sans-serif;border-bottom:1px solid #fde68a;">⚠️ <b>TESTMODUS</b> — deze e-mail zou normaal naar <b>${esc(
        input.to,
      )}</b> gaan. Nu omgeleid naar jou; de echte ontvanger krijgt niets.</div>${input.html}`
    : input.html;
  const text = redirect
    ? `[TESTMODUS — zou normaal naar ${input.to} gaan; echte ontvanger krijgt niets]\n\n${input.text}`
    : input.text;

  try {
    const port = Number(process.env.SMTP_PORT) || 587;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    const info = await transport.sendMail({
      from: emailFrom(),
      to,
      subject,
      text,
      html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? "application/pdf",
      })),
    });
    return { ok: true, simulated: false, messageId: info.messageId };
  } catch (err) {
    return {
      ok: false,
      simulated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Q4S-branded e-mail template (inline styles — robust across mail clients).
// ---------------------------------------------------------------------------

export type EmailContent = {
  /** Small label in de header-balk, bijv. "Factuur". */
  kicker: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  /** Optionele actieknop (bijv. "Wachtwoord instellen"). */
  cta?: { label: string; url: string };
  /** A small key/value summary box (factuurnummer, datum, totaal…). */
  summary: { label: string; value: string }[];
  /** Footer lines (company contact details). */
  footerLines: string[];
  /** Optional "📎 … bijgevoegd" note — only shown when there's an attachment. */
  attachmentNote?: string;
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Merkkleur: zwart/neutraal (i.p.v. het oude oranje), afgestemd op de rest van de
// Q4S-huisstijl (zie globals.css / het CV / de login).
const BRAND = "#171717";
const KICKER = "#a3a3a3";
const INK = "#0f172a";

/** Render the Q4S HTML e-mail (the "layout" + begeleidend bericht). */
export function renderQ4sEmail(c: EmailContent): string {
  const summaryRows = c.summary
    .map(
      (s) => `
      <tr>
        <td style="padding:4px 0;color:#64748b;font-size:13px;">${esc(s.label)}</td>
        <td style="padding:4px 0;color:${INK};font-size:13px;font-weight:600;text-align:right;">${esc(
          s.value,
        )}</td>
      </tr>`,
    )
    .join("");

  const paras = c.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.6;">${esc(
          p,
        )}</p>`,
    )
    .join("");

  const footer = c.footerLines
    .filter(Boolean)
    .map((l) => esc(l))
    .join(" &nbsp;·&nbsp; ");

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f5f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e8e8e6;border-radius:14px;overflow:hidden;font-family:Inter,Arial,Helvetica,sans-serif;">
        <tr>
          <td style="background:${BRAND};padding:18px 28px;">
            <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:.5px;">Q4S</span>
            <span style="color:${KICKER};font-size:12px;text-transform:uppercase;letter-spacing:1px;float:right;padding-top:6px;">${esc(
              c.kicker,
            )}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <h1 style="margin:0 0 16px;color:${INK};font-size:20px;font-weight:800;">${esc(
              c.heading,
            )}</h1>
            <p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.6;">${esc(
              c.greeting,
            )}</p>
            ${paras}
            ${
              c.cta
                ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr><td style="border-radius:8px;background:${BRAND};">
                    <a href="${esc(c.cta.url)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">${esc(
                      c.cta.label,
                    )}</a></td></tr></table>`
                : ""
            }
            ${
              c.summary.length
                ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;background:#f8fafc;border:1px solid #eef2f6;border-radius:10px;padding:6px 16px;">
              ${summaryRows}
            </table>`
                : ""
            }
            <p style="margin:0 0 6px;color:#334155;font-size:14px;line-height:1.6;">Met vriendelijke groet,</p>
            <p style="margin:0 0 18px;color:${INK};font-size:14px;font-weight:700;">Team Q4S</p>
            ${
              c.attachmentNote
                ? `<p style="margin:0;color:#94a3b8;font-size:12px;">📎 ${esc(c.attachmentNote)}</p>`
                : ""
            }
          </td>
        </tr>
        <tr>
          <td style="background:${INK};padding:16px 28px;color:#94a3b8;font-size:12px;line-height:1.6;">
            ${footer || "Q4S"}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Plain-text fallback body, derived from the same content. */
export function renderQ4sEmailText(c: EmailContent): string {
  const lines = [
    c.heading,
    "",
    c.greeting,
    "",
    ...c.paragraphs,
    "",
    ...(c.cta ? [c.cta.label + ": " + c.cta.url, ""] : []),
    ...c.summary.map((s) => `${s.label}: ${s.value}`),
    ...(c.summary.length ? [""] : []),
    ...(c.attachmentNote ? [c.attachmentNote, ""] : []),
    "Met vriendelijke groet,",
    "Team Q4S",
    "",
    c.footerLines.filter(Boolean).join(" · "),
  ];
  return lines.join("\n");
}
