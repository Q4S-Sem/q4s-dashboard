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
  /** Werkzaamheden — één per regel (🔹). "Kernwoord – uitleg" maakt het kernwoord vet. */
  responsibilities: string[];
  /** Eisen / wat neem je mee — één per regel (✅). */
  requirements: string[];
  /** Pakkende openingszin(nen). */
  summary: string;
  applyUrl: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

// --- Unicode "vet" ---------------------------------------------------------

/** Zet ASCII-letters/cijfers om naar Unicode sans-serif bold (blijft vet op
 *  LinkedIn). Accenten/tekens (ë, ö, –) blijven ongewijzigd. */
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

/** Zet handmatige **markers** in vrije tekst om naar vet. */
function md(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, (_, g) => boldize(g));
}

/** Maak vakkennis-tokens automatisch vet: acroniemen (IWS, EWCP, VCA), normen
 *  (EN 1090, ISO 3834) en "Level 2". Draait ná md(), dus reeds-vette (Unicode)
 *  stukken worden niet nog eens geraakt. */
function autoBold(s: string): string {
  return s.replace(/\b([A-Z]{2,}(?:\s?\d{2,})?|Level\s?\d+)\b/g, (m) => boldize(m));
}

/** Eén werkzaamheid: "Kernwoord – uitleg" → vet kernwoord + uitleg. */
function respLine(r: string): string {
  const dash = r.match(/^(.+?)\s+[–-]\s+(.+)$/);
  if (dash) return `${boldize(dash[1].trim())} – ${md(dash[2].trim())}`;
  const colon = r.match(/^([^:]{2,40}):\s+(.+)$/);
  if (colon) return `${boldize(colon[1].trim())}: ${md(colon[2].trim())}`;
  return md(r);
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

const STOP = new Set(["voor", "level", "senior", "junior", "medior", "van", "de", "het", "een"]);

function buildHashtags(inp: PostInput, discipline: string, loc: string): string {
  const tags: string[] = ["#Vacature"];
  const push = (t: string) => {
    const x = tag(t);
    if (x && x.length > 2) tags.push(x);
  };
  if (discipline) push(discipline.split(/[/—|]/)[0]);
  // Betekenisvolle woorden uit de titel.
  for (const w of inp.title.split(/[\s&/,]+/)) {
    if (w.length >= 5 && !STOP.has(w.toLowerCase())) push(w);
  }
  // Normen / acroniemen uit eisen + werkzaamheden (EN 1090 → #EN1090).
  const acr = new Set<string>();
  for (const line of [...inp.requirements, ...inp.responsibilities]) {
    for (const m of line.matchAll(/\b[A-Z]{2,}\s?\d{2,}\b|\b[A-Z]{3,}\b/g)) acr.add(m[0].replace(/\s+/g, ""));
  }
  for (const a of acr) push(a);
  if (loc) push(loc);
  if (/deeltijd|parttime|\d+\s*uur/i.test(inp.employmentType)) tags.push("#Parttime");
  push("Techniek");
  // Minimaal 5 hashtags: vul zo nodig aan met vaste, relevante tags.
  const out = [...new Set(tags)];
  for (const f of ["#Vacature", "#Techniek", "#Detachering", "#Werk", "#Carriere", "#Q4S"]) {
    if (out.length >= 5) break;
    if (!out.includes(f)) out.push(f);
  }
  return out.slice(0, 12).join(" ");
}

/** Het leesbare label van een discipline (valt terug op de vrije tekst). */
export function disciplineLabelOf(discipline: string): string {
  const d = discipline.trim();
  if (!d) return "";
  const label = labelFor(DISCIPLINES, d);
  return label && label !== "—" ? label : d;
}

/** Bouw de LinkedIn-post in het vaste Q4S-format (met Unicode-vet + emoji's). */
export function buildLinkedinPost(inp: PostInput): string {
  const title = inp.title.trim() || "Nieuwe vacature";
  const empl = inp.employmentType.trim();
  const discipline = disciplineLabelOf(inp.discipline);
  const loc = inp.location.trim();
  const company = inp.companyName.trim() || "Q4S";
  const resp = inp.responsibilities.map((r) => r.trim()).filter(Boolean);
  const reqs = inp.requirements.map((r) => r.trim()).filter(Boolean);
  const summary = inp.summary.trim();
  const salary = inp.salary.trim();

  const L: string[] = [];

  // Titel — dikgedrukt, met 📍.
  L.push(`📍 ${boldize(`Gezocht: ${title}${empl ? ` (${empl})` : ""}`)}`);
  L.push("");

  // Pakkende intro.
  if (summary) {
    L.push(md(summary));
  } else {
    L.push(
      md(
        `Voor een mooie en uitdagende functie${discipline ? ` binnen ${discipline}` : ""}${
          loc ? ` in ${loc}` : ""
        } zoeken wij bij ${company} versterking!`,
      ),
    );
  }
  L.push("");

  // Wat ga je doen? — 🔹 werkzaamheden.
  if (resp.length) {
    L.push(boldize("Wat ga je doen?"));
    L.push("In deze rol ben je een cruciale schakel. Je bent onder andere verantwoordelijk voor:");
    for (const r of resp) L.push(`🔹 ${respLine(r)}`);
    L.push("");
  }

  // Wat neem je mee? — ✅ eisen (met auto-vette normen/acroniemen).
  if (reqs.length) {
    L.push(boldize("Wat neem je mee?"));
    for (const r of reqs) L.push(`✅ ${autoBold(md(r))}`);
    L.push("");
  }

  // Wat bieden we? — alleen als er een salaris/tarief is ingevuld.
  if (salary) {
    L.push(boldize("Wat bieden we?"));
    L.push(`🔹 Een marktconform ${/uur|€|\d/.test(salary) ? "tarief" : "salaris"}: ${md(salary)}`);
    L.push("🔹 Mooie projecten bij toonaangevende opdrachtgevers");
    L.push(`🔹 Persoonlijke begeleiding en korte lijnen bij ${company}`);
    L.push("");
  }

  // Interesse.
  L.push(boldize("Interesse of de gouden tip?"));
  L.push(
    `Ben jij beschikbaar${empl ? ` voor ${empl}` : ""}? Of ken je de perfecte kandidaat in je netwerk? Neem dan direct contact met ons op!`,
  );
  if (inp.applyUrl.trim()) L.push(`👉 Direct reageren: ${inp.applyUrl.trim()}`);
  L.push("");

  // Contact — alleen het label "Telefoon:"/"E-mail:" is vet; de waarden blijven
  // gewone tekst zodat e-mail en telefoon op LinkedIn klikbaar/kopieerbaar zijn.
  if (inp.contactPhone.trim()) L.push(`📞 ${boldize("Telefoon:")} ${inp.contactPhone.trim()}`);
  if (inp.contactEmail.trim()) L.push(`📧 ${boldize("E-mail:")} ${inp.contactEmail.trim()}`);
  const contactName = inp.contactName.trim();
  if (contactName) L.push(`🤝 ${contactName} · ${company}`);
  L.push("");

  // Hashtags.
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
};

const BULLET_RE = /^\s*(?:[•\-–—*·▪◦●○►▶‣★☆✅✔☑»>]|\p{Emoji_Presentation}|\d+[.)])\s+/u;

