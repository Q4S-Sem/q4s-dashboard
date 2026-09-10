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

/** Kleine inline SVG-icoontjes (telefoon/mail/web/pin) als data-URI — GEVULD en
 *  volledig zwart, precies zoals in het voorbeeld. Data-URI zodat ze altijd
 *  meekomen zonder externe hosting. */
function icon(path: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#000000">${path}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const ICON = {
  phone: icon(
    '<path d="M6.62 10.79a15.53 15.53 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.57 1 1 0 0 1-.25 1.02l-2.2 2.2z"/>',
  ),
  mail: icon(
    '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 4v10h16V8l-8 5-8-5zm.6-2 7.4 4.6L19.4 6H4.6z"/>',
  ),
  web: icon(
    '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14a7.96 7.96 0 0 1 0-4h3.38a16.6 16.6 0 0 0 0 4H4.26zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A8.03 8.03 0 0 1 5.07 16zm2.95-8H5.07a8.03 8.03 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.02 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82A13.4 13.4 0 0 1 12 19.96zM14.34 14H9.66a14.86 14.86 0 0 1 0-4h4.68a14.86 14.86 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.6 16.6 0 0 0 0-4h3.38a7.96 7.96 0 0 1 0 4h-3.38z"/>',
  ),
  pin: icon(
    '<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>',
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

  const addressCell = addressBlock
    ? `<td style="padding:0 0 0 22px;border-left:1px solid ${LINE};vertical-align:top;">${addressBlock}</td>`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <tr><td style="padding:0 0 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        ${logoCell}
        <td style="padding:0 0 0 ${d.logoSrc ? "22px" : "0"};vertical-align:middle;">
          <div style="color:${INK};font-size:17px;font-weight:700;line-height:1.3;">${esc(d.name) || "&nbsp;"}</div>
          ${d.role ? `<div style="color:${MUTED};font-size:13px;line-height:1.4;padding-bottom:8px;">${esc(d.role)}</div>` : ""}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:top;">
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
