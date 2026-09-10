// ---------------------------------------------------------------------------
// Q4S e-mailhandtekening (footer) — één centrale bron.
//
// Bouwt de handtekening zoals het voorbeeld: logo links, dan naam + functie +
// telefoon/e-mail/website, een adresblok, een scheidslijn, keurmerk-logo's met
// KvK, en tot slot de vertrouwelijkheids-disclaimer. Alles met inline styles en
// een table-layout, want dat is het enige dat betrouwbaar rendert in Outlook,
// Gmail en Apple Mail.
//
// Dezelfde functie voedt het live voorbeeld op de instellingenpagina, de
// "kopieer naar Outlook"-knop én (optioneel) de footer onder dashboard-mails,
// zodat alles er identiek uitziet.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

export type SignatureData = {
  name: string;
  role: string;
  phone: string;
  email: string;
  website: string;
  /** Adresregels (elke regel apart). */
  addressLines: string[];
  /** Directe https-URL's naar keurmerk-logo's (DNV, VCU, SNA…). */
  badges: string[];
  kvk: string;
  disclaimer: string;
  /** Bron van het Q4S-logo (https-URL of data-URI). Leeg = geen logo. */
  logoSrc: string;
};

const INK = "#1a2b4a";
const MUTED = "#5b6b82";
const LINK = "#1a3d7c";
const LINE = "#d4d4d4";

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** De contact-icoontjes (telefoon/mail/web/pin) als PNG-data-URI. PNG omdat
 *  Outlook/Gmail SVG in mails niet betrouwbaar tonen (dan zie je lege vierkantjes).
 *  De bestanden staan in public/email/icons; ontbreekt er een, dan valt de regel
 *  terug op geen icoon. */
function iconPng(name: string): string {
  try {
    const b = fs.readFileSync(path.join(process.cwd(), "public", "email", "icons", `${name}.png`));
    return `data:image/png;base64,${b.toString("base64")}`;
  } catch {
    return "";
  }
}

const ICON = {
  phone: iconPng("phone"),
  mail: iconPng("mail"),
  web: iconPng("web"),
  pin: iconPng("pin"),
};

/** Eén contactregel: icoon + (evt. gelinkte) waarde. */
function contactRow(iconSrc: string, inner: string): string {
  return `<tr><td style="padding:1px 7px 1px 0;vertical-align:middle;"><img src="${iconSrc}" width="12" height="12" alt="" style="display:block;border:0;"></td><td style="padding:1px 0;vertical-align:middle;color:${INK};font-size:12px;line-height:1.45;">${inner}</td></tr>`;
}

/**
 * De volledige handtekening als HTML-fragment (zonder <html>/<body>), klaar om
 * in een mail te plakken of in een preview te tonen.
 */
export function renderSignatureHtml(d: SignatureData): string {
  const contactRows: string[] = [];
  if (d.phone) contactRows.push(contactRow(ICON.phone, esc(d.phone)));
  if (d.email)
    contactRows.push(
      contactRow(
        ICON.mail,
        `<a href="mailto:${esc(d.email)}" style="color:${LINK};text-decoration:none;">${esc(d.email)}</a>`,
      ),
    );
  if (d.website) {
    const url = d.website.startsWith("http") ? d.website : `https://${d.website}`;
    contactRows.push(
      contactRow(
        ICON.web,
        `<a href="${esc(url)}" style="color:${LINK};text-decoration:underline;">${esc(d.website)}</a>`,
      ),
    );
  }

  const addressLines = d.addressLines.filter(Boolean);
  const addressBlock = addressLines.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding:1px 7px 1px 0;vertical-align:top;"><img src="${ICON.pin}" width="12" height="12" alt="" style="display:block;border:0;margin-top:2px;"></td>
        <td style="padding:0;color:${INK};font-size:12px;line-height:1.55;">${addressLines.map(esc).join("<br>")}</td>
      </tr></table>`
    : "";

  const badges = d.badges.filter(Boolean);
  const badgeImgs = badges
    .map(
      (src) =>
        `<img src="${esc(src)}" alt="Keurmerk" height="30" style="display:inline-block;border:0;height:30px;width:auto;margin-right:14px;vertical-align:middle;">`,
    )
    .join("");

  const kvkCell = d.kvk
    ? `<td style="padding:0 0 0 14px;border-left:1px solid ${LINE};color:${MUTED};font-size:11px;vertical-align:middle;">KvK ${esc(d.kvk)}</td>`
    : "";

  const badgeRow =
    badges.length || d.kvk
      ? `<tr><td style="padding:11px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            ${badgeImgs ? `<td style="vertical-align:middle;">${badgeImgs}</td>` : ""}
            ${kvkCell}
          </tr></table>
        </td></tr>`
      : "";

  const disclaimer = d.disclaimer
    ? `<tr><td style="padding:11px 0 0;"><div style="width:520px;max-width:520px;color:#9ca3af;font-size:10px;line-height:1.55;">${esc(d.disclaimer)}</div></td></tr>`
    : "";

  const logoCell = d.logoSrc
    ? `<td style="padding:0 18px 0 0;vertical-align:middle;border-right:1px solid ${LINE};"><img src="${esc(
        d.logoSrc,
      )}" alt="Q4S Project Partners" width="96" style="display:block;border:0;width:96px;height:auto;"></td>`
    : "";

  const addressCell = addressBlock
    ? `<td style="padding:0 0 0 22px;border-left:1px solid ${LINE};vertical-align:top;">${addressBlock}</td>`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <tr><td style="padding:0 0 10px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        ${logoCell}
        <td style="padding:0 0 0 ${d.logoSrc ? "18px" : "0"};vertical-align:middle;">
          <div style="color:${INK};font-size:15px;font-weight:700;line-height:1.25;">${esc(d.name) || "&nbsp;"}</div>
          ${d.role ? `<div style="color:${MUTED};font-size:12px;line-height:1.35;padding-bottom:6px;">${esc(d.role)}</div>` : ""}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:top;padding:0 32px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">${contactRows.join("")}</table>
            </td>
            ${addressCell}
          </tr></table>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="border-top:1px solid ${LINE};font-size:0;line-height:0;">&nbsp;</td></tr>
    ${badgeRow}
    ${disclaimer}
  </table>`;
}

/** Volledig HTML-document (voor het kopiëren/preview via een iframe srcDoc). */
export function renderSignatureDocument(d: SignatureData): string {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head><body style="margin:0;padding:20px;background:#ffffff;">${renderSignatureHtml(
    d,
  )}</body></html>`;
}

