import type { WeekSlot } from "./week-koppeling";

// ---------------------------------------------------------------------------
// PERSOON EERST — de ingang van de wizard "Week verwerken" (/verwerken/nieuw).
//
// De eigenaar kijkt per PERSOON, niet per los bestand: eerst "voor wie ga ik de
// week verwerken", dan pas welke week. Deze module maakt van de twee platte
// lijsten die de pagina ophaalt (actieve plaatsingen + openstaande weekstaten
// uit de timesheet-inbox) één lijst met precies ÉÉN rij per persoon:
//
//   - meerdere plaatsingen  → meerdere REGELS onder diezelfde persoon;
//   - meerdere open weken   → meerdere WEKEN onder diezelfde persoon.
//
// Dezelfde persoon mag dus nooit twee keer in de keuzelijst staan — dat was
// precies wat aan de oude, platte inbox-lijst verwarrend was.
//
// PUUR, net als src/lib/week-wizard.ts: geen Prisma, geen `new Date()`, geen
// I/O. Alles wat met "nu" te maken heeft (de weekstrook) komt als parameter
// binnen, zodat de server, het scherm en de tests (tests/wizard-personen.test.ts)
// hetzelfde uitrekenen.
//
// Er wordt hier NIETS met geld gedaan: tarieven gaan onaangeroerd mee in
// `config`, zodat de kaart ze alleen hoeft te tonen (formatCurrency).
// ---------------------------------------------------------------------------

/**
 * Het minimum dat deze module van een plaatsing nodig heeft. Bewust structureel
 * (geen import uit de app-map): `WizardPlaatsing` past hier vanzelf op, en de
 * tests kunnen met een handvol velden werken.
 */
export type PlaatsingBasis = {
  id: string;
  consultantId: string;
  consultantNaam: string;
  klantNaam: string | null;
  functie: string;
  config: { costRate: number; chargeRate: number };
};

/** Het minimum van een openstaande weekstaat uit de timesheet-inbox. */
export type WeekstaatBasis = {
  id: string;
  /** Naam zoals gematcht of uitgelezen — de terugval als er geen plaatsing is. */
  naam: string;
  /** Gematchte medewerker, of null als de naam (nog) niet herkend is. */
  consultantId: string | null;
  /** Gematchte plaatsing ("" = nog niet bepaald). */
  placementId: string;
};

/** Eén plaatsing onder een persoon, met wat er voor die plaatsing openstaat. */
export type PersoonPlaatsing<P extends PlaatsingBasis = PlaatsingBasis> = {
  plaatsing: P;
  /** Aantal openstaande weekstaten die aan déze plaatsing gematcht zijn. */
  openstaand: number;
  /** De laatst verwerkte week van deze plaatsing binnen de strook (null = geen). */
  laatsteVerwerkteWeek: WeekSlot | null;
};

/** Eén persoon in de keuzelijst: wie, waar, wat staat er open. */
export type PersoonRij<
  P extends PlaatsingBasis = PlaatsingBasis,
  T extends WeekstaatBasis = WeekstaatBasis,
> = {
  consultantId: string;
  naam: string;
  /** Zijn actieve plaatsingen, in de volgorde waarin ze binnenkwamen. */
  plaatsingen: PersoonPlaatsing<P>[];
  /** Al zijn openstaande weekstaten, over zijn plaatsingen heen. */
  openstaand: T[];
  /** Ontdubbelde klantnamen — voor de ondertitel op de kaart. */
  klanten: string[];
  /** De laatst verwerkte week over al zijn plaatsingen (null = nog geen). */
  laatsteVerwerkteWeek: WeekSlot | null;
  /** Genormaliseerde zoektekst (naam + klanten + functies), voor {@link filterPersonen}. */
  zoek: string;
};

export type PersonenOverzicht<
  P extends PlaatsingBasis = PlaatsingBasis,
  T extends WeekstaatBasis = WeekstaatBasis,
