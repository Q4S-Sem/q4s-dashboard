import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getLogoFile } from "./branding";
import { loadCvFonts } from "./cv-fonts";
import { sanitizePdfText, truncateText, wrapText } from "./pdf-text";
import type { CvDoc } from "./cv-doc";

/**
 * Het Q4S-CV als PDF: het document dat naar de opdrachtgever gaat.
 *
 * Zelfde contract als de andere renderers in dit project: puur `doc → bytes`, geen
 * database, geen anonimiseer-logica (die is al in cv-doc.ts gebeurd). Wat hier
 * binnenkomt is klaar om af te drukken.
 *
 * DE VIER BESLISSINGEN DIE DE REST VERKLAREN
 *
 * 1. KOPBALK MET LOGO OP EEN WIT VLAK. Het Q4S-logo is een zwart blok op wit; op
 *    een donkere balk verdwijnt het en op een witte pagina is het net een postzegel.
 *    Op een wit vlak ín een zwarte balk is het meteen het merk van de afzender —
 *    en de witruimte die al in het logobestand zit, valt weg tegen dat vlak.
 *
 * 2. VOLGORDE VOLGT DE BESLISBOOM VAN DE OPDRACHTGEVER, niet de CV-conventie. Hij
 *    stelt eerst een binaire vraag ("mag deze man überhaupt op mijn werk?" →
 *    certificaten) en pas daarna een graduele ("hoe goed is hij?" → ervaring).
 *    Certificaten staan daarom vóór werkervaring: een diskwalificerend criterium op
 *    pagina 2 kost een plaatsing van iemand die wél kwalificeert.
 *
 * 3. DE FUNCTIETITEL IS GROTER DAN DE NAAM. Op een geanonimiseerd bureau-CV is
 *    "Michał W." het mínst informatieve veld op de pagina: de klant zoekt een 6G
 *    TIG-lasser, geen persoon. De naam staat er wel vol en leesbaar boven — hij is
 *    het opschrift, niet de kop.
 *
 * 4. DE PAGINA WORDT ACTIEF GEVULD. Twee meetronden vooraf (zie onderaan) bepalen
 *    of het ritme aangehaald moet worden om een pagina te winnen, of juist opgerekt
 *    om te voorkomen dat een mager CV als een half formulier oogt.
 */

// A4, gelijk aan de andere PDF's in dit project.
const W = 595.28;
const H = 841.89;
const M = 52;
const RIGHT = W - M;
const CONTENT_W = RIGHT - M;

// Alleen zwart/wit/grijs: het logo is zwart-wit, elke steunkleur vecht ermee.
const INK = rgb(23 / 255, 23 / 255, 23 / 255);

/** #rrggbb → pdf-lib-kleur; valt terug op bijna-zwart bij onzin. */
function hexRgb(hex: string) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return INK;
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}
const MUTED = rgb(0.44, 0.44, 0.45);
const SOFT = rgb(0.6, 0.6, 0.62);
const LINE = rgb(0.85, 0.85, 0.86);
const CHIP_BG = rgb(0.937, 0.937, 0.941);
const ON_BAND = rgb(1, 1, 1);
const ON_BAND_SOFT = rgb(0.74, 0.74, 0.75);

// Kopbalk: ~12,5% van de paginahoogte. Krap om het witte logovlak (80pt) heen —
// genoeg voor een fors logo, weinig genoeg dat een printer er niet op leegloopt en
// dat er onder de balk een volle pagina overblijft.
const BAND_H = 106;
const BAND2_H = 38;

/**
 * Logohoogte. De wordmark "PROJECT PARTNERS" is maar ~8% van de logohoogte en
 * wordt onder ~55pt onleesbaar — dat is de eis. Let op: het JPG-bestand heeft ~12%
 * witruimte ingebakken, dus de zwarte inkt is maar ~88% van de tekenhoogte. 64 x
 * 0,88 ≈ 56pt echte inkt: net boven de leesgrens. Meten met LOGO_H alleen is dus
 * misleidend; vandaar dit getal en niet 58.
 */
const LOGO_H = 64;
const BADGE_PAD = 8;

// Ondergrens voor content; laat lucht boven de voetlijn (die ligt op M-5).
const BOTTOM = M + 8;

// Eén ritme voor het hele document (zie `gap()`).
const SECTION_GAP = 20;
const TITLE_GAP = 21;
const ITEM_GAP = 9;