/** Plain-text variant, voor de tekstversie van dashboard-mails. */
export function renderSignatureText(d: SignatureData): string {
  return [
    d.name,
    d.role,
    d.phone,
    d.email,
    d.website,
    ...d.addressLines,
    d.kvk ? `KvK ${d.kvk}` : "",
    "",
    d.disclaimer,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Bouw de SignatureData uit de bedrijfsinstellingen én — indien meegegeven —
 *  het ingelogde account. Naam/functie/telefoon/e-mail horen bij de PERSOON
 *  (elk account zijn eigen handtekening); adres, website, keurmerken, KvK en
 *  disclaimer zijn bedrijfsbreed. De company-brede emailSig*-velden blijven een
 *  terugval voor accounts die (nog) niets ingevuld hebben. */
export function signatureFromSettings(
  s: {
    emailSigName?: string;
    emailSigRole?: string;
    emailSigPhone?: string;
    emailSigEmail?: string;
    emailSigWebsite?: string;
    emailSigAddress?: string;
    emailSigBadgesJson?: string;
    emailSigDisclaimer?: string;
    kvkNumber?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  },
  logoSrc: string,
  user?: {
    name?: string | null;
    jobTitle?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null,
): SignatureData {
  let badges: string[] = [];
  try {
    const parsed = JSON.parse(s.emailSigBadgesJson || "[]");
    if (Array.isArray(parsed)) badges = parsed.filter((x) => typeof x === "string");
  } catch {
    badges = [];
  }
  // Adres: expliciete handtekening-tekst wint; anders opgebouwd uit het echte
  // bedrijfsadres (Instellingen). Zo verzinnen we nooit een adres.
  const companyAddress = [
    s.address?.trim(),
    [s.postalCode?.trim(), s.city?.trim()].filter(Boolean).join("  "),
    s.country?.trim(),
  ]
    .filter(Boolean)
    .join("\n");
  const address = (s.emailSigAddress || "").trim() || companyAddress;
  return {
    // Persoonlijk (account) → anders de bedrijfsbrede terugval.
    name: user?.name?.trim() || s.emailSigName?.trim() || "",
    role: user?.jobTitle?.trim() || s.emailSigRole?.trim() || "",
    phone: user?.phone?.trim() || s.emailSigPhone?.trim() || s.phone?.trim() || "",
    email: user?.email?.trim() || s.emailSigEmail?.trim() || s.email?.trim() || "",
    // Bedrijfsbreed.
    website: s.emailSigWebsite?.trim() || s.website?.trim() || "www.q4s.nl",
    addressLines: address.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    badges,
    kvk: s.kvkNumber?.trim() || "",
    disclaimer: s.emailSigDisclaimer?.trim() || DEFAULT_SIG_DISCLAIMER,
    logoSrc,
  };
}

/** De standaard-disclaimer (Nederlands), zoals in het voorbeeld. */
export const DEFAULT_SIG_DISCLAIMER =
  "Deze e-mail en eventuele bijlagen zijn uitsluitend bedoeld voor de geadresseerde en kunnen vertrouwelijke informatie bevatten. Als u niet de beoogde ontvanger bent, verzoeken wij u vriendelijk de afzender te informeren en deze e-mail te verwijderen. Het is niet toegestaan om de inhoud van deze e-mail te gebruiken, te verspreiden of te kopiëren zonder voorafgaande schriftelijke toestemming.";
