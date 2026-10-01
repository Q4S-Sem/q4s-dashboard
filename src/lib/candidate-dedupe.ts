import { db } from "./db";

// ---------------------------------------------------------------------------
// Dubbele kandidaten voorkomen.
//
// Elk publiek instroompunt (sollicitatieformulier op q4s.nl, de vacaturepagina,
// de talentpool) maakte tot nu toe ALTIJD een nieuwe Candidate. Iemand die twee
// keer reageert staat dan twee keer in de talentpool, met een halve historie per
// rij. Hier staan de regels waarmee twee inzendingen dezelfde persoon zijn:
// hetzelfde e-mailadres OF hetzelfde telefoonnummer, na normalisatie.
//
// Harde grens: een treffer leidt NOOIT tot samenvoegen of overschrijven van
// bestaande kandidaatgegevens. De nieuwe sollicitatie/CV wordt aan het bestaande
// dossier gehangen en de recruiter krijgt een review-only melding. Geen status,
// geen mail, geen plaatsing.
// ---------------------------------------------------------------------------

/** Genormaliseerde contactsleutels waarop twee inzendingen dezelfde persoon zijn. */
export type CandidateDedupeKeys = {
  email: string | null;
  phone: string | null;
};

/**
 * Trim + kleine letters. Waarden die onmogelijk een adres kunnen zijn leveren
 * géén sleutel op: op "-" of "onbekend" matchen zou losse mensen samenvoegen.
 */
export function normalizeCandidateEmail(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  // Precies één @, geen witruimte, en een punt in het domein.
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? value : null;
}

/** Hoe kort een nummer mag zijn en nog een persoon kan aanwijzen (zelfde grens
 *  als de tel:-link op de matchpagina). */
const MIN_PHONE_DIGITS = 6;

/**
 * Alleen cijfers, met de NL-landcode terug naar de nationale notatie. 06-12345678,
 * 0612345678, +31 6 12345678, 0031612345678 en 31612345678 zijn hetzelfde nummer
 * en worden allemaal "0612345678". Buitenlandse nummers blijven staan zoals ze
 * zijn — alleen 31/+31/0031 kennen we als de eigen landcode.
 */
export function normalizeCandidatePhone(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0031")) digits = `0${digits.slice(4)}`;
  // Een NL nationaal nummer begint altijd met een 0; begint het met 31, dan is
  // dat de landcode (met of zonder + ervoor).
  else if (digits.startsWith("31")) digits = `0${digits.slice(2)}`;

  return digits.length >= MIN_PHONE_DIGITS ? digits : null;
}

export function candidateDedupeKeys(contact: {
  email?: string | null;
  phone?: string | null;
}): CandidateDedupeKeys {
  return {
    email: normalizeCandidateEmail(contact.email),
    phone: normalizeCandidatePhone(contact.phone),
  };
}

/** Valt er überhaupt iets te vergelijken? Zonder sleutel wordt er niets gezocht. */
export function hasDedupeKey(keys: CandidateDedupeKeys): boolean {
  return Boolean(keys.email || keys.phone);
}

export type CandidateContactRow = {
  id: string;
  email: string | null;
  phone: string | null;
};

export type CandidateDedupeMatch<T> = {
  candidate: T;
  /** Waarop de treffer is gevonden — staat letterlijk in de recruiter-melding. */
  matchedOn: "email" | "phone";
};

/**
 * Kies uit al opgehaalde kandidaten de bestaande persoon achter deze inzending.
 * Pure functie: e-mail weegt zwaarder dan telefoon (een adres is een sterker
 * kenmerk dan een nummer dat van een partner of werkgever kan zijn), en binnen
 * dezelfde soort treffer wint de eerst aangeboden rij — de aanroeper levert ze
 * oudste-eerst, zodat het oorspronkelijke dossier het dossier blijft.
 */
export function pickDuplicateCandidate<T extends CandidateContactRow>(
  rows: T[],
  keys: CandidateDedupeKeys,
): CandidateDedupeMatch<T> | null {
  if (!hasDedupeKey(keys)) return null;

  if (keys.email) {
    const hit = rows.find((row) => normalizeCandidateEmail(row.email) === keys.email);
    if (hit) return { candidate: hit, matchedOn: "email" };
  }
  if (keys.phone) {
    const hit = rows.find((row) => normalizeCandidatePhone(row.phone) === keys.phone);
    if (hit) return { candidate: hit, matchedOn: "phone" };
  }
  return null;
}

const MATCH_LABELS: Record<"email" | "phone", string> = {
  email: "e-mailadres",
  phone: "telefoonnummer",
};

export type ReapplicationNoteInput = {
  candidateName: string;
  matchedOn: "email" | "phone";
  /** Waar de nieuwe inzending vandaan kwam, in lopende tekst ("de talentpool"). */
  origin: string;
  /** Een opgeslagen CV dat NIET is gekoppeld omdat de kandidaat er al één had. */
  unattachedCvName?: string | null;
};

/**
 * De tekst die de recruiter te zien krijgt. Pure functie, en met opzet
 * uitleggend: wat er is gebeurd, waarop de match is gevonden en wat er
 * NIET automatisch is gedaan.
 */
