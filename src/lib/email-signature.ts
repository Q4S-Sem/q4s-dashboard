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

const INK = "#1c1c1e";
const MUTED = "#6b7280";
const LINK = "#1d4ed8";
const LINE = "#e5e7eb";

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Kleine inline SVG-icoontjes (telefoon/mail/web/pin) als data-URI, zodat ze
 *  altijd meekomen zonder externe hosting. */
function icon(path: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const ICON = {
  phone: icon(
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  ),
  mail: icon(
    '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  ),
  web: icon(
    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  ),
  pin: icon(
    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  ),
};

/** Eén contactregel: icoon + (evt. gelinkte) waarde. */
function contactRow(iconSrc: string, inner: string): string {
  return `<tr><td style="padding:2px 8px 2px 0;vertical-align:middle;"><img src="${iconSrc}" width="14" height="14" alt="" style="display:block;border:0;"></td><td style="padding:2px 0;vertical-align:middle;color:${INK};font-size:13px;line-height:1.5;">${inner}</td></tr>`;
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
        <td style="padding:2px 8px 2px 0;vertical-align:top;"><img src="${ICON.pin}" width="14" height="14" alt="" style="display:block;border:0;margin-top:2px;"></td>
        <td style="padding:0;color:${INK};font-size:13px;line-height:1.6;">${addressLines.map(esc).join("<br>")}</td>
      </tr></table>`
    : "";

  const badges = d.badges.filter(Boolean);
  const badgeImgs = badges
    .map(
      (src) =>
        `<img src="${esc(src)}" alt="Keurmerk" height="42" style="display:inline-block;border:0;height:42px;width:auto;margin-right:18px;vertical-align:middle;">`,
    )
    .join("");

  const kvkCell = d.kvk
    ? `<td style="padding:0 0 0 18px;border-left:1px solid ${LINE};color:${MUTED};font-size:12px;vertical-align:middle;">KvK ${esc(d.kvk)}</td>`
    : "";

  const badgeRow =
    badges.length || d.kvk
      ? `<tr><td style="padding:14px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            ${badgeImgs ? `<td style="vertical-align:middle;">${badgeImgs}</td>` : ""}
            ${kvkCell}
          </tr></table>
        </td></tr>`
      : "";

  const disclaimer = d.disclaimer
    ? `<tr><td style="padding:14px 0 0;color:#9ca3af;font-size:11px;line-height:1.6;">${esc(d.disclaimer)}</td></tr>`
    : "";

  const logoCell = d.logoSrc
    ? `<td style="padding:0 22px 0 0;vertical-align:middle;border-right:1px solid ${LINE};"><img src="${esc(
        d.logoSrc,
      )}" alt="Q4S Project Partners" width="120" style="display:block;border:0;width:120px;height:auto;"></td>`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <tr><td style="padding:0 0 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        ${logoCell}
        <td style="padding:0 0 0 ${d.logoSrc ? "22px" : "0"};vertical-align:middle;">
          <div style="color:${INK};font-size:16px;font-weight:700;line-height:1.3;">${esc(d.name) || "&nbsp;"}</div>
          ${d.role ? `<div style="color:${MUTED};font-size:13px;line-height:1.4;padding-bottom:6px;">${esc(d.role)}</div>` : ""}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">${contactRows.join("")}</table>
        </td>
        ${addressBlock ? `<td style="padding:0 0 0 34px;vertical-align:middle;">${addressBlock}</td>` : ""}
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

/** Bouw de SignatureData uit de opgeslagen bedrijfsinstellingen. */
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
  },
  logoSrc: string,
): SignatureData {
  let badges: string[] = [];
  try {
    const parsed = JSON.parse(s.emailSigBadgesJson || "[]");
    if (Array.isArray(parsed)) badges = parsed.filter((x) => typeof x === "string");
  } catch {
    badges = [];
  }
  return {
    name: s.emailSigName?.trim() || "",
    role: s.emailSigRole?.trim() || "",
    phone: s.emailSigPhone?.trim() || s.phone?.trim() || "",
    email: s.emailSigEmail?.trim() || s.email?.trim() || "",
    website: s.emailSigWebsite?.trim() || s.website?.trim() || "www.q4s.nl",
    addressLines: (s.emailSigAddress || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    badges,
    kvk: s.kvkNumber?.trim() || "",
    disclaimer: s.emailSigDisclaimer?.trim() || "",
    logoSrc,
  };
}

/** De standaard-disclaimer (Nederlands), zoals in het voorbeeld. */
export const DEFAULT_SIG_DISCLAIMER =
  "Deze e-mail en eventuele bijlagen zijn uitsluitend bedoeld voor de geadresseerde en kunnen vertrouwelijke informatie bevatten. Als u niet de beoogde ontvanger bent, verzoeken wij u vriendelijk de afzender te informeren en deze e-mail te verwijderen. Het is niet toegestaan om de inhoud van deze e-mail te gebruiken, te verspreiden of te kopiëren zonder voorafgaande schriftelijke toestemming.";