// Rechterkolom voor certificaat-geldigheid. `year` is vrije tekst ("geldig t/m
// 2027"), dus ruimer dan een jaartal nodig heeft.
const YEAR_W = 108;

const TYPE = {
  headline: 20,
  name: 11,
  bandMeta: 8.75,
  meta: 8.75,
  lead: 10.25,
  section: 11,
  role: 10.5,
  sub: 9,
  period: 8.5,
  bullet: 9.25,
  cert: 10,
  small: 8.5,
  chip: 8.75,
  foot: 7.5,
};

type Pass = {
  /** Meetronde: alles rekenen, niets tekenen (zie de opvul-logica onderaan). */
  dry: boolean;
  /** Extra lucht per sectie-overgang, om een kort CV de pagina te laten vullen. */
  gapExtra: number;
  /** <1 = ritme aanhalen om een pagina te winnen (zie de zoekronde onderaan). */
  density: number;
};

type LayoutResult = { pageCount: number; endY: number; gapUnits: number };

export async function renderCvPdf(
  doc: CvDoc,
  /** Accentkleur uit de CV-vormgeving; standaard het Q4S-oranje. */
  accentHex = "#e8430a",
): Promise<Uint8Array> {
  const BRAND = hexRgb(accentHex);
  const pdf = await PDFDocument.create();
  const fonts = await loadCvFonts(pdf);
  const uni = fonts.embedded;

  pdf.setTitle(`CV ${doc.displayName}`);
  pdf.setAuthor(doc.companyName);
  pdf.setCreator(doc.companyName);
  pdf.setSubject(doc.headline || "CV");

  const logoImg = await embedLogo(pdf);

  const pages: PDFPage[] = [];
  let page: PDFPage | null = null;
  let pageCount = 0;
  let y = 0;
  let gapUnits = 0;
  let pass: Pass = { dry: true, gapExtra: 0, density: 1 };

  // Effectieve maten: alle verticale lucht loopt hierlangs, zodat de dichtheid op
  // één plek te sturen is. De ondergrenzen zijn hard — daaronder plakt de sectiekop
  // weer aan zijn inhoud, en dan is het compressie i.p.v. ritme.
  const itemGap = () => Math.max(5.5, ITEM_GAP * pass.density);
  // 18,5 is geen smaak: onder die waarde raakt de 11pt-kop zijn eerste 10pt-regel
  // en leest de sectietitel als onderdeel van het item eronder.
  const titleGap = () => Math.max(18.5, TITLE_GAP * pass.density);
  const leadLead = () => Math.max(13.2, 15 * pass.density);
  const bulletLead = () => Math.max(11.8, 12.6 * pass.density);

  // ---- teken-helpers (no-op in de meetronde) --------------------------------

  const text = (
    s: string,
    x: number,
    yy: number,
    size: number,
    f: PDFFont = fonts.regular,
    color = INK,
  ) => {
    if (pass.dry || !page) return;
    const t = sanitizePdfText(s, uni);
    if (!t) return;
    page.drawText(t, { x, y: yy, size, font: f, color });
  };

  const textR = (
    s: string,
    xRight: number,
    yy: number,
    size: number,
    f: PDFFont = fonts.regular,
    color = INK,
  ) => {
    if (pass.dry || !page) return;
    const t = sanitizePdfText(s, uni);
    if (!t) return;
    page.drawText(t, { x: xRight - f.widthOfTextAtSize(t, size), y: yy, size, font: f, color });
  };

  /**
   * Kapitalen met letterspatiëring. pdf-lib kent geen tracking, dus teken per
   * teken. Alleen voor korte labels: daar is het het verschil tussen een
   * schreeuwerig blok hoofdletters en een rustig kopje.
   */
  const textTracked = (
    s: string,
    x: number,
    yy: number,
    size: number,
    f: PDFFont,
    color: ReturnType<typeof rgb>,
    tracking: number,
  ) => {
    if (pass.dry || !page) return;
    const t = sanitizePdfText(s, uni);
    let cx = x;
    for (const ch of t) {
      page.drawText(ch, { x: cx, y: yy, size, font: f, color });
      cx += f.widthOfTextAtSize(ch, size) + tracking;
    }
  };

  const trackedWidth = (s: string, size: number, f: PDFFont, tracking: number) => {
    const t = sanitizePdfText(s, uni);
    return [...t].reduce((w, ch) => w + f.widthOfTextAtSize(ch, size) + tracking, 0) - tracking;
  };

  const line = (x1: number, yy: number, x2: number, thickness: number, color = LINE) => {
    if (pass.dry || !page) return;
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness, color });
  };

  const rect = (
    x: number,
    yy: number,
    w: number,
    h: number,
    color: ReturnType<typeof rgb>,
  ) => {
    if (pass.dry || !page) return;
    page.drawRectangle({ x, y: yy, width: w, height: h, color });
  };

  // ---- kopbalk --------------------------------------------------------------

  /**
   * Pagina 1: zwarte balk met het logo op een wit vlak, daarnaast wie er wordt
   * voorgedragen. Alles wat een opdrachtgever nodig heeft om te beslissen of hij
   * verder leest, staat zo boven de vouw.
   *
   * De contactgegevens staan bewust NIET hier maar in het blok onderaan: het label
   * "Contact via Q4S Project Partners" is zo breed dat de functietitel ernaast werd
   * afgekapt ("Allround lasser ·…") — en juist die titel is de match-sleutel.
   */
  const drawBand = () => {
    rect(0, H - BAND_H, W, BAND_H, BRAND);

    let textX = M;
    if (logoImg) {
      const logoW = (logoImg.width / logoImg.height) * LOGO_H;
      const badgeW = logoW + BADGE_PAD * 2;
      const badgeH = LOGO_H + BADGE_PAD * 2;
      const badgeY = H - BAND_H + (BAND_H - badgeH) / 2;
      rect(M, badgeY, badgeW, badgeH, ON_BAND);
      if (!pass.dry && page) {
        page.drawImage(logoImg, { x: M + BADGE_PAD, y: badgeY + BADGE_PAD, width: logoW, height: LOGO_H });
      }
      textX = M + badgeW + 22;
    } else {
      // Geen (of een SVG-)logo: pdf-lib kan alleen PNG/JPG → tekst-wordmark, zodat
      // er nooit een CV zonder afzender uitgaat.
      text(doc.companyName, M, H - 62, 16, fonts.bold, ON_BAND);
      textTracked("PROJECT PARTNERS", M, H - 78, 7.5, fonts.semibold, ON_BAND_SOFT, 2);
      textX = M;
    }

    // Naam / functietitel / meta, optisch gecentreerd in de balk.
    const textW = RIGHT - textX;
    const capName = TYPE.name * 0.73;
    const capHead = TYPE.headline * 0.73;
    const capMeta = TYPE.bandMeta * 0.73;
    const stackH = capName + 9 + capHead + 8 + capMeta;
    const stackTop = H - (BAND_H - stackH) / 2;

    const yName = stackTop - capName;
    text(truncateText(doc.displayName, fonts.semibold, TYPE.name, textW, uni), textX, yName, TYPE.name, fonts.semibold, ON_BAND_SOFT);
    const yHead = yName - 9 - capHead;
    if (doc.headline) {
      text(truncateText(doc.headline, fonts.bold, TYPE.headline, textW, uni), textX, yHead, TYPE.headline, fonts.bold, ON_BAND);
    }
    if (doc.metaLine) {
      text(
        truncateText(doc.metaLine, fonts.regular, TYPE.bandMeta, textW, uni),
        textX,
        yHead - 8 - capMeta,
        TYPE.bandMeta,
        fonts.regular,
        ON_BAND_SOFT,
      );
    }
  };

  /**
   * Vervolgpagina's: dezelfde balk, maar plat. Het logo past hier niet leesbaar in
   * (de wordmark zou ~3pt worden), dus een tekst-wordmark. De kandidaat moet er wél
   * op — raakt pagina 2 los op het bureau van de klant, dan is het anders niet meer
   * toe te wijzen.
   */
  const drawBand2 = () => {
    rect(0, H - BAND2_H, W, BAND2_H, BRAND);
    const baseline = H - BAND2_H + 14;
    textTracked(doc.companyName.toUpperCase(), M, baseline, 8, fonts.bold, ON_BAND, 1.1);
    const who = [doc.displayName, doc.headline].filter(Boolean).join("  ·  ");
    textR(
      truncateText(who, fonts.regular, TYPE.small, CONTENT_W - 200, uni),
      RIGHT,
      baseline,
      TYPE.small,
      fonts.regular,
      ON_BAND_SOFT,
    );
  };

  // ---- pagina-mechaniek -----------------------------------------------------

  const newPage = () => {
    pageCount += 1;
    if (!pass.dry) {
      page = pdf.addPage([W, H]);
      pages.push(page);
    }
    if (pageCount === 1) {
      drawBand();
      y = H - BAND_H - 30;
    } else {
      drawBand2();
      y = H - BAND2_H - 30;
    }
  };

  const ensure = (space: number) => {
    if (y - space < BOTTOM) newPage();
  };

  /** Sectie-overgang: één plek waar de lucht tussen blokken vandaan komt. */
  const gap = () => {
    gapUnits += 1;
    y -= SECTION_GAP * pass.density + pass.gapExtra;
  };

  /**
   * Sectiekop: een korte dikke streep bóven de titel i.p.v. een dun lijntje eronder
   * over de volle breedte. Het merkteken is zwaar en kort, de titel staat op de
   * marge — zo blijft alles op één linkerlijn (de blik loopt langs die marge naar
   * beneden) en heeft de kop tóch gewicht.
   *
   * `firstBlockH` = de hoogte van het eerste item eronder: een titel mag nooit als
   * wees onderaan een pagina achterblijven.
   */
  const sectionTitle = (title: string, firstBlockH: number) => {
    gap();
    const headH = 7 + TYPE.section + titleGap();
    if (y - (headH + firstBlockH) < BOTTOM) newPage();
    line(M, y + 7, M + 26, 2.2, BRAND);
    y -= TYPE.section;
    textTracked(title.toUpperCase(), M, y, TYPE.section, fonts.bold, BRAND, 0.9);
    y -= titleGap();
  };

  const paragraph = (
    s: string,
    size: number,
    color: ReturnType<typeof rgb>,
    leading: number,
    x = M,
    width = CONTENT_W,
    f: PDFFont = fonts.regular,
  ) => {
    for (const l of wrapText(s, f, size, width, uni)) {
      ensure(leading);
      text(l, x, y, size, f, color);
      y -= leading;
    }
  };

  // ---- secties --------------------------------------------------------------

  /**
   * Profielschets als lead-alinea zónder kop: hij hoort bij de kopbalk, niet in de
   * rij secties. Breedte ~430pt i.p.v. de volle 491: op 10,25pt is dat ~72 tekens
   * per regel, binnen het leesbare bereik (45–75). Volle breedte gaf ~86.
   *
   * NIET afkappen. Een eerdere versie hield hier 4 regels over en gooide de rest
   * weg — maar de recruiter heeft die tekst zelf in het review-scherm gezet; stil
   * verdwijnen is erger dan een langer CV. De meetronden vangen de lengte op.
   */
  const drawSummary = () => {
    if (!doc.summary) return;
    // Vaste afstand, GEEN gap(): de pitch hoort bij de kop. Zou hij meedelen in de
    // opvul-lucht, dan drijft hij op een kort CV los van de balk waar hij bij hoort.
    y -= 2;
    const width = 430;
    const lead = leadLead();
    const lines = wrapText(doc.summary, fonts.regular, TYPE.lead, width, uni);
    const blockH = lines.length * lead;
    // Dunne verticale streep links: markeert de alinea als citaat/pitch.
    rect(M, y - blockH + 11, 1.5, blockH - 3, LINE);
    for (const l of lines) {
      ensure(lead);
      text(l, M + 14, y, TYPE.lead, fonts.regular, INK);
      y -= lead;
    }
  };

  /**
   * Certificaten: het poort-filter, dus vol breedte en boven de vouw. Een smalle
   * zijkolom zou "NEN-EN-ISO 9606-1 135 P BW FM1 S t10 PB ss nb" over drie regels
   * breken — juist de string waar de klant op scant.
   */
  const drawCertificates = () => {
    if (!doc.certificates.length) return;
    const rowH = (c: (typeof doc.certificates)[number]) => (c.issuer ? 13 + 11 + itemGap() : 13 + itemGap());
    sectionTitle("Certificaten & kwalificaties", rowH(doc.certificates[0]));

    doc.certificates.forEach((c, i) => {
      ensure(rowH(c));
      if (i > 0) line(M, y + 12, RIGHT, 0.5);
      const nameW = c.year ? CONTENT_W - YEAR_W : CONTENT_W;
      text(truncateText(c.name || "—", fonts.semibold, TYPE.cert, nameW, uni), M, y, TYPE.cert, fonts.semibold, INK);
      // Geldigheid is geen bijschrift maar de kern: een verlopen certificaat is een
      // afwijzing. Daarom in INK/semibold, niet grijs weggemoffeld.
      if (c.year) textR(c.year, RIGHT, y, TYPE.period, fonts.semibold, INK);
      y -= 13;
      if (c.issuer) {
        text(truncateText(c.issuer, fonts.regular, TYPE.small, CONTENT_W, uni), M, y, TYPE.small, fonts.regular, MUTED);
        y -= 11;
      }
      y -= itemGap();
    });
    y += itemGap() - 2;
  };

  /** Vaktechnische skills: samen met de certificaten één kwalificatieblok. */
  const drawSkills = () => {
    if (!doc.skills.length) return;
    const chipH = 17;
    const gapX = 5;
    const gapY = 5;
    const padX = 7;
    // Inter cap-height ≈ 0,73em: zo staat de tekst optisch gecentreerd i.p.v. op een
    // magisch getal.
    const capOffset = (chipH - TYPE.chip * 0.73) / 2;

    sectionTitle("Vaktechnische skills", chipH);
    let x = M;
    ensure(chipH);
    for (const skill of doc.skills) {
      const label = truncateText(skill, fonts.semibold, TYPE.chip, CONTENT_W - padX * 2, uni);
      const w = fonts.semibold.widthOfTextAtSize(label, TYPE.chip) + padX * 2;
      if (x + w > RIGHT) {
        x = M;
        y -= chipH + gapY;
        ensure(chipH);
      }
      rect(x, y - capOffset, w, chipH, CHIP_BG);
      text(label, x + padX, y, TYPE.chip, fonts.semibold, INK);
      x += w + gapX;
    }
    y -= chipH - 4;
  };

  /**
   * Hoogte van een volledig functieblok. Nodig omdat een functie liever in z'n
   * geheel naar de volgende pagina verhuist dan dat kop + één bullet onderaan
   * achterblijven en de rest omslaat — dat leest als een afgekapt CV.
   */
  const jobHeight = (job: (typeof doc.experience)[number]) => {
    let h = 13;
    if ([job.employer, job.location].filter(Boolean).length) h += 13;
    for (const b of job.bullets) {
      h += wrapText(b, fonts.regular, TYPE.bullet, CONTENT_W - 14, uni).length * bulletLead();
    }
    return h;
  };

  const drawExperience = () => {
    if (!doc.experience.length) return;
    // Vervolgpagina's hebben zelf een balk (~68pt incl. lucht); zoveel past er hoogstens op.
    const pageAvail = H - BAND2_H - 30 - BOTTOM;
    /** Wat een functieblok minimaal nodig heeft vóórdat het mag breken. Past het blok
     *  sowieso nooit op één pagina (heel lange bullet-lijst), dan mág het breken —
     *  maar nooit vóór de eerste bullet. */
    const need = (job: (typeof doc.experience)[number]) => {
      const h = jobHeight(job);
      return h <= pageAvail ? h : 13 + 13 + 13;
    };

    sectionTitle("Werkervaring", need(doc.experience[0]));

    for (const job of doc.experience) {
      ensure(need(job));
      const periodW = job.period
        ? fonts.semibold.widthOfTextAtSize(sanitizePdfText(job.period, uni), TYPE.period) + 14
        : 0;
      text(
        truncateText(job.role || "—", fonts.bold, TYPE.role, CONTENT_W - periodW, uni),
        M,
        y,
        TYPE.role,
        fonts.bold,
        INK,
      );
      if (job.period) textR(job.period, RIGHT, y, TYPE.period, fonts.semibold, MUTED);
      y -= 13;

      const sub = [job.employer, job.location].filter(Boolean).join("  ·  ");
      if (sub) {
        text(truncateText(sub, fonts.regular, TYPE.sub, CONTENT_W, uni), M, y, TYPE.sub, fonts.regular, MUTED);
        y -= 13;
      }

      for (const bullet of job.bullets) {
        const lines = wrapText(bullet, fonts.regular, TYPE.bullet, CONTENT_W - 14, uni);
        const bl = bulletLead();
        ensure(bl * lines.length);
        lines.forEach((l, i) => {
          // Vierkant blokje i.p.v. een bullet-glyph: zelfde vormtaal als de streep
          // boven de sectiekoppen.
          if (i === 0) rect(M + 1, y + 2, 2.5, 2.5, SOFT);
          text(l, M + 14, y, TYPE.bullet, fonts.regular, INK);
          y -= bl;
        });
      }
      y -= itemGap();
    }
    y += itemGap();
  };

  const drawEducation = () => {
    if (!doc.education.length) return;
    sectionTitle("Opleiding", 13 + 11);
    for (const ed of doc.education) {
      ensure(13 + 11);
      const periodW = ed.period
        ? fonts.semibold.widthOfTextAtSize(sanitizePdfText(ed.period, uni), TYPE.period) + 14
        : 0;
      text(
        truncateText(ed.degree || ed.school || "—", fonts.semibold, 9.75, CONTENT_W - periodW, uni),
        M,
        y,
        9.75,
        fonts.semibold,
        INK,
      );
      if (ed.period) textR(ed.period, RIGHT, y, TYPE.period, fonts.semibold, MUTED);
      y -= 12;
      if (ed.degree && ed.school) {
        text(truncateText(ed.school, fonts.regular, TYPE.sub, CONTENT_W, uni), M, y, TYPE.sub, fonts.regular, MUTED);
        y -= 12;
      }
      y -= 4;
    }
    y -= itemGap() - 4;
  };

  /**
   * Talen: zelfde kop-contract als elke andere sectie (dikke streep + 11pt bold
   * caps), maar de waarden staan op DEZELFDE regel als de titel i.p.v. eronder.
   *
   * Waarom die uitzondering: als volwaardig blok kost deze sectie ~65pt voor één
   * regel tekst, en dat is precies genoeg om "Talen" plus het contactblok in hun
   * eentje naar pagina 2 te duwen. Een tweede pagina met drie woorden erop leest
   * als een fout. Talen zijn operationeel relevant (toolbox, veiligheidsinstructie),
   * maar geen selectiecriterium — dus die 25pt gaan naar de secties die het wél zijn.
   */
  const drawLanguages = () => {
    if (!doc.languages.length) return;
    const label = doc.languages
      .map((l) => (l.level ? `${l.name} (${l.level})` : l.name))
      .filter(Boolean)
      .join("   ·   ");
    if (!label) return;
    gap();
    ensure(20);
    line(M, y + 7, M + 26, 2.2, BRAND);
    y -= TYPE.section;
    textTracked("TALEN", M, y, TYPE.section, fonts.bold, BRAND, 0.9);
    text(label, M + 104, y, TYPE.sub + 0.5, fonts.regular, INK);
    // Cursor voorbij de regel zetten: anders tekent het blok hieronder er bovenop.
    y -= 13;
  };

  /**
   * Afsluitend contactblok: de enige call-to-action op het CV. Staat onderaan en
   * niet in de kopbalk, omdat het daar de functietitel wegdrukte — en omdat een
   * lezer die hier is aangekomen precies dán wil weten hoe hij deze man krijgt.
   *
   * Bij een geanonimiseerd CV verklaart dit blok meteen waarom er "Michał W." staat:
   * zonder die zin leest een halve naam als een slordig CV i.p.v. een bewuste keuze.
   */
  const drawContactBlock = () => {
    if (!doc.contactLines.length) return;
    const noteText = doc.anonymized
      ? `Dit CV is geanonimiseerd. Volledige gegevens en een kennismaking lopen via ${doc.companyName}.`
      : "";
    const padY = 12;
    const labelH = 12;
    const linesH = 13;
    const noteLines = noteText ? wrapText(noteText, fonts.regular, TYPE.foot, CONTENT_W - 34, uni) : [];
    const blockH = padY * 2 + labelH + linesH + noteLines.length * 10;

    gap();
    ensure(blockH);
    // Meelopend in de tekst, NIET verankerd aan de paginavoet. Verankeren oogt op
    // een mager CV mooier, maar dan zet dit blok de cursor op de bodem: de
    // opvul-berekening hieronder ziet dan geen ruimte meer (slack = 0) én op een vol
    // CV zou de laatste sectie eroverheen lopen. De opvulling verdeelt de ruimte al.
    const top = y + 10;
    rect(M, top - blockH, CONTENT_W, blockH, CHIP_BG);
    // Zwarte accentstreep links: zelfde vormtaal als de sectiekoppen.
    rect(M, top - blockH, 3, blockH, BRAND);

    let by = top - padY - 9;
    text(doc.contactLabel, M + 16, by, 9.5, fonts.bold, INK);
    by -= linesH;
    text(doc.contactLines.join("   ·   "), M + 16, by, TYPE.sub, fonts.regular, INK);
    for (const l of noteLines) {
      by -= 10;
      text(l, M + 16, by, TYPE.foot, fonts.regular, MUTED);
    }
    y = top - blockH;
  };

  const layout = (p: Pass): LayoutResult => {
    pass = p;
    pageCount = 0;
    gapUnits = 0;
    newPage();
    drawSummary();
    drawCertificates();
    drawSkills();
    drawExperience();
    drawEducation();
    drawLanguages();
    drawContactBlock();
    return { pageCount, endY: y, gapUnits };
  };

  // ---- meetronden: paginavulling --------------------------------------------
  //
  // Twee kwalen met één mechanisme. Eerst meten op het basisritme, dan bijsturen:
  //
  //  - NET TE LANG: een CV dat 40pt tekortkomt, dumpt "Talen" in z'n eentje op
  //    pagina 2. Dat leest als een fout, niet als een tweede pagina. Haal dan het
  //    ritme aan tot het wél past. Lukt het ook aangehaald niet, dan is het CV écht
  //    langer: laat het basisritme staan en breek gewoon.
  //  - VEEL TE KORT: één functie en twee skills laten de onderste helft leeg; dat
  //    oogt als een half ingevuld formulier. Verdeel de resthoogte dan over de
  //    sectie-overgangen.
  const base = layout({ dry: true, gapExtra: 0, density: 1 });
  let density = 1;
  if (base.pageCount > 1) {
    // Fijne trap i.p.v. grove stappen: pak de LOSSTE dichtheid die een pagina
    // scheelt. Een CV dat op 0,9 al past, hoeft niet op 0,6 geperst te worden.
    // Meetronden tekenen niets, dus extra passes kosten vrijwel niets.
    for (let d = 0.95; d >= 0.6 - 1e-9; d -= 0.05) {
      if (layout({ dry: true, gapExtra: 0, density: d }).pageCount < base.pageCount) {
        density = d;
        break;
      }
    }
  }

  let gapExtra = 0;
  if (base.pageCount === 1 && base.gapUnits > 0) {
    const slack = base.endY - BOTTOM;
    // 0,88x i.p.v. alles: het contactblok mag niet tegen de voetlijn plakken. De
    // bovengrens is een smaakgrens — meer dan ~46pt tussen twee secties leest niet
    // meer als ritme maar als een gat, en dan is wat leegte onderaan eerlijker.
    gapExtra = Math.max(0, Math.min(46, (slack * 0.88) / base.gapUnits));
  }
  layout({ dry: false, gapExtra, density });

  // ---- voettekst ------------------------------------------------------------
  const total = pages.length;
  pages.forEach((p, i) => {
    const footY = M - 18;
    p.drawLine({ start: { x: M, y: footY + 13 }, end: { x: RIGHT, y: footY + 13 }, thickness: 0.5, color: LINE });
    // Alleen de afzender: de anonimiseer-melding en de contactgegevens staan al in
    // het blok erboven, en dezelfde regel twee keer op één A4 is ruis.
    p.drawText(truncateText(doc.companyName, fonts.regular, TYPE.foot, CONTENT_W - 40, uni), {
      x: M,
      y: footY,
      size: TYPE.foot,
      font: fonts.semibold,
      color: MUTED,
    });
    const nr = `${i + 1} / ${total}`;
    p.drawText(nr, {
      x: RIGHT - fonts.regular.widthOfTextAtSize(nr, TYPE.foot),
      y: footY,
      size: TYPE.foot,
      font: fonts.regular,
      color: MUTED,
    });
  });

  return pdf.save();
}

/** Logo als PDF-image, of null als het ontbreekt/onleesbaar is (→ tekst-wordmark). */
async function embedLogo(pdf: PDFDocument) {
  const logo = getLogoFile();
  if (!logo || ![".png", ".jpg", ".jpeg"].includes(logo.ext)) return null;
  try {
    return logo.ext === ".png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
  } catch {
    return null;
  }
}
