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

/** De contact-icoontjes (telefoon/mail/web/pin) als inline PNG-data-URI.
 *  PNG omdat Outlook/Gmail SVG in mails niet betrouwbaar tonen.
 *
 *  Eerder werden deze via fs.readFileSync gelezen, maar Vercel's serverless
 *  file-tracer neemt public/-bestanden niet betrouwbaar mee in de bundle.
 *  Daarom staan ze nu als compile-time constanten: klein (~500-1000 bytes)
 *  en gegarandeerd beschikbaar in elke omgeving. */
const ICON = {
  phone: "data:image/png;base64,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",
  mail: "data:image/png;base64,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",
  web: "data:image/png;base64,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",
  pin: "data:image/png;base64,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",
};

/** Pixelmaat van een data-URI-afbeelding (PNG/JPEG). Word negeert CSS-maten bij
 *  plakken en valt dan terug op de ware grootte — daarom altijd width+height. */
export function afbeeldingMaat(src: string): { w: number; h: number } | null {
  const m = /^data:image\/(png|jpe?g);base64,(.*)$/i.exec(src);
  if (!m) return null;
  const b = Buffer.from(m[2], "base64");
  if (m[1].toLowerCase() === "png") return b.length > 24 ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/** <img> met vaste breedte óf hoogte; de andere maat volgt uit de verhouding. */
function vasteImg(src: string, alt: string, maat: { w: number } | { h: number }, style: string): string {
  const echt = afbeeldingMaat(src);
  const w = "w" in maat ? maat.w : echt ? Math.round((maat.h * echt.w) / echt.h) : undefined;
  const h = "h" in maat ? maat.h : echt ? Math.round((maat.w * echt.h) / echt.w) : undefined;
  const attrs = `${w ? ` width="${w}"` : ""}${h ? ` height="${h}"` : ""}`;
  const css = `${w ? `width:${w}px;` : ""}${h ? `height:${h}px;` : ""}`;
  return `<img src="${esc(src)}" alt="${alt}"${attrs} style="${css}border:0;${style}">`;
}

/** Eén contactregel: icoon + (evt. gelinkte) waarde. */
function contactRow(iconSrc: string, inner: string): string {
  const icon = iconSrc
    ? `<img src="${iconSrc}" width="14" height="14" alt="" style="display:block;border:0;">`
    : "";
  // <p style="margin:0"> + font-family per cel: Word geeft anders elke cel zijn
  // eigen alinea-witruimte en standaardlettertype (Aptos) bij het plakken.
  const F = "font-family:Arial,Helvetica,sans-serif;";
  return `<tr><td width="14" valign="top" style="${F}padding:3px 9px 3px 0;vertical-align:top;width:14px;line-height:1;"><p style="margin:0;">${icon}</p></td><td valign="top" style="${F}padding:3px 0;vertical-align:top;color:${INK};font-size:13px;line-height:1.5;word-break:break-word;"><p style="${F}margin:0;color:${INK};font-size:13px;line-height:1.5;">${inner}</p></td></tr>`;
}

/**
 * De volledige handtekening als HTML-fragment (zonder <html>/<body>), klaar om
 * in een mail te plakken of in een preview te tonen.
 *
 * Layout = één verticale kolom (logo bovenaan, dan naam/functie, dan
 * telefoon/e-mail/website/adres onder elkaar). Bewust GEEN naast-elkaar-kolommen:
 * die worden op smalle schermen (mobiel) tot onleesbaar toe samengeperst.
 */
export function renderSignatureHtml(d: SignatureData): string {
  const contactRows: string[] = [];
  if (d.phone)
    contactRows.push(
      contactRow(
        ICON.phone,
        `<a href="tel:${esc(d.phone.replace(/\s+/g, ""))}" style="color:${INK};text-decoration:none;white-space:nowrap;">${esc(d.phone)}</a>`,
      ),
    );
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
  const addressRow = addressLines.length
    ? contactRow(ICON.pin, `<span style="color:${INK};">${addressLines.map(esc).join("<br>")}</span>`)
    : "";

  // Twee kolommen met verticale scheidslijnen: links de contactgegevens
  // (tel/e-mail/website), rechts het adres. De linkerkolom krijgt een VASTE
  // breedte (COL_W) zodat de streep vóór het adres exact boven de streep vóór
  // KvK uitkomt — die gebruikt dezelfde breedte.
  const COL_W = 210; // ruimte voor 4 keurmerken (DNV, VCU, SNA, NEN 4400-1)
  const contactCell = contactRows.length
    ? `<td width="${COL_W}" valign="top" style="width:${COL_W}px;padding:0 20px 0 0;vertical-align:top;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">${contactRows.join("")}</table>
      </td>`
    : `<td width="${COL_W}" style="width:${COL_W}px;padding:0;"></td>`;
  const addressCell = addressRow
    ? `<td valign="top" style="padding:0 20px;border-left:2px solid ${LINE};vertical-align:top;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">${addressRow}</table>
      </td>`
    : "";

  const contactBlock =
    contactRows.length || addressRow
      ? `<tr><td style="padding:12px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${contactCell}${addressCell}</tr></table>
        </td></tr>`
      : "";

  const badges = d.badges.filter(Boolean);
  const badgeImgs = badges
    .map(
      (src) =>
        vasteImg(src, "Keurmerk", { h: 28 }, "display:inline-block;margin:0 4px 4px 0;vertical-align:middle;"),
    )
    // &nbsp; ertussen: Word negeert de marge bij plakken.
    .join("&nbsp;");

  const kvkCell = d.kvk
    ? `<td style="padding:0 0 0 20px;border-left:2px solid ${LINE};color:${MUTED};font-size:12px;line-height:1.5;vertical-align:middle;white-space:nowrap;">KvK ${esc(d.kvk)}</td>`
    : "";

  const badgeRow =
    badges.length || d.kvk
      ? `<tr><td style="padding:14px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="${COL_W}" valign="middle" style="width:${COL_W}px;padding:0 20px 0 0;vertical-align:middle;">${badgeImgs}</td>
            ${kvkCell}
          </tr></table>
        </td></tr>`
      : "";

  const disclaimer = d.disclaimer
    ? `<tr><td style="padding:14px 0 0;"><div style="max-width:560px;color:#9ca3af;font-size:11px;line-height:1.55;">${esc(d.disclaimer)}</div></td></tr>`
    : "";

  const logoRow = d.logoSrc
    ? `<tr><td style="padding:0 0 14px;">${vasteImg(d.logoSrc, "Q4S Project Partners", { w: 90 }, "display:block;")}</td></tr>`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:${INK};max-width:600px;width:100%;">
    <tr><td style="padding:0 0 22px;color:${INK};font-size:15px;line-height:1.5;">Met vriendelijke groet,</td></tr>
    ${logoRow}
    <tr><td style="padding:0;">
      <div style="color:${INK};font-size:17px;font-weight:700;line-height:1.25;">${esc(d.name) || "&nbsp;"}</div>
      ${d.role ? `<div style="color:${MUTED};font-size:13px;line-height:1.4;padding-top:2px;">${esc(d.role)}</div>` : ""}
    </td></tr>
    ${contactBlock}
    <tr><td style="padding:16px 0 0;font-size:1px;line-height:1px;">&nbsp;</td></tr>
    <tr><td style="border-top:1px solid ${LINE};font-size:1px;line-height:1px;">&nbsp;</td></tr>
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
    "Met vriendelijke groet,",
    "",
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
