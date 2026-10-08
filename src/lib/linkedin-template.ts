// Vast Q4S-format voor LinkedIn-vacatureposts. Puur & deterministisch: dezelfde
// invoer geeft ALTIJD dezelfde opmaak, zodat elke Q4S-vacature er identiek en
// herkenbaar uitziet. LinkedIn kent geen echte opmaak, dus "vetgedrukt" doen we
// met Unicode sans-serif bold-tekens (𝗮𝗯𝗰) — die plakken één-op-één in een
// LinkedIn-post en blijven dik. Titel, kopjes en kernwoorden worden vet; met
// emoji's per sectie (📍 titel · 🔹 werkzaamheden · ✅ eisen · 📞/📧 contact).

import { DISCIPLINES, labelFor } from "./domain";

export type PostInput = {
  title: string;
  /** Discipline-waarde (DISCIPLINES) of vrije tekst. */
  discipline: string;
  location: string;
  employmentType: string;
  salary: string;
  /** Werkzaamheden — één per regel (🔧). "Kernwoord – uitleg" maakt het kernwoord vet. */
  responsibilities: string[];
  /** Eisen / wat neem je mee — één per regel (✅). */
  requirements: string[];
  /** Wie ben jij? — persoonsprofiel, lopende tekst (🙋). */
  profile: string;
  /** Wat bieden wij? — één per regel (🎁). Leeg = de vaste Q4S-punten. */
  offer: string[];
  /** Pakkende openingszin(nen). */
  summary: string;
  applyUrl: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

// --- Unicode "vet" en "cursief" --------------------------------------------
//
// LinkedIn kent geen opmaak; deze Unicode-blokken zijn de enige manier om vet en
// cursief te krijgen. Let op: cijfers bestaan alleen in de vette variant, niet in
// de cursieve — die blijven dus gewoon staan (Unicode heeft geen sans-serif
// cursieve cijfers). Accenten (ë, ł) hebben in géén van beide varianten een
// equivalent en blijven ongewijzigd; dat is beter dan ze weglaten.

/** Zet ASCII-letters/cijfers om naar Unicode sans-serif bold. */
export function boldize(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 65 && c <= 90) out += String.fromCodePoint(0x1d5d4 + (c - 65)); // A-Z
    else if (c >= 97 && c <= 122) out += String.fromCodePoint(0x1d5ee + (c - 97)); // a-z
    else if (c >= 48 && c <= 57) out += String.fromCodePoint(0x1d7ec + (c - 48)); // 0-9
    else out += ch;
  }
  return out;
}

/** Zet ASCII-letters om naar Unicode sans-serif cursief. Cijfers blijven staan. */
export function italicize(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 65 && c <= 90) out += String.fromCodePoint(0x1d608 + (c - 65)); // A-Z
    else if (c >= 97 && c <= 122) out += String.fromCodePoint(0x1d622 + (c - 97)); // a-z
    else out += ch;
  }
  return out;
}

/** Zet handmatige **vet** en *cursief* in vrije tekst om. Vet eerst: anders vreet
 *  de cursief-regex de losse sterretjes van `**` op. */
function md(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, (_, g) => boldize(g))
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (_, g) => italicize(g));
}

/** Haal de sterretjes-markers weg zonder ze om te zetten — voor tekst die in z'n
 *  geheel cursief wordt (vet ín cursief bestaat in Unicode, maar leest als ruis). */
function stripFormatting(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "$1");
}

// --- Lengte ----------------------------------------------------------------

/** Maximum van een LinkedIn-post. */
export const LINKEDIN_MAX = 3000;

/**
 * Lengte zoals LINKEDIN telt: UTF-16 code units, niet zichtbare tekens.
 *
 * Dit is geen detail. Vet/cursief/emoji liggen buiten de BMP en tellen daardoor
 * voor TWEE. Een post die er 2.600 tekens uitziet, is voor LinkedIn 3.300 — en dan
 * krijg je "U hebt het maximale aantal tekens overschreden" zonder te zien waarom.
 * Meet dus altijd hiermee, nooit met [...s].length.
 */
export function postLength(s: string): number {
  return s.length;
}

