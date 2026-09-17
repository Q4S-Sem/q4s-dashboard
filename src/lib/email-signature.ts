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
  phone: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAACXBIWXMAAAsTAAALEwEAmpwYAAABS0lEQVRYhe2XvUoDQRRGT2xs1MLgGyjiE/iXJ1ERLaxCtAxYBfIMgrgJiCA+hIiksPARUthoHRDBKkhk4C4MwyQTZPfOIHvgNsv+HO7e+XYWKiqKZwE4AtqeagErKGNkJjMq0xa6DAi9agu1AkJv2kLHAaEvoKYp1AgITYBNTaG1OYTOUOYjIHStLXQXELpIabAzCU9VTBp/e2T6MWRyHlLojM2uJfMDbJEAT5bUQDsQfexId3KpExIgs4RGwEZsoboTlEM5FpUGMHbmaTG2VNOJgUGgUyYizoEr4BRYL0Oq60gNp8yUkel5gvVTrnmR7+FSGVIjWX01S8ZeCLPKdLCw1zd2bv4s4TmvjKkOBbIPvDsPsDNLXciwCtz8QaQ0oZxt4DElIVvsfsrWJYpQzjJwCNx65swuc04U6sCe7ESb8lt+kMLuoeL/8Qseod+zZTiIbAAAAABJRU5ErkJggg==",
  mail: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAACXBIWXMAAAsTAAALEwEAmpwYAAABOElEQVRYhe2XIUsEQRSAPxUOVAwWERGbySIIdpvFaLWb/As2z3jRevHq1Wsmk9UiGFwFgweXRNSRhbeij5ndub259cL74JWdN/M+Hm/YXTAMo1lawCXwBLgpRwa0pWaQdgMiTkVeM0gTnXEqnsuEdHIPWCMdq8AV8KXqRAs54BU4A+YnEJkDToCXQI2xhJzENbBTQ2YbGFScHSV0BDyoZ+9AB1iOEFkEzoE3z+06riOUsyS34EOt3QOHJeccAHdqz6fMz0qgVpRQwS5w42l1H9j8yYJ1oOvJuwX2+ctEQjkLMtwjlTcETiWGam0ke/K9pBYq2Ah0wde9LcIkEyrwDf3voa0iuZAeej20/yJUsCcxDlMVqoMJVWEdqsI6lKRDWcQrwSWOx1n7yL8oE2qJVDYrv0GGYZCYbxbSa6o7utxEAAAAAElFTkSuQmCC",
  web: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAACXBIWXMAAAsTAAALEwEAmpwYAAACfUlEQVRYhe2XT2+MURTGf+1sOmz8XdKdBeMLoOz9iT9TtkR9A9WwqAVphJa0JVgJK20qURtEojakbBpfYaSY+gRK25GbnFee3Ny57/vOjE4TfZKbzHuec848c+95zz0D6/gPUAAOAreBWWAB+GVrwWwjQI/5/jMUgcvAD6CWcTmBAxbbUpwB5nMI8dcXoLcVQjqBG4Ev+A4sy/NbW8nzsvlozAowZDkbFjPpJf0KnAWOi+03UAL22ufE7nzOAd+8HBONivJ3xonbbNw7sY9LzD2xz5htCzDl5XI7lbtmNMF9oMO4knc0OyWu2zvK3WZ3sQ+84ytnFVP0CnhSxDhcFe5VIP618INi7/B2yhV6VxZBVyRo3rZc8Vn40JtzWvg5j9sEVIR3LSGKQs4+U2tyVdOa56FVFFOzdSAm6E4bBA3HBH0Ux8MBflz4i5E8/eI3FuCPCv8hJkjrZ0eAfyJ8XyRPn/g9DvDdXh3VxaI4hl7JF8KfiOQ5JX7TAX6D8D+zCgrd0NPCn4zkKYvf8wC/MaugNXdks+J4JMCPCe8Ktx4uid9ogD8m/PuYoJE2vPY3Y4J62iBoX0xQwcbO1RJTzTIbDaRcrnMpl2uv8J88bpsNeVma618UbTRIgqa88WMwZfx4KbybHBJ0em2jknX8SH6lG6KS4IeytXsiA5prFUvC7xIxj8S+ktLHgnBjpp73M2CrcTNiv1vnrntjtu3ezrh1La+Y5FdNeIncwH6+zpBf8oZ812suWOFqjqfN/vMY8o4vy9+gpYAQl+N6M2IUZa/Q865KIzWThi67Eqo5+0x/nrepEXTa2Dlsw1XVpoRF++xst4D9rTqedaxp/AH9b/DjbryQEgAAAABJRU5ErkJggg==",
  pin: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAACXBIWXMAAAsTAAALEwEAmpwYAAABhUlEQVRYhe2XsUrDUBSGPwRFbC2oo0MrPoDgQ5TgpC6C1FWp9gmc3PQBBAd9A0W7iG6KswpugtpFQQeLtAgOUZQLNxACuTfmnrRD+8GBkpzz34+Q3CbQp0fIAyvAEXAPfOpSvw+Biu7JnAFgHXgDfi31ClT1TCbkgZMEItE6BQrSMkPAVQqZoC6BQUmhPQeZoHalZGaAHwEhlTErIVS3LOQD17p8S++xq8wo8GVY4AIohvqL+lhcv8rKuQjNGcIfY8LV0/hkmPNchNYMwepcHFXD3KqL0KYhuGyYKxvmVGZqahlcoQ0XIc8Q3NA3fRR1Xz2kvLJWxoFvyw5cCvVP6WNx/SprDEfOLXuLWuQGuLXIqzpDgIrALh3UsoRQDmgLyLRdN8UwOwJC2wgyAbQcZFo6Q5QtByE1K04BeEkh8xyzX4mwmEJonoyp//N9OnMmgWYCmabu7QgLCYSW6DAHBpl9usCw/g+LytwBI3SJEvAekvkApukynv7a8F3flyWp6erTe/wB53t8pe+HF8wAAAAASUVORK5CYII=",
};