export function buildReapplicationNote(input: ReapplicationNoteInput): {
  title: string;
  body: string;
} {
  const name = input.candidateName.trim() || "Onbekende kandidaat";
  const cvNote = input.unattachedCvName
    ? ` Let op: deze kandidaat had al een CV in het dossier — het nieuwe bestand (${input.unattachedCvName}) is wél opgeslagen maar niet aan het dossier gehangen.`
    : "";

  return {
    title: `Bestaande kandidaat opnieuw gesolliciteerd: ${name}`.slice(0, 300),
    body: (
      `Deze inzending via ${input.origin} hoort bij een bestaande kandidaat ` +
      `(gevonden op ${MATCH_LABELS[input.matchedOn]}). De sollicitatie/het CV is aan het bestaande ` +
      `dossier gehangen; bestaande kandidaatgegevens zijn NIET overschreven of samengevoegd.` +
      `${cvNote} Nakijken vóór je de kandidaat benadert, aan een sollicitatie koppelt of verder zet.`
    ).slice(0, 1000),
  };
}

// --- Database-kant ----------------------------------------------------------

export type CandidateDuplicate = {
  id: string;
  firstName: string;
  lastName: string;
  cvFileName: string | null;
  matchedOn: "email" | "phone";
};

const DUPLICATE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  cvFileName: true,
} as const;

/**
 * Hoeveel bestaande telefoonnummers we maximaal naast een inzending leggen.
 * Nummers staan in wisselende notaties in de database, dus het vergelijken
 * gebeurt in code op het genormaliseerde nummer; deze bovengrens houdt het werk
 * van een publieke inzending begrensd.
 */
const PHONE_SCAN_LIMIT = 5000;

/**
 * Zoek de bestaande kandidaat achter deze inzending. Alleen-lezen: deze functie
 * wijzigt niets en voegt niets samen.
 */
export async function findDuplicateCandidate(
  keys: CandidateDedupeKeys,
): Promise<CandidateDuplicate | null> {
  if (keys.email) {
    const hit = await db.candidate.findFirst({
      where: { email: { equals: keys.email, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
      select: DUPLICATE_SELECT,
    });
    if (hit) return { ...hit, matchedOn: "email" };
  }
  if (!keys.phone) return null;

  const rows = await db.candidate.findMany({
    where: { phone: { not: null } },
    orderBy: { createdAt: "asc" },
    take: PHONE_SCAN_LIMIT,
    select: { id: true, phone: true },
  });
  const match = pickDuplicateCandidate(
    rows.map((row) => ({ ...row, email: null })),
    { email: null, phone: keys.phone },
  );
  if (!match) return null;

  const hit = await db.candidate.findUnique({
    where: { id: match.candidate.id },
    select: DUPLICATE_SELECT,
  });
  return hit ? { ...hit, matchedOn: "phone" } : null;
}

export type IncomingCvFile = {
  cvFileName: string;
  cvOriginalName: string | null;
  cvMimeType: string | null;
  cvSize: number | null;
};

/**
 * Hang een nieuw CV aan een bestaande kandidaat, maar ALLEEN als het CV-veld nog
 * leeg is. De voorwaarde zit in de `where` van een `updateMany`, zodat ook twee
 * gelijktijdige inzendingen elkaars CV niet kunnen overschrijven. Geeft terug of
 * het bestand daadwerkelijk is gekoppeld.
 */
export async function attachCvToExistingCandidate(
  candidateId: string,
  cv: IncomingCvFile,
): Promise<boolean> {
  const { count } = await db.candidate.updateMany({
    where: { id: candidateId, cvFileName: null },
    data: cv,
  });
  return count > 0;
}

/**
 * Leg vast dat een bestaande kandidaat opnieuw heeft gesolliciteerd: een notitie
 * in het kandidaatdossier én een melding in de recruiter-meldingen (belletje +
 * cockpit). Beide zijn review-only — er wordt geen status gewijzigd, niets
 * verstuurd en niets samengevoegd.
 *
 * Best-effort: dit loopt ná het opslaan van de sollicitatie op een publiek
 * endpoint. Een mislukte notitie mag de inzending van de kandidaat niet alsnog
 * laten klappen; de sollicitatie zelf staat dan al in het overzicht.
 */
export async function recordCandidateReapplication(input: {
  candidate: CandidateDuplicate;
  origin: string;
  unattachedCvName?: string | null;
  href?: string;
  /** Wat de kandidaat zelf meestuurde (motivatie/bericht). Komt in de notitie
   *  terecht, want het veld `notes` van de bestaande kandidaat blijft ongemoeid. */
  message?: string | null;
}): Promise<void> {
  const note = buildReapplicationNote({
    candidateName: `${input.candidate.firstName} ${input.candidate.lastName}`.trim(),
    matchedOn: input.candidate.matchedOn,
    origin: input.origin,
    unattachedCvName: input.unattachedCvName ?? null,
  });
  const href = input.href ?? `/kandidaten/${input.candidate.id}`;
  const message = input.message?.trim();

  try {
    await db.crmNote.create({
      data: {
        type: "SYSTEM",
        candidateId: input.candidate.id,
        body: [note.title, note.body, message ? `Bericht van de kandidaat:\n${message}` : null]
          .filter(Boolean)
          .join("\n\n"),
      },
    });
  } catch {
    // zie boven — notitie is best-effort
  }
  try {
    await db.recruiterAlert.create({
      data: { type: "CANDIDATE_REAPPLIED", title: note.title, body: note.body, href },
    });
  } catch {
    // zie boven — melding is best-effort
  }
}