/**
 * De eerste `max` zinnen. Voor de intro: die moet pakkend zijn, niet volledig — de
 * rest van de vacature vertelt het verhaal al, en bovendien is de intro cursief en
 * kost elke letter daar dubbel.
 */
function firstSentences(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const parts = flat.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  if (!parts || parts.length <= max) return flat;
  return parts.slice(0, max).join("").trim();
}

/**
 * Maak vakkennis-tokens automatisch vet: acroniemen (IWS, EWCP, VCA), normen
 * (EN 1090, ISO 3834, ISO 9606-1), diploma-niveaus (IWI-C, IWI-S) en "Level 2".
 * Draait ná md(), dus reeds-vette (Unicode) stukken worden niet nog eens geraakt.
 *
 * Het token wordt ALTIJD in z'n geheel vet, inclusief de staart achter een
 * koppelteken of schuine streep. Een eerdere versie stopte op de woordgrens en
 * maakte van "IWI-C" dus "𝗜𝗪𝗜-C": half vet, en juist de letter die het diploma
 * onderscheidt (C vs. S) bleef mager.
 */
function autoBold(s: string): string {
  return s.replace(
    // [A-Z]{2,}      → het acroniem zelf (IWI, VCA, ISO)
    // (?:[-/][A-Z0-9]+)*  → staarten als -C, -S, /QA
    // (?:\s?\d{2,}(?:[-–]\d+)*)? → normnummers: " 1090", " 9606-1"
    /\b([A-Z]{2,}(?:[-/][A-Z0-9]+)*(?:\s?\d{2,}(?:[-–]\d+)*)?|Level\s?\d+)\b/g,
    (m) => boldize(m),
  );
}

/** Eén werkzaamheid: "Kernwoord – uitleg" → vet kernwoord + uitleg. */
function respLine(r: string): string {
  const dash = r.match(/^(.+?)\s+[–-]\s+(.+)$/);
  if (dash) return `${boldize(dash[1].trim())} – ${md(dash[2].trim())}`;
  const colon = r.match(/^([^:]{2,40}):\s+(.+)$/);
  if (colon) return `${boldize(colon[1].trim())}: ${md(colon[2].trim())}`;
  return md(r);
}

/**
 * Tussenkopjes binnen een opsomming ("Pré", "Nice to have", "Vereist"): korte
 * labels zonder werkwoord die de regels eronder inleiden. Die kregen eerder een ✅
 * alsof ze zelf een eis waren — "✅ Pré" leest als onzin. Nu worden ze vet, zonder
 * vinkje, zodat ze doen wat ze zijn: een kopje.
 */