> = {
  /** Eén rij per persoon; te verwerken weken eerst, daarna op naam. */
  personen: PersoonRij<P, T>[];
  /**
   * Weekstaten waar geen persoon bij te vinden was (naam niet herkend én geen
   * bekende plaatsing). Die verdwijnen bewust NIET: de mens kiest er zelf een
   * plaatsing bij, net als in de oude lijst.
   */
  ongekoppeld: T[];
};

/** Tekst zonder accenten of hoofdletters — "Sören" en "soren" moeten matchen. */
function normaliseer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * De laatste (meest recente) week uit de strook die al verwerkt is. De strook
 * loopt van oud naar nieuw (zie `recenteWeken`), dus we zoeken van achteren.
 *
 * Kijkt per definitie niet verder terug dan de strook zelf: is er langer dan
 * tien weken niets verwerkt, dan is het antwoord `null` — "niet recent" is
 * precies wat de eigenaar wil zien.
 */
export function laatsteVerwerkteWeek(
  weken: readonly WeekSlot[] | null | undefined,
  sleutels: Iterable<string> | null | undefined,
): WeekSlot | null {
  const lijst = weken ?? [];
  const set = new Set(sleutels ?? []);
  if (lijst.length === 0 || set.size === 0) return null;
  for (let i = lijst.length - 1; i >= 0; i--) {
    if (set.has(lijst[i].key)) return lijst[i];
  }
  return null;
}

/** Wat er tijdens het bouwen per persoon verzameld wordt. */
type Verzameling<P extends PlaatsingBasis, T extends WeekstaatBasis> = {
  consultantId: string;
  naam: string;
  /** Kwam de naam van een plaatsing? Die wint van een naam op een scan. */
  naamUitPlaatsing: boolean;
  plaatsingen: P[];
  openstaand: T[];
};

/**
 * Bouw de keuzelijst: alle actieve plaatsingen én alle openstaande weekstaten
 * samengevoegd tot één rij per persoon.
 *
 * Een weekstaat hoort bij de persoon van zijn `consultantId`; is die niet
 * gematcht, dan valt hij terug op de eigenaar van zijn `placementId`. Lukt geen
 * van beide, dan komt hij in `ongekoppeld` terecht.
 *
 * Iemand die alleen uit de inbox komt (wel een `consultantId`, geen actieve
 * plaatsing) krijgt gewoon een rij zonder plaatsingen — anders zou zijn week
 * onvindbaar worden.
 */
export function bouwPersoonRijen<
  P extends PlaatsingBasis = PlaatsingBasis,
  T extends WeekstaatBasis = WeekstaatBasis,