function stripBullet(s: string): string {
  return s.replace(BULLET_RE, "").trim();
}

type Bucket = "intro" | "resp" | "req" | "offer" | "end";

const SECTIONS: { bucket: Bucket; re: RegExp }[] = [
  { bucket: "resp", re: /wat ga je doen|wat je gaat doen|werkzaamhe|je taken|jouw taken|takenpakket|verantwoordelijkhe|functieomschrijving|dit ga je doen|jouw (rol|uitdaging)|je gaat/i },
  { bucket: "req", re: /wat neem je mee|wat vraag|wat vragen (we|wij)|functie[- ]?eis|^eisen\b|jouw profiel|wat (zoeken|verwachten) (we|wij)|wie ben jij|wat breng je mee|requirements|^profiel|gevraagd|jij beschikt/i },
  { bucket: "offer", re: /wat bieden|wij bieden|dit bieden|^aanbod|arbeidsvoorwaarden|wat krijg je|wat mag je verwachten/i },
  { bucket: "intro", re: /over de (functie|rol|opdracht|organisatie)|wie zijn wij|introductie|over (ons|het bedrijf)|de opdracht/i },
  { bucket: "end", re: /^interesse|solliciteer|reageer|reageren|enthousiast geworden|meer weten|neem (dan )?contact/i },
];

/** Is deze regel een sectiekop? (kort + herkenbare kopwoorden) → welke bucket. */
function detectHeader(line: string): Bucket | null {
  const head = line.replace(/[:?].*$/, "").trim();
  if (!head || head.length > 60 || head.split(/\s+/).length > 9) return null;
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
  if (!title) {
    for (let i = 0; i < lines.length; i++) {
      const l = stripBullet(lines[i]);
      if (!l) continue;
      if (l.length <= 90 && !/[.!]$/.test(l) && detectHeader(l) === null) {
        title = l;
        titleIdx = i;
      }
      break;
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