const SUBLABEL_RE = /^(pré|pre|pré's|nice to have|bonus|vereist|must[- ]?have|optioneel|extra|gewenst)\s*:?\s*$/i;

function isSublabel(s: string): boolean {
  return SUBLABEL_RE.test(s.trim());
}

// --- Hashtags --------------------------------------------------------------

/** Maak een nette hashtag van vrije tekst (#PascalCase, zonder accenten/tekens). */
function tag(s: string): string {
  const cleaned = s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim();
  if (!cleaned) return "";
  const camel = cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return `#${camel}`;
}

function buildHashtags(inp: PostInput, discipline: string, loc: string): string {
  const tags: string[] = ["#Vacature"];
  const push = (t: string) => {
    const x = tag(t);
    if (x && x.length > 2) tags.push(x);
  };
  // De functie als één tag (#QualityManager), dan het vakgebied.
  push(inp.title.replace(/\(.*?\)/g, "").split(/[/,|]/)[0]);
  if (discipline && !/^overig/i.test(discipline)) push(discipline.split(/[/—|]/)[0]);
  // Normen / acroniemen uit eisen + werkzaamheden (EN 1090 → #EN1090).
  const acr = new Set<string>();
  for (const line of [...inp.requirements, ...inp.responsibilities]) {
    for (const m of line.matchAll(/\b[A-Z]{2,}\s?\d{2,}\b|\b[A-Z]{3,}\b/g)) acr.add(m[0].replace(/\s+/g, ""));
  }
  // Alleen echte normen/certificaten (letters+cijfers), geen losse afkortingen als VOL/HBO.
  for (const a of acr) if (/\d/.test(a)) push(a);
  if (loc) push(loc);
  if (/deeltijd|parttime|\d+\s*uur/i.test(inp.employmentType)) tags.push("#Parttime");
  push("Techniek");
  // Minimaal 5 hashtags: vul zo nodig aan met vaste, relevante tags.
  const out = [...new Set(tags)];
  for (const f of ["#Vacature", "#Techniek", "#Detachering", "#Werk", "#Carriere", "#Q4S"]) {
    if (out.length >= 5) break;
    if (!out.includes(f)) out.push(f);
  }
  // LinkedIn: 3-5 relevante hashtags werken beter dan een lange rij.
  return out.slice(0, 5).join(" ");
}

/** Functietitel netjes: "Mechanical/ Hydraulic" → "Mechanical/Hydraulic", "Voorman / NDO" → "Voorman NDO". */
export function functieTitel(title: string): string {
  return title.trim().replace(/\s*\/\s*(?=\p{Lu}{2,}\b)/gu, " ").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
}

/** Na "een …": enkelvoud ("Inspectors" → "Inspector", "Lassers" → "Lasser"). */
export function eenFunctie(title: string): string {
  return functieTitel(title).replace(/(\p{L}{3,}(?:er|or|eur|ist))s\b(?!.*\p{L}{3,}(?:er|or|eur|ist)s\b)/u, "$1");
}

/** "Marktconform p/u" → "marktconform per uur" (geen hoofdletter midden in een zin). */
export function vergoedingTekst(salary: string): string {
  return salary
    .trim()
    .replace(/\bp\/u\b|\bp\.u\.?/gi, "per uur")
    .replace(/\bp\/m\b/gi, "per maand")
    .replace(/^(Marktconform|Competitief|Volgens cao|In overleg|Nader te bepalen)\b/, (w) => w.toLowerCase());
}

/** Het leesbare label van een discipline (valt terug op de vrije tekst). */
export function disciplineLabelOf(discipline: string): string {
  const d = discipline.trim();
  if (!d) return "";
  const label = labelFor(DISCIPLINES, d);
  return label && label !== "—" ? label : d;
}

// Vaste Q4S-contactgegevens voor vacatureposts (Gjil). Deze staan ALTIJD onder
// de post — ook als een aanroeper per ongeluk niets meegeeft.
export const Q4S_CONTACT_PHONE = "+31 6 83859566";
export const Q4S_CONTACT_EMAIL = "cv@q4s.nl";
/** De openbare Q4S-site (vacatures + sollicitatieformulier). */
export const Q4S_SITE = "https://www.q4s.nl";

/** Link naar de vacature op q4s.nl; zonder slug het vacature-overzicht. */
export function vacatureUrl(slug?: string | null): string {
  return slug ? `${Q4S_SITE}/nl/vacatures/${slug}` : `${Q4S_SITE}/nl/vacatures`;
}

/**
 * De LinkedIn-post volgens AIDA, het format dat op LinkedIn converteert:
 *  A  Attention — de eerste 2 regels (vóór "…meer weergeven"): een vraag aan de
 *     juiste vakman + het concrete feit (project, plaats, duur).
 *  I  Interest  — wat het werk is: context + max 4 werkzaamheden.
 *  D  Desire    — wat het jou oplevert + of je erbij past (max 5 eisen).
 *  A  Action    — één duidelijke stap met de links naar q4s.nl, dan contact.
 * Schrijfregels (marketing-skill): geen emoji als opsommingsteken, geen
 * gedachtestreepjes, geen "Thoughts?"-afsluiter, max 5 hashtags.
 */
/** Keuzes in de studio: welke openingszin, en de links in de eerste reactie
 *  (LinkedIn toont posts met een link in de tekst minder vaak). */
export type PostOpties = { hook?: string; linksInReactie?: boolean };

/**
 * Drie openingszinnen (de 2 regels vóór "…meer weergeven") in verschillende stijl:
 * vraag aan de vakman, het concrete feit, en de situatie op het project.
 * Geen AI-trucjes ("Het is geen X, het is Y"), wel feiten uit de vacature.
 */
export function hookOpties(inp: PostInput): string[] {
  const title = functieTitel(inp.title) || "vakman";
  const een = eenFunctie(inp.title) || "vakman";
  const summary = stripFormatting(inp.summary.trim()).replace(/\s+/g, " ");
  const zinnen = summary.match(/[^.!?]+[.!?]+/g)?.map((z) => z.trim()) ?? [];
  const duur = /(\d+\s*\+?\s*(?:maanden|maand|weken|jaar))/i.exec(summary)?.[1];
  const loc = inp.location.trim() || "Nederland";
  const vraag = zinnen.find((z) => z.endsWith("?")) ?? `Ben jij een ervaren ${een} en klaar voor je volgende project?`;
  const feit = `Gezocht: ${title} in ${loc}${duur ? ` voor ${duur}` : ""}.`;
  const eerste = inp.responsibilities.map((r) => r.trim()).find((r) => r && !isSublabel(r));
  const situatie = eerste
    ? `Op een project in ${loc} is een ${een} nodig. Eerste klus: ${respLine(eerste).replace(/^\p{Lu}/u, (c) => c.toLowerCase()).replace(/[.;:]$/, "")}.`
    : `Een opdrachtgever in ${loc} zoekt een ${een} die meteen kan starten.`;
  return [...new Set([vraag, feit, situatie])];
}

/** De eerste reactie onder de post: solliciteer-link + vacature. */
export function eersteReactie(inp: PostInput): string {
  const url = inp.applyUrl.trim();
  const slug = /\/vacatures\/([^/?#]+)/.exec(url)?.[1];
  return [
    slug ? `Solliciteren in 2 minuten: ${Q4S_SITE}/nl/cv-uploaden?vacancy=${slug}` : "",
    url ? `Alle details: ${url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildLinkedinPost(inp: PostInput, opties: PostOpties = {}): string {
  const discipline = disciplineLabelOf(inp.discipline);
  const loc = inp.location.trim();
  const company = inp.companyName.trim() || "Q4S";
  const resp = inp.responsibilities.map((r) => r.trim()).filter((r) => r && !isSublabel(r));
  const reqs = inp.requirements.map((r) => r.trim()).filter((r) => r && !isSublabel(r));
  const offer = inp.offer.map((r) => r.trim()).filter(Boolean);
  const profile = inp.profile.trim();
  const summary = stripFormatting(inp.summary.trim()).replace(/\s+/g, " ");
  const salary = inp.salary.trim();
  const zinnen = summary.match(/[^.!?]+[.!?]+/g)?.map((z) => z.trim()) ?? (summary ? [summary] : []);
  const duur = /(\d+\s*\+?\s*(?:maanden|maand|weken|jaar))/i.exec(summary)?.[1];
  const punt = (r: string) => `• ${autoBold(respLine(r))}`;

  const L: string[] = [];

  // A — Attention: de vraag uit de tekst, anders een eigen vraag + het feit.
  const vraag = zinnen.find((z) => z.endsWith("?"));
  L.push(boldize(opties.hook?.trim() || vraag || `Ben jij een ervaren ${eenFunctie(inp.title) || "vakman"} en klaar voor je volgende project?`));
  const feit = [`📍 ${loc || "Nederland"}`, duur ? `${duur}` : "", inp.employmentType.trim()].filter(Boolean).join(" · ");
  L.push(feit);
  L.push("");

  // I — Interest: context + wat je gaat doen.
  const context = zinnen.filter((z) => !z.endsWith("?")).slice(0, 2).join(" ");
  if (context) {
    L.push(context);
    L.push("");
  }
  if (resp.length) {
    L.push(boldize("Wat je gaat doen"));
    for (const r of resp.slice(0, 4)) L.push(punt(r));
    L.push("");
  }

  // D — Desire: wat het oplevert + of je erbij past.
  const offerLines = offer.length
    ? offer
    : [
        ...(salary ? [`${/€|\d/.test(salary) ? "Tarief" : "Vergoeding"}: ${vergoedingTekst(salary)}`] : []),
        ...(duur ? [`Een opdracht van ${duur} met een vaste opdrachtgever`] : []),
        `Persoonlijke begeleiding en korte lijnen met ${company}`,
      ];
  L.push(boldize("Wat je ervoor terugkrijgt"));
  for (const o of offerLines.slice(0, 4)) L.push(punt(o));
  L.push("");
  if (reqs.length || profile) {
    L.push(boldize("Herken je jezelf hierin?"));
    for (const r of reqs.slice(0, 5)) L.push(`• ${autoBold(md(r))}`);
    if (profile) L.push(autoBold(md(firstSentences(profile, 2))));
    L.push("");
  }

  // A — Action: één stap, met de links naar q4s.nl.
  L.push(boldize("Solliciteer in 2 minuten"));
  const url = inp.applyUrl.trim();
  const slug = /\/vacatures\/([^/?#]+)/.exec(url)?.[1];
  if (opties.linksInReactie && url) {
    L.push("👉 De link om te solliciteren staat in de eerste reactie.");
  } else {
    if (slug) L.push(`👉 ${Q4S_SITE}/nl/cv-uploaden?vacancy=${slug}`);
    if (url) L.push(`Alle details: ${url}`);
  }
  L.push(`Liever eerst bellen? ${inp.contactPhone.trim() || Q4S_CONTACT_PHONE} of mail ${inp.contactEmail.trim() || Q4S_CONTACT_EMAIL}`);
  const contactName = inp.contactName.trim();
  if (contactName) L.push(`${contactName}, ${company}`);
  L.push("");
  L.push("Ken je iemand die hier perfect bij past? Tag diegene in de reacties.");
  L.push("");

  L.push(buildHashtags(inp, discipline, loc));

  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------------------
// Plak-en-klaar: één lap vacaturetekst → gestructureerde velden. Deterministisch
// (geen AI): herkent NL-vacaturekopjes (Wat ga je doen / Wat neem je mee / eisen
// …), strip't bullets en vist titel, discipline, locatie, dienstverband en
// salaris eruit. De gebruiker hoeft dan niets meer in aparte vakjes te typen.
// ---------------------------------------------------------------------------

export type ParsedVacancy = {
  title: string;
  discipline: string;
  location: string;
  employmentType: string;
  salary: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  /** "Wie ben jij?" — lopende tekst. */
  profile: string;
  /** "Wat bieden wij?" — één punt per regel. */
  offer: string[];
};

const BULLET_RE = /^\s*(?:[•\-–—*·▪◦●○►▶‣★☆✅✔☑»>]|\p{Emoji_Presentation}|\d+[.)])\s+/u;

function stripBullet(s: string): string {
  return s.replace(BULLET_RE, "").trim();
}

type Bucket = "intro" | "resp" | "req" | "profile" | "offer" | "end";

// LET OP de volgorde: de eerste match wint. "wie ben jij" moet dus vóór de brede
// req-regex staan, anders wordt het persoonsprofiel bij de eisen gegooid en krijgt
// een hele alinea karaktereigenschappen een ✅ voor z'n neus.
const SECTIONS: { bucket: Bucket; re: RegExp }[] = [
  { bucket: "resp", re: /wat ga je doen|wat je gaat doen|werkzaamhe|je taken|jouw taken|takenpakket|verantwoordelijkhe|functieomschrijving|dit ga je doen|jouw (rol|uitdaging)|je gaat/i },
  { bucket: "profile", re: /wie ben jij|wie ben je|jouw profiel|^profiel\b|over jou/i },
  { bucket: "req", re: /wat neem je mee|wat vraag|wat vragen (we|wij)|functie[- ]?eis|^eisen\b|wat (zoeken|verwachten) (we|wij)|wat breng je mee|requirements|gevraagd|jij beschikt/i },
  { bucket: "offer", re: /wat bieden|wij bieden|dit bieden|^aanbod|arbeidsvoorwaarden|wat krijg je|wat mag je verwachten/i },
  { bucket: "intro", re: /over de (functie|rol|opdracht|organisatie)|wie zijn wij|introductie|over (ons|het bedrijf)|de opdracht/i },
  { bucket: "end", re: /^interesse|solliciteer|reageer|reageren|enthousiast geworden|meer weten|neem (dan )?contact/i },
];

/**
 * Is deze regel een sectiekop? (kort + herkenbare kopwoorden) → welke bucket.
 *
 * Een kop eindigt NOOIT op een punt. Die eis is niet cosmetisch: zonder die regel
 * werd "Veel zelfstandigheid en verantwoordelijkheid." herkend als de kop
 * "Werkzaamheden" (het woord 'verantwoordelijkhe' zit in die regex) en
 * "Goede arbeidsvoorwaarden en een marktconform salaris." als "Wat bieden wij?".
 * Beide regels werden dan als kopje opgeslokt en verdwenen uit de post — precies de
 * inhoud die de gebruiker miste. Een opsommingsregel die toevallig een kopwoord
 * bevat is geen kop.
 */
function detectHeader(line: string): Bucket | null {
  const head = line.replace(/[:?].*$/, "").trim();
  if (!head || head.length > 60 || head.split(/\s+/).length > 9) return null;
  if (/\.\s*$/.test(line.trim())) return null;
  if (BULLET_RE.test(line)) return null; // een bullet is inhoud, geen kop
  for (const s of SECTIONS) if (s.re.test(line.toLowerCase())) return s.bucket;
  return null;
}

const DISC_HINTS: [RegExp, string][] = [
  [/niet[- ]?destructief|non[- ]?destructive|\bnd[ot]\b|\bndt\b/i, "NDO"],
  [/\blas(sen|coördinator|coordinator|techn|kwalificatie)|\bweld/i, "LASSEN"],
  [/\bfitter|pijpfitter/i, "FITTER"],
  [/quality control|\bqc\b|kwaliteitscontrole/i, "QC"],
  [/quality assurance|\bqa\b|kwaliteitsborging|kwaliteitsinspec/i, "QA"],
];

function firstMatch(text: string, re: RegExp): string {
  const m = text.match(re);
  if (!m) return "";
  return (m[1] ?? m[0]).replace(/\s+/g, " ").trim();
}

/**
 * Leest deze regel als functietitel? Zo ja: de opgeschoonde titel, anders "".
 *
 * Een titel is kort en noemt een functie; een intro is een lopende zin. Het
 * onderscheid zit NIET in de afsluitende punt — "Meewerkend Voorman QC / Las
 * Specialist (Scheepsbouw)." is een titel mét punt, en die punt was precies de
 * reden dat de titel eerder werd weggegooid. Daarom: punt weghalen en op de
 * échte kenmerken toetsen (lengte, aantal woorden, geen vraag/uitroep, geen
 * meerdere zinnen, begint met een hoofdletter).
 */
function titleLike(line: string): string {
  const l = line.replace(/\s+/g, " ").trim().replace(/\.$/, "").trim();
  if (!l || l.length > 90) return "";
  if (/[!?]$/.test(l)) return ""; // "Ben jij die vakman?" → intro, geen titel
  if (/[.!?]\s+\S/.test(l)) return ""; // meerdere zinnen op één regel → prosa
  if (l.split(/\s+/).length > 12) return "";
  if (!/^[A-ZÀ-Ý0-9]/.test(l)) return ""; // titels beginnen met een hoofdletter
  return l;
}

/** Parse een geplakte vacaturetekst naar losse velden voor de LinkedIn-generator. */
export function parseVacancyText(raw: string): ParsedVacancy {
  const text = raw.replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim());

  // --- Titel: expliciete "Gezocht/Vacature: X", anders de eerste nette regel. ---
  let title = "";
  let titleIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const m = lines[i].match(/^\s*(?:gezocht|vacature|functie|we zoeken(?: naar)?)\s*[:\-]\s*(.+)$/i);
    if (m) {
      title = m[1].trim();
      titleIdx = i;
      break;
    }
  }
  // Geen expliciet "Gezocht:"? Pak de eerste regel die zich als functietitel
  // gedraagt. Scan door de eerste paar regels: `break` na de eerste regel liet een
  // titel die net niet voldeed als "" achter, en dan kwam er "Gezocht: Nieuwe
  // vacature" in de post te staan terwijl de titel gewoon bovenaan de tekst stond.
  if (!title) {
    let seen = 0;
    for (let i = 0; i < lines.length && seen < 5; i++) {
      const l = stripBullet(lines[i]);
      if (!l) continue;
      seen++;
      if (detectHeader(l) !== null) continue;
      const t = titleLike(l);
      if (t) {
        title = t;
        titleIdx = i;
        break;
      }
    }
  }

  // Dienstverband uit een trailing "(… uur/zzp/…)" in de titel halen.
  let employmentType = "";
  const paren = title.match(/\(([^)]*(?:uur|deeltijd|part[- ]?time|full[- ]?time|zzp|detachering)[^)]*)\)\s*$/i);
  if (paren) {
    employmentType = paren[1].trim();
    title = title.replace(/\s*\([^)]*\)\s*$/, "").trim();
  }

  // --- Buckets vullen vanaf de regel ná de titel. Onthoud of een regel een echte
  //     bullet was, zodat we lead-in-zinnen ("Je bent verantwoordelijk voor:") uit
  //     een opsomming kunnen weglaten. ---
  const buckets: Record<Bucket, { text: string; bul: boolean }[]> = {
    intro: [],
    resp: [],
    req: [],
    profile: [],
    offer: [],
    end: [],
  };
  let cur: Bucket = "intro";
  for (let i = titleIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const header = detectHeader(line);
    if (header) {
      cur = header;
      continue;
    }
    if (cur === "end") continue; // alles ná de CTA negeren
    const bul = BULLET_RE.test(line);
    const clean = stripBullet(line);
    if (clean) buckets[cur].push({ text: clean, bul });
  }

  // Zijn er echte bullets in een sectie? Dan alleen die houden (prosa/lead-in eruit);
  // anders alle regels als losse items.
  const items = (arr: { text: string; bul: boolean }[]): string[] => {
    const kept = arr.some((x) => x.bul) ? arr.filter((x) => x.bul) : arr;
    return kept.map((x) => x.text).filter(Boolean);
  };

  // --- Overige velden uit de volledige tekst. ---
  let discipline = "";
  for (const [re, val] of DISC_HINTS) {
    if (re.test(title) || re.test(text)) {
      discipline = val;
      break;
    }
  }

  if (!employmentType) {
    employmentType =
      firstMatch(text, /(?:ca\.?\s*)?\d+\s*(?:-\s*\d+\s*)?uur per week/i) ||
      firstMatch(text, /\b(full[- ]?time|part[- ]?time|deeltijd|zzp|freelance|detachering|uitzend|interim)\b/i);
  }

  let salary = firstMatch(text, /€\s?\d[\d.,]*\s*(?:[-–]\s*€?\s?\d[\d.,]*)?\s*(?:per uur|\/uur|p\/u|per maand|bruto)?/i);
  if (!salary) salary = firstMatch(text, /(?:salaris|tarief)\s*[:\-]\s*([^\n]{2,60})/i);

  let location = firstMatch(text, /(?:locatie|standplaats|werklocatie|regio)\s*[:\-]\s*([A-Za-zÀ-ÿ .'\/-]{2,40})/i);
  location = location.replace(/[,;.].*$/, "").trim();

  return {
    title,
    discipline,
    location,
    employmentType,
    salary,
    summary: buckets.intro.map((x) => x.text).join("\n").trim(),
    responsibilities: items(buckets.resp),
    requirements: items(buckets.req),
    // Profiel is prosa: regels aan elkaar plakken i.p.v. als losse punten.
    profile: buckets.profile.map((x) => x.text).join(" ").replace(/\s+/g, " ").trim(),
    offer: items(buckets.offer),
  };
}

/** Bouw een Q4S-gebrande prompt voor een AI-afbeeldingmaker (vast format). */
export function buildImagePrompt(inp: PostInput): string {
  const discipline = disciplineLabelOf(inp.discipline);
  const loc = inp.location.trim();
  return [
    "Professionele LinkedIn-vacatureafbeelding (vierkant, 1080x1080) voor Q4S, een technisch detacheringsbureau (QA/QC, lassen, fitters, NDO/NDT).",
    "Strakke, moderne huisstijl: rustige donkere/neutrale achtergrond met één groen accent en veel witruimte; hoge leesbaarheid, geen stockfoto-clichés.",
    `Grote koptekst bovenaan: "${inp.title.trim() || "Vacature"}".`,
    `Kleinere subtekst: "${[discipline, loc].filter(Boolean).join(" · ") || "Q4S"}".`,
    "Subtiel 'Q4S'-woordmerk rechtsonder.",
    discipline ? `Industrieel-technisch sfeerbeeld passend bij ${discipline}.` : "Industrieel-technische sfeer.",
    "Consistent, herkenbaar Q4S-format.",
  ].join(" ");
}
