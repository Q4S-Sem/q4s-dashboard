import { formatCurrency, formatHours, round2 } from "./utils";

// ---------------------------------------------------------------------------
// De mail aan de freelancer bij een afwijkende week — alleen de INHOUD.
//
// HR ziet op /verwerken/week waarom een week niet automatisch doorloopt, schrijft
// er een eigen bevinding bij en mailt de freelancer. Wat die mail zegt wordt hier
// opgebouwd: onderwerp, aanhef, de uitleg in gewone zinnen, de losse blokken
// (controlemeldingen + de geciteerde eigen bevinding), een samenvattingstabel en
// de ondertekening.
//
// PUUR en DETERMINISTISCH, net als src/lib/facturatie-detecties.ts en
// src/lib/weekverwerking.ts: geen Prisma, geen `Date.now()`, geen I/O en geen
// verzending. Wie de mail daadwerkelijk klaarzet of verstuurt is
// src/lib/email.ts (sendMail) — die blijft de enige uitgang.
//
// Er wordt hier NIETS aan bedragen gerekend behalve het verschil tussen twee
// meegegeven getallen; alle tarieven en weekbedragen komen kant-en-klaar binnen
// uit src/lib/toeslag.ts.
// ---------------------------------------------------------------------------

export type FreelancerDiscrepancyInput = {
  /** Volledige naam; alleen de voornaam komt in de aanhef. */
  freelancerName: string;
  /** "Week 12 · 2026" — zoals formatWeekLabel hem maakt. */
  weekLabel: string;
  /** Factuurnummer van de door de freelancer gestuurde factuur, als die er is. */
  invoiceNumber?: string | null;
  /** Uren zoals uitgelezen van de weekstaat. */
  hoursTimesheet: number | null;
  /** Uren zoals ze op de factuur staan (vaak onbekend). */
  hoursInvoice: number | null;
  /** Wat wij voor deze week verwachten te betalen (ex btw). */
  expectedAmount: number | null;
  /** Wat de freelancer factureerde (ex btw). */
  invoiceAmount: number | null;
  /** Het afgesproken inkooptarief per uur. */
  expectedRate: number | null;
  /** Het uurtarief dat uit de factuur volgt (bedrag ÷ uren). */
  impliedRate: number | null;
  /** Vrije regel over de kilometers, bijv. "312 km gemeld op de weekstaat". */
  kmInfo?: string | null;
  /** De automatische controlemeldingen, letterlijk zoals het scherm ze toont. */
  autoFlags: string[];
  /** Wat HR er zelf bij schrijft; komt als citaat in de mail. */
  eigenNotitie?: string | null;
};

/** Eén blok onder de lopende tekst; `quoted` = als citaat tonen. */
export type MailSectie = {
  title: string;
  lines: string[];
  quoted?: boolean;
};

export type FreelancerDiscrepancyEmail = {
  subject: string;
  greeting: string;
  /** De lopende tekst, alinea per alinea. */
  bodyLines: string[];
  /** Blokken onder de tekst (controlemeldingen, geciteerde eigen bevinding). */
  sections: MailSectie[];
  /** De samenvattingstabel; velden zonder waarde staan er niet in. */
  summary: { label: string; value: string }[];
  signature: string;
};

/** Alleen echte getallen tellen: null, NaN en Infinity zijn "onbekend". */
function isNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Lege tekst, spaties of `undefined` → gewoon niets. */
function schoon(value: string | null | undefined): string | null {
  const tekst = typeof value === "string" ? value.trim() : "";
  return tekst === "" ? null : tekst;
}

/** Uren als "38 uur" — met de Nederlandse komma van formatHours. */
function uren(value: number): string {
  return `${formatHours(value)} uur`;
}

/**
 * Verschillen we op centen/honderdsten? Twee bedragen (of urenaantallen) die na
 * afronding gelijk zijn, zijn geen afwijking om iemand over te mailen.
 */
function wijktAf(a: number, b: number): boolean {
  return Math.abs(round2(a - b)) >= 0.01;
}

/**
 * Stel de mail aan de freelancer op: waarom deze week niet automatisch doorliep,
 * wat wij zien tegenover wat hij stuurde, en wat we van hem vragen.
 *
 * De toon is bewust vriendelijk en zakelijk — het is bijna altijd een vergissing,
 * geen verwijt. Onbekende gegevens worden weggelaten in plaats van als "—"
 * getoond: liever een korte mail dan een tabel vol streepjes.
 */