>(input: {
  plaatsingen?: readonly P[] | null;
  weekstaten?: readonly T[] | null;
  weekstrook?: {
    weken?: readonly WeekSlot[] | null;
    verwerktPerPlaatsing?: Record<string, string[]> | null;
  } | null;
}): PersonenOverzicht<P, T> {
  const plaatsingen = input.plaatsingen ?? [];
  const weekstaten = input.weekstaten ?? [];
  const weken = input.weekstrook?.weken ?? [];
  const verwerkt = input.weekstrook?.verwerktPerPlaatsing ?? {};

  const perPersoon = new Map<string, Verzameling<P, T>>();
  const perPlaatsing = new Map<string, P>();

  function persoon(consultantId: string, naam: string, uitPlaatsing: boolean) {
    const bestaand = perPersoon.get(consultantId);
    if (bestaand) {
      // De naam van een plaatsing is de administratieve naam; die wint van wat
      // er op een scan of in een bestandsnaam stond.
      if (uitPlaatsing && !bestaand.naamUitPlaatsing) {
        bestaand.naam = naam;
        bestaand.naamUitPlaatsing = true;
      }
      return bestaand;
    }
    const verse: Verzameling<P, T> = {
      consultantId,
      naam,
      naamUitPlaatsing: uitPlaatsing,
      plaatsingen: [],
      openstaand: [],
    };
    perPersoon.set(consultantId, verse);
    return verse;
  }

  for (const p of plaatsingen) {
    if (!p?.id || !p.consultantId) continue;
    perPlaatsing.set(p.id, p);
    persoon(p.consultantId, p.consultantNaam, true).plaatsingen.push(p);
  }

  const ongekoppeld: T[] = [];
  for (const w of weekstaten) {
    if (!w) continue;
    const viaPlaatsing = w.placementId ? perPlaatsing.get(w.placementId) : undefined;
    const consultantId = w.consultantId || viaPlaatsing?.consultantId || "";
    if (!consultantId) {
      ongekoppeld.push(w);
      continue;
    }
    persoon(consultantId, viaPlaatsing?.consultantNaam ?? w.naam, Boolean(viaPlaatsing)).openstaand.push(
      w,
    );
  }

  const personen: PersoonRij<P, T>[] = [];
  for (const v of perPersoon.values()) {
    const rijen: PersoonPlaatsing<P>[] = v.plaatsingen.map((p) => ({
      plaatsing: p,
      openstaand: v.openstaand.filter((w) => w.placementId === p.id).length,
      laatsteVerwerkteWeek: laatsteVerwerkteWeek(weken, verwerkt[p.id] ?? []),
    }));

    const klanten: string[] = [];
    for (const p of v.plaatsingen) {
      const klant = p.klantNaam?.trim();
      if (klant && !klanten.includes(klant)) klanten.push(klant);
    }

    // De laatst verwerkte week van de PERSOON: alle weken van al zijn
    // plaatsingen op één hoop, en daarvan de meest recente.
    const alleSleutels = v.plaatsingen.flatMap((p) => verwerkt[p.id] ?? []);

    personen.push({
      consultantId: v.consultantId,
      naam: v.naam,
      plaatsingen: rijen,
      openstaand: v.openstaand,
      klanten,
      laatsteVerwerkteWeek: laatsteVerwerkteWeek(weken, alleSleutels),
      zoek: normaliseer([v.naam, ...klanten, ...v.plaatsingen.map((p) => p.functie)].join(" ")),
    });
  }

  // Wie iets open heeft staan eerst (de meeste weken bovenaan), daarna gewoon op
  // naam — zo staat het werk van vandaag altijd links boven.
  personen.sort((a, b) => {
    if (a.openstaand.length !== b.openstaand.length) {
      return b.openstaand.length - a.openstaand.length;
    }
    return a.naam.localeCompare(b.naam, "nl", { sensitivity: "base" });
  });

  return { personen, ongekoppeld };
}

/**
 * Filter de keuzelijst op naam, klant of functie. Elk los woord moet ergens in
 * de rij voorkomen ("jan shell" = Jan bij Shell), hoofdletters en accenten doen
 * niet mee. Lege zoekterm = iedereen.
 */
export function filterPersonen<R extends { zoek: string }>(
  personen: readonly R[] | null | undefined,
  zoekterm: string | null | undefined,
): R[] {
  const lijst = personen ?? [];
  const termen = normaliseer(zoekterm ?? "").split(/\s+/).filter(Boolean);
  if (termen.length === 0) return [...lijst];
  return lijst.filter((p) => termen.every((t) => p.zoek.includes(t)));
}

/** "2 weken te verwerken" — de statushint op de personenkaart. */
export function openstaandLabel(aantal: number): string {
  const n = Number.isFinite(aantal) && aantal > 0 ? Math.trunc(aantal) : 0;
  if (n === 0) return "geen open weken";
  return n === 1 ? "1 week te verwerken" : `${n} weken te verwerken`;
}

/** "laatst verwerkt: week 34", of eerlijk "nog niets verwerkt". */
export function laatsteVerwerktLabel(week: WeekSlot | null | undefined): string {
  if (!week) return "nog niets verwerkt";
  return `laatst verwerkt: week ${week.isoWeek}`;
}