/** Eén contactregel: icoon + (evt. gelinkte) waarde. */
function contactRow(iconSrc: string, inner: string): string {
  const icon = iconSrc
    ? `<img src="${iconSrc}" width="14" height="14" alt="" style="display:block;border:0;">`
    : "";
  return `<tr><td style="padding:3px 9px 3px 0;vertical-align:top;width:14px;line-height:1;">${icon}</td><td style="padding:3px 0;vertical-align:top;color:${INK};font-size:13px;line-height:1.5;word-break:break-word;">${inner}</td></tr>`;
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
  const COL_W = 180;
  const contactCell = contactRows.length
    ? `<td style="width:${COL_W}px;padding:0 20px 0 0;vertical-align:top;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">${contactRows.join("")}</table>
      </td>`
    : `<td style="width:${COL_W}px;padding:0;"></td>`;
  const addressCell = addressRow
    ? `<td style="padding:0 20px;border-left:2px solid ${LINE};vertical-align:top;">
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
        `<img src="${esc(src)}" alt="Keurmerk" height="30" style="display:inline-block;border:0;height:30px;width:auto;margin:0 14px 8px 0;vertical-align:middle;">`,
    )
    .join("");

  const kvkCell = d.kvk
    ? `<td style="padding:0 0 0 20px;border-left:2px solid ${LINE};color:${MUTED};font-size:12px;line-height:1.5;vertical-align:middle;white-space:nowrap;">KvK ${esc(d.kvk)}</td>`
    : "";

  const badgeRow =
    badges.length || d.kvk
      ? `<tr><td style="padding:14px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="width:${COL_W}px;padding:0 20px 0 0;vertical-align:middle;">${badgeImgs}</td>
            ${kvkCell}
          </tr></table>
        </td></tr>`
      : "";

  const disclaimer = d.disclaimer
    ? `<tr><td style="padding:14px 0 0;"><div style="max-width:560px;color:#9ca3af;font-size:11px;line-height:1.55;">${esc(d.disclaimer)}</div></td></tr>`
    : "";

  const logoRow = d.logoSrc
    ? `<tr><td style="padding:0 0 14px;"><img src="${esc(
        d.logoSrc,
      )}" alt="Q4S Project Partners" width="90" style="display:block;border:0;width:90px;max-width:45%;height:auto;"></td></tr>`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:${INK};max-width:600px;width:100%;">
    <tr><td style="padding:0 0 22px;color:${INK};font-size:15px;line-height:1.5;">Met vriendelijke groet,</td></tr>
    ${logoRow}
    <tr><td style="padding:0;">
      <div style="color:${INK};font-size:17px;font-weight:700;line-height:1.25;">${esc(d.name) || "&nbsp;"}</div>
      ${d.role ? `<div style="color:${MUTED};font-size:13px;line-height:1.4;padding-top:2px;">${esc(d.role)}</div>` : ""}
    </td></tr>
    ${contactBlock}
    <tr><td style="padding:16px 0 0;"><div style="border-top:1px solid ${LINE};font-size:0;line-height:0;">&nbsp;</div></td></tr>
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
