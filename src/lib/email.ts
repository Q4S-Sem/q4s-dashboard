import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { getCompanySettings } from "./settings";

/** Het licht e-maillogo (klein PNG) als bytes — voor de CID-inbedding in mails. */
function emailLogoBytes(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "email", "q4s-logo.png"));
  } catch {
    return null;
  }
}

/** Het e-maillogo als data-URI — voor het e-mailvoorbeeld (waar cid: niet werkt). */
export function emailLogoDataUri(): string | null {
  const b = emailLogoBytes();
  return b ? `data:image/png;base64,${b.toString("base64")}` : null;
}

/** De Content-ID waarnaar de mailtemplate verwijst voor het ingebedde logo. */
export const LOGO_CID = "q4slogo";

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
    const logoBytes = emailLogoBytes();
    const info = await transport.sendMail({
      from: emailFrom(),
      to,
      subject,
      text,
      html,
      attachments: [
        // Logo ingebed als inline-afbeelding (cid) — betrouwbaar in Outlook/Gmail,
        // i.t.t. externe URL's of data-URI's die vaak geblokkeerd worden.
        ...(logoBytes
          ? [
              {
                filename: "q4s-logo.png",
                content: logoBytes,
                contentType: "image/png",
                cid: LOGO_CID,
              },
            ]
          : []),
        ...(input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType ?? "application/pdf",
        })) ?? []),
      ],
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

/** Render the Q4S HTML e-mail — professionele briefhoofd-opmaak met ingebed logo.
 *  logoSrc = "cid:q4slogo" bij versturen (inline-bijlage); geef een data-URI mee
 *  voor het voorbeeld, waar cid: niet werkt. */
export function renderQ4sEmail(c: EmailContent, opts?: { logoSrc?: string }): string {
  const logoSrc = opts?.logoSrc ?? `cid:${LOGO_CID}`;

  const paras = c.paragraphs
    .map(
      (p) => `<p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.65;">${esc(p)}</p>`,
    )
    .join("");

  const summaryTable = c.summary.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 6px;border:1px solid #e8e8e8;border-collapse:collapse;">${c.summary
        .map(
          (s, i) =>
            `<tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;${
              i > 0 ? "border-top:1px solid #f1f1f1;" : ""
            }">${esc(s.label)}</td><td style="padding:10px 16px;color:${INK};font-size:13px;font-weight:700;text-align:right;${
              i > 0 ? "border-top:1px solid #f1f1f1;" : ""
            }">${esc(s.value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const cta = c.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;"><tr><td style="background:${BRAND};"><a href="${esc(
        c.cta.url,
      )}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:.2px;">${esc(
        c.cta.label,
      )}</a></td></tr></table>`
    : "";

  const footerAll = c.footerLines.filter(Boolean);
  const footerHead = footerAll[0] ? esc(footerAll[0]) : "Q4S Project Partners";
  const footerRest = footerAll.slice(1).map(esc).join("&nbsp; · &nbsp;");

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6e6e6;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="height:4px;background:${BRAND};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:26px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td align="left" valign="middle"><img src="${logoSrc}" alt="Q4S Project Partners" width="132" style="display:block;border:0;width:132px;height:auto;"></td>
            <td align="right" valign="middle" style="color:${KICKER};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">${esc(
              c.kicker,
            )}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 34px;"><div style="border-top:1px solid #ededed;font-size:0;line-height:0;">&nbsp;</div></td></tr>
        <tr><td style="padding:24px 34px 6px;">
          <h1 style="margin:0 0 16px;color:${INK};font-size:19px;font-weight:700;line-height:1.35;">${esc(
            c.heading,
          )}</h1>
          <p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.65;">${esc(c.greeting)}</p>
          ${paras}
          ${cta}
          ${summaryTable}
          <p style="margin:22px 0 2px;color:#374151;font-size:14px;line-height:1.6;">Met vriendelijke groet,</p>
          <p style="margin:0;color:${INK};font-size:14px;font-weight:700;">Team Q4S</p>
          ${
            c.attachmentNote
              ? `<p style="margin:20px 0 0;padding-top:14px;border-top:1px solid #f1f1f1;color:#9ca3af;font-size:12px;line-height:1.5;">${esc(
                  c.attachmentNote,
                )}</p>`
              : ""
          }
        </td></tr>
        <tr><td style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="background:#fafafa;border-top:1px solid #eeeeee;padding:18px 34px;">
          <p style="margin:0 0 3px;color:${INK};font-size:12px;font-weight:700;">${footerHead}</p>
          ${footerRest ? `<p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.7;">${footerRest}</p>` : ""}
        </td></tr>
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