export function buildFreelancerDiscrepancyEmail(
  input: FreelancerDiscrepancyInput,
): FreelancerDiscrepancyEmail {
  const week = schoon(input.weekLabel);
  const nummer = schoon(input.invoiceNumber);
  const km = schoon(input.kmInfo);
  const notitie = schoon(input.eigenNotitie);

  const urenStaat = isNum(input.hoursTimesheet) ? input.hoursTimesheet : null;
  const urenFactuur = isNum(input.hoursInvoice) ? input.hoursInvoice : null;
  const verwachtBedrag = isNum(input.expectedAmount) ? input.expectedAmount : null;
  const factuurBedrag = isNum(input.invoiceAmount) ? input.invoiceAmount : null;
  const afgesprokenTarief = isNum(input.expectedRate) ? input.expectedRate : null;
  const factuurTarief = isNum(input.impliedRate) ? input.impliedRate : null;

  const bedragVerschil =
    verwachtBedrag !== null && factuurBedrag !== null && wijktAf(factuurBedrag, verwachtBedrag)
      ? round2(factuurBedrag - verwachtBedrag)
      : null;
  const urenVerschil =
    urenStaat !== null && urenFactuur !== null && wijktAf(urenFactuur, urenStaat)
      ? round2(urenFactuur - urenStaat)
      : null;
  const tariefVerschil =
    afgesprokenTarief !== null && factuurTarief !== null && wijktAf(factuurTarief, afgesprokenTarief);

  // ---- Onderwerp + aanhef -------------------------------------------------
  const onderwerpKop = nummer ? `Vraag over je factuur ${nummer}` : "Vraag over je weekstaat";
  const subject = week ? `${onderwerpKop} — ${week}` : onderwerpKop;

  const voornaam = schoon(input.freelancerName)?.split(/\s+/)[0] ?? null;
  const greeting = voornaam ? `Beste ${voornaam},` : "Beste,";

  // ---- De lopende tekst ---------------------------------------------------
  const weekTekst = week ?? "deze week";
  const bodyLines: string[] = [
    nummer
      ? `Bedankt voor je factuur ${nummer} voor ${weekTekst}.`
      : `Bedankt voor het insturen van je uren voor ${weekTekst}.`,
  ];

  const heeftVerschil = bedragVerschil !== null || urenVerschil !== null || tariefVerschil;
  bodyLines.push(
    heeftVerschil
      ? "Bij het verwerken viel ons een verschil op tussen wat wij in onze administratie hebben staan en wat jij hebt ingestuurd."
      : "Bij het verwerken van deze week viel ons iets op dat we graag even met je afstemmen.",
  );

  if (bedragVerschil !== null) {
    bodyLines.push(
      `Volgens onze administratie komen wij voor ${weekTekst} uit op ${formatCurrency(
        verwachtBedrag as number,
      )}, terwijl er ${formatCurrency(factuurBedrag as number)} in rekening is gebracht — een verschil van ${formatCurrency(
        Math.abs(bedragVerschil),
      )}.`,
    );
  }

  if (urenVerschil !== null) {
    bodyLines.push(
      `Op je weekstaat staan ${uren(urenStaat as number)}, op je factuur ${uren(
        urenFactuur as number,
      )} — een verschil van ${uren(Math.abs(urenVerschil))}.`,
    );
  }

  if (tariefVerschil) {
    bodyLines.push(
      `Het uurtarief komt daarmee uit op ${formatCurrency(
        factuurTarief as number,
      )} per uur, terwijl we ${formatCurrency(afgesprokenTarief as number)} per uur hebben afgesproken.`,
    );
  }

  if (km) bodyLines.push(`Over de kilometers: ${km}. Wil je die ook even nakijken?`);

  bodyLines.push(
    "Zou je dit willen nakijken en ons zo nodig een aangepaste weekstaat of factuur sturen? Klopt onze administratie niet, laat het dan gerust weten — dan zoeken we het samen uit.",
    "Zodra we je reactie hebben, verwerken we deze week meteen verder.",
  );

  // ---- De blokken eronder -------------------------------------------------
  const sections: MailSectie[] = [];

  const meldingen = (Array.isArray(input.autoFlags) ? input.autoFlags : [])
    .map((f) => schoon(f))
    .filter((f): f is string => f !== null);
  if (meldingen.length > 0) {
    sections.push({ title: "Wat onze controle opmerkte", lines: meldingen });
  }

  if (notitie) {
    sections.push({
      title: "Onze eigen bevinding",
      // Regel voor regel, zonder lege regels — zo blijft het citaat compact.
      lines: notitie
        .split(/\r?\n/)
        .map((r) => r.trim())
        .filter(Boolean),
      quoted: true,
    });
  }

  // ---- De samenvattingstabel ---------------------------------------------
  const summary: { label: string; value: string }[] = [];
  const rij = (label: string, value: string | null) => {
    if (value !== null) summary.push({ label, value });
  };

  rij("Week", week);
  rij("Factuurnummer", nummer);
  rij("Uren op de weekstaat", urenStaat !== null ? uren(urenStaat) : null);
  rij("Uren op je factuur", urenFactuur !== null ? uren(urenFactuur) : null);
  rij("Verwacht bedrag", verwachtBedrag !== null ? formatCurrency(verwachtBedrag) : null);
  rij("Bedrag op je factuur", factuurBedrag !== null ? formatCurrency(factuurBedrag) : null);
  rij("Verschil", bedragVerschil !== null ? formatCurrency(bedragVerschil) : null);
  rij(
    "Afgesproken uurtarief",
    afgesprokenTarief !== null ? `${formatCurrency(afgesprokenTarief)} p/u` : null,
  );
  rij(
    "Uurtarief op je factuur",
    tariefVerschil && factuurTarief !== null ? `${formatCurrency(factuurTarief)} p/u` : null,
  );
  rij("Kilometers", km);

  return {
    subject,
    greeting,
    bodyLines,
    sections,
    summary,
    signature: "Met vriendelijke groet,\nTeam Q4S",
  };
}
