// ---------------------------------------------------------------------------
// Komt een kandidaat uit de EU (of EER/Zwitserland: mag zonder werkvergunning in
// NL werken) of daarbuiten? Afgeleid uit de locatie (landnaam) en anders het
// landnummer van de telefoon. Buiten de EU = valt af uit de talentpool (aparte
// map, niets wordt gewist). Onbekend = blijft gewoon in de pool.
// ponytail: alleen landnamen + landnummers, geen geocoding van plaatsnamen; een
// losse plaats zonder land of nummer blijft "onbekend".
// ---------------------------------------------------------------------------

export type Herkomst = "EU" | "BUITEN_EU" | "ONBEKEND";

/** EU-27 + EER (IJsland, Liechtenstein, Noorwegen) + Zwitserland: landnummers. */
const EU_LANDNUMMERS = [
  "31", "32", "33", "34", "351", "352", "353", "354", "356", "357", "358", "359", "36", "370", "371", "372", "385",
  "386", "39", "40", "41", "420", "421", "423", "43", "45", "46", "47", "48", "49", "30",
];

/** Landnamen (NL + EN + eigen taal) en afkortingen die in een locatie staan. */
const EU_LANDEN = [
  "nederland", "netherlands", "holland", "belgie", "belgië", "belgium", "duitsland", "germany", "deutschland", "frankrijk",
  "france", "spanje", "spain", "espana", "españa", "portugal", "italie", "italië", "italy", "italia", "luxemburg", "luxembourg",
  "ierland", "ireland", "denemarken", "denmark", "zweden", "sweden", "finland", "oostenrijk", "austria", "polen", "poland",
  "polska", "tsjechie", "tsjechië", "czech", "czechia", "slowakije", "slovakia", "hongarije", "hungary", "roemenie", "roemenië",
  "romania", "bulgarije", "bulgaria", "griekenland", "greece", "kroatie", "kroatië", "croatia", "slovenie", "slovenië", "slovenia",
  "estland", "estonia", "letland", "latvia", "litouwen", "lithuania", "malta", "cyprus", "noorwegen", "norway", "ijsland",
  "iceland", "liechtenstein", "zwitserland", "switzerland",
];

const BUITEN_LANDEN = [
  "india", "pakistan", "bangladesh", "sri lanka", "nepal", "philippines", "filipijnen", "indonesia", "indonesie", "maleisie",
  "malaysia", "vietnam", "china", "turkije", "turkey", "türkiye", "egypte", "egypt", "nigeria", "ghana", "kenia", "kenya",
  "south africa", "zuid-afrika", "marokko", "morocco", "tunesie", "tunisia", "algerije", "algeria", "oekraine", "oekraïne",
  "ukraine", "rusland", "russia", "wit-rusland", "belarus", "servie", "servië", "serbia", "bosnie", "bosnia", "albanie",
  "albania", "macedonie", "macedonia", "montenegro", "kosovo", "moldavie", "moldova", "georgie", "georgia", "armenie",
  "armenia", "azerbeidzjan", "azerbaijan", "iran", "irak", "iraq", "syrie", "syria", "libanon", "lebanon", "jordanie",
  "jordan", "saudi", "verenigde arabische emiraten", "uae", "dubai", "qatar", "oman", "kuwait", "bahrain", "verenigd koninkrijk",
  "united kingdom", "engeland", "england", "scotland", "schotland", "wales", "uk", "usa", "united states", "verenigde staten",
  "canada", "mexico", "brazilie", "brazil", "argentinie", "argentina", "colombia", "venezuela", "australie", "australia",
  "nieuw-zeeland", "new zealand", "japan", "korea", "singapore", "thailand",
];

const woordIn = (tekst: string, woord: string) =>
  new RegExp(`(^|[^\\p{L}])${woord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "iu").test(tekst);

/** Landnummer uit een telefoonnummer (+91…, 0091…); NL-nummer zonder code = 31. */
function landnummer(telefoon: string | null | undefined): string | null {
  const t = (telefoon ?? "").replace(/[\s().-]/g, "");
  if (!t) return null;
  const m = /^(?:\+|00)(\d{1,4})/.exec(t);
  if (m) return m[1];
  return /^0[1-9]\d{8}$/.test(t) ? "31" : null;
}

export function herkomst(c: { location?: string | null; phone?: string | null }): Herkomst {
  const loc = (c.location ?? "").toLowerCase();
  if (loc) {
    if (EU_LANDEN.some((l) => woordIn(loc, l))) return "EU";
    if (BUITEN_LANDEN.some((l) => woordIn(loc, l))) return "BUITEN_EU";
  }
  const nr = landnummer(c.phone);
  if (!nr) return "ONBEKEND";
  // Langste prefix eerst (351 vóór 35…).
  return EU_LANDNUMMERS.some((p) => nr.startsWith(p)) ? "EU" : "BUITEN_EU";
}
