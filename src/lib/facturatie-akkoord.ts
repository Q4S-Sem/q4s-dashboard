import { db } from "./db";
import { confirmInboxItem } from "./inbox-confirm";
import { createSalesInvoice } from "./invoicing";
import { groupVerkoopByClient, type VerkoopbareWeek } from "./verkoop-groepering";
import { beoordeelBestaandeUrenstaat, BESTAANDE_URENSTAAT_NOTITIE } from "./urenstaat-hergebruik";
import { formatHours, round2 } from "./utils";
import { wekenInPeriode } from "./facturatie-volgende";
import { getWeekDossier, getWeekOverview, type WeekDossier } from "./facturatie-week";
import { isoMaandag, periodeStand, periodeVan, type FactuurPeriode } from "./factuur-periode";

// ---------------------------------------------------------------------------
// "Akkoord → verkoopfactuur": de ENIGE plek waar een week van "nagekeken" naar
// "vastgelegd" gaat. Gedeeld door de knop op het dossier (één week) en de knop
// "N groene weken verwerken" op het weekoverzicht (meerdere weken).
//
// REGELS DIE HIER HARD IN ZITTEN:
//  • De controle wordt ALTIJD server-side opnieuw gedraaid (getWeekDossier →
//    evaluateFacturatieWeek). Wat de browser meestuurt is alleen WELKE week;
//    nooit of hij goed was.
//  • Een week met een niet-geaccepteerde fout gaat niet door.
//  • Optie A: de factuur van de freelancer ÍS de inkoop → die wordt op APPROVED
//    gezet (ReceivedInvoice). Er wordt NOOIT een self-billing PurchaseInvoice
//    gemaakt.
//  • Idempotent: een week die al op een verkoopfactuur staat wordt overgeslagen,
//    een bestaande urenstaat wordt hergebruikt (de bestaande uren blijven
//    leidend) en een al betaalde ontvangen factuur wordt nooit teruggezet.
//  • De verkoopfactuur komt als CONCEPT (DRAFT) in /facturen — er wordt niets
//    verstuurd en niets betaald.
//
// Er wordt hier geen enkel bedrag zelf gerekend: createSalesInvoice
// (src/lib/invoicing.ts) bouwt de regels, en dat leunt op src/lib/toeslag.ts.
// ---------------------------------------------------------------------------

export type OvergeslagenWeek = { naam: string; reden: string };

export type AkkoordSamenvatting = {
  /** Hoeveel weken daadwerkelijk zijn vastgelegd. */
  verwerkt: number;
  overgeslagen: OvergeslagenWeek[];
  /** De concept-verkoopfacturen die eruit kwamen. */
  facturen: { id: string; nummer: string | null; klant: string }[];
  /** Weken die klaarliggen voor een verzamelfactuur die nog niet compleet is. */
  verzameld: string[];
  waarschuwingen: string[];
};

/** Een week die (a) en (b) doorkwam en nog op de verkoopfactuur moet. */
type KlaarVoorVerkoop = VerkoopbareWeek & { naam: string };

/** "YYYY-MM-DD" van een Date, zoals confirmInboxItem de weekStart wil. */
function datumVeld(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Stap (a): zorg dat er een urenstaat is voor deze week. Bestaat hij al, dan
 * wordt die HERGEBRUIKT (bestaande uren winnen, nooit stil overschrijven);
 * anders wordt de uitgelezen scan bevestigd via `confirmInboxItem`.
 */
async function zorgVoorUrenstaat(
  dossier: WeekDossier,
): Promise<{ ok: true; timesheetId: string; waarschuwingen: string[] } | { ok: false; reden: string }> {
  const { row, week, invoer } = dossier;
  const placementId = row.placementId;
  if (!placementId) return { ok: false, reden: "geen actieve plaatsing" };

  // Er ligt al een urenstaat voor deze plaatsing + week.
  if (row.timesheetId) {
    const bestaand = await db.timesheet.findUnique({
      where: { id: row.timesheetId },
      include: {
        entries: { select: { hours: true } },
        invoiceLine: { select: { id: true } },
        purchaseLine: { select: { id: true } },
      },
    });
    if (!bestaand) return { ok: false, reden: "de urenstaat van deze week is intussen verdwenen" };
    const oordeel = beoordeelBestaandeUrenstaat({
      status: bestaand.status,
      verkoopRegelId: bestaand.invoiceLine?.id ?? null,
      inkoopRegelId: bestaand.purchaseLine?.id ?? null,
    });
    if (oordeel.alGefactureerd) return { ok: false, reden: oordeel.reden };

    const waarschuwingen = [BESTAANDE_URENSTAAT_NOTITIE];
    const bestaandeUren = round2(bestaand.entries.reduce((s, e) => s + e.hours, 0));
    const schermUren = round2(
      invoer.dagUren.reduce((s, h) => s + (Number(String(h).replace(",", ".")) || 0), 0),
    );
    if (Math.abs(bestaandeUren - schermUren) > 0.01) {
      waarschuwingen.push(
        `De bestaande urenstaat staat op ${formatHours(bestaandeUren)} u; op het scherm stond ${formatHours(
          schermUren,
        )} u. De bestaande uren zijn aangehouden — corrigeer ze zo nodig in het dossier van deze week.`,
      );
    }
    if (oordeel.eerstGoedkeuren) {
      // Nog niet goedgekeurd → createSalesInvoice weigert hem. Zelf goedkeuren
      // mag hier: een mens heeft net akkoord gegeven op precies deze week.
      await db.timesheet.update({ where: { id: bestaand.id }, data: { status: "APPROVED" } });
      waarschuwingen.push("De bestaande urenstaat stond nog op concept en is nu goedgekeurd.");
    }
    // De scan hoort voortaan bij die urenstaat, anders blijft hij openstaan.
    if (row.inboxId) {
      await db.timesheetInbox
        .update({
          where: { id: row.inboxId },
          data: {
            status: "CONFIRMED",
            consultantId: row.consultantId,
            placementId,
            timesheetId: bestaand.id,
            extractedWeekStart: week.monday,
            draftJson: null,
            wachtkamerSince: null,
            wachtkamerReason: null,
          },
        })
        .catch(() => {
          waarschuwingen.push(
            "Deze scan is niet aan de bestaande urenstaat gekoppeld — er hing er al één aan. Ruim 'm op in de timesheet-inbox als hij dubbel is.",
          );
        });
    }
    return { ok: true, timesheetId: bestaand.id, waarschuwingen };
  }

  if (!row.inboxId) return { ok: false, reden: "er is geen urenstaat voor deze week ontvangen" };

  const bevestigd = await confirmInboxItem({
    id: row.inboxId,
    placementId,
    weekStart: datumVeld(week.monday),
    hours: invoer.dagUren,
    overtimeHours: invoer.overuren,
    kilometers: invoer.kilometers,
    requirePending: true,
  });
  if (!bevestigd.ok) {
    const redenen: Record<string, string> = {
      id: "er is geen scan gekozen",
      missing: "de scan staat niet meer in de inbox",
      state: "deze week is intussen al verwerkt",
      exists: "er bestaat al een urenstaat voor deze plaatsing en week",
      match: "de plaatsing is niet geldig",
      week: "de week (maandag) ontbreekt",
      hours: "er staan geen uren op de staat",
    };
    return { ok: false, reden: redenen[bevestigd.error] ?? "de urenstaat kon niet vastgelegd worden" };
  }
  const waarschuwingen =
    bevestigd.kmSource === "factuur"
      ? ["De kilometers stonden niet op de urenstaat en zijn overgenomen van zijn eigen factuur."]
      : [];
  return { ok: true, timesheetId: bevestigd.timesheetId, waarschuwingen };
}

/**
 * Stap (b), Optie A: zijn eigen factuur IS de inkoop → op APPROVED zetten en
 * expliciet aan deze week koppelen. Een al betaalde (PAID) factuur blijft PAID.
 */
async function keurInkoopGoed(dossier: WeekDossier): Promise<string[]> {
  const { row, week } = dossier;
  if (!row.isZZP) return [];
  if (!row.receivedInvoiceId) {
    return [
      "Er is nog geen factuur van de freelancer geregistreerd — de inkoop van deze week staat dus nog open.",
    ];
  }
  const inv = await db.receivedInvoice.findUnique({
    where: { id: row.receivedInvoiceId },
    select: { id: true, status: true, periodStart: true, periodEnd: true },
  });
  if (!inv) return ["De ontvangen factuur van deze week is intussen verdwenen."];
  // Verzamelfactuur (meerdere weken) NIET aan één week vastpinnen, anders
  // verdwijnt hij uit de andere weken die hij ook dekt.
  const verzamel = wekenInPeriode(inv.periodStart, inv.periodEnd).length > 1;
  await db.receivedInvoice.update({
    where: { id: inv.id },
    data: {
      weekKey: verzamel ? null : week.key,
      countForVat: true,
      // Nooit een betaalde factuur terugzetten naar "gecontroleerd".
      ...(inv.status === "PAID" ? {} : { status: "APPROVED" }),
    },
  });
  return [];
}

/**
 * Leg één of meer groene weken vast. Zonder `placementIds` worden ALLE regels
 * van die week genomen die de controle groen noemt — precies de knop "N groene
 * weken verwerken", maar het oordeel komt hier opnieuw uit de machine.
 */
export async function akkoordWeken(opts: {
  weekKey: string;
  placementIds?: string[];
  now?: Date;
}): Promise<AkkoordSamenvatting> {
  const now = opts.now ?? new Date();
  const gekozen = opts.placementIds?.filter(Boolean) ?? null;

  const overzicht = await getWeekOverview(opts.weekKey, now);
  // Bij de bulkknop: alleen de groene weken die NIET in de wachtkamer staan — een
  // geparkeerde week wacht bewust op een reactie van de freelancer. Bij een
  // expliciete keuze (de knop op het dossier) beslist de mens zelf.
  const kandidaten = overzicht.rows.filter((r) =>
    r.placementId
      ? gekozen === null
        ? r.status === "KLAAR" && !r.wachtkamerSinds && !r.gefactureerd
        : gekozen.includes(r.placementId)
      : false,
  );

  const overgeslagen: OvergeslagenWeek[] = [];
  const waarschuwingen: string[] = [];
  const verkoopbaar: KlaarVoorVerkoop[] = [];
  let verwerkt = 0;

  for (const kandidaat of kandidaten) {
    const placementId = kandidaat.placementId;
    if (!placementId) continue;

    // ALTIJD vers beoordelen: de browser bepaalt niet of een week goed was.
    const dossier = await getWeekDossier(placementId, opts.weekKey, now);
    if (!dossier) {
      overgeslagen.push({ naam: kandidaat.naam, reden: "de plaatsing bestaat niet meer" });
      continue;
    }
    if (dossier.row.gefactureerd) {
      overgeslagen.push({
        naam: dossier.row.naam,
        reden: `staat al op verkoopfactuur ${dossier.row.verkoopFactuurNummer ?? ""}`.trim(),
      });
      continue;
    }
    if (dossier.akkoordGeblokkeerd) {
      overgeslagen.push({ naam: dossier.row.naam, reden: dossier.akkoordGeblokkeerd });
      continue;
    }

    const urenstaat = await zorgVoorUrenstaat(dossier);
    if (!urenstaat.ok) {
      overgeslagen.push({ naam: dossier.row.naam, reden: urenstaat.reden });
      continue;
    }
    waarschuwingen.push(...urenstaat.waarschuwingen.map((w) => `${dossier.row.naam}: ${w}`));
    waarschuwingen.push(
      ...(await keurInkoopGoed(dossier)).map((w) => `${dossier.row.naam}: ${w}`),
    );
    verwerkt++;

    // De verse stand van de urenstaat bepaalt of hij op een factuur mag.
    const vers = await db.timesheet.findUnique({
      where: { id: urenstaat.timesheetId },
      select: {
        id: true,
        status: true,
        invoiceLine: { select: { id: true } },
        placement: { select: { clientId: true, client: { select: { companyName: true } } } },
      },
    });
    if (!vers) continue;
    verkoopbaar.push({
      naam: dossier.row.naam,
      timesheetId: vers.id,
      status: vers.status,
      hasSales: Boolean(vers.invoiceLine),
      clientId: vers.placement.clientId,
      clientName: vers.placement.client?.companyName ?? null,
    });
  }

  // Eén concept-verkoopfactuur per klant (dezelfde bundeling als de bestaande
  // auto-doorloop gebruikt), nooit één factuur per week per persoon.
  const facturen: AkkoordSamenvatting["facturen"] = [];
  const { groups, skipped } = groupVerkoopByClient(verkoopbaar);
  if (skipped > 0) {
    waarschuwingen.push(
      `${skipped} ${skipped === 1 ? "week kon" : "weken konden"} niet op een verkoopfactuur (geen klant gekoppeld, niet goedgekeurd of al gefactureerd).`,
    );
  }
  // Verzamelfactuur: per klant pas een factuur als de maand / 4 weken compleet is.
  const verzameld: string[] = [];
  for (const groep of groups) {
    const r = await factureerCompletePeriodes(groep.clientId, now);
    facturen.push(...r.facturen);
    verzameld.push(...r.verzameld);
    waarschuwingen.push(...r.waarschuwingen);
  }

  return { verwerkt, overgeslagen, facturen, verzameld, waarschuwingen };
}

/** Goedgekeurde, nog niet gefactureerde weken van één klant, per factuurperiode. */
export async function openPeriodes(clientId: string) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      companyName: true,
      billingCycle: true,
      placements: {
        where: { status: { not: "ARCHIVED" } },
        select: {
          startDate: true,
          endDate: true,
          status: true,
          timesheets: { select: { id: true, weekStart: true, status: true, invoiceLine: { select: { id: true } } } },
        },
      },
    },
  });
  if (!client) return null;
  const periodes = new Map<string, { periode: FactuurPeriode; timesheetIds: string[] }>();
  for (const pl of client.placements) {
    for (const t of pl.timesheets) {
      if (t.status !== "APPROVED" || t.invoiceLine) continue;
      const periode = periodeVan(t.weekStart, client.billingCycle);
      const p = periodes.get(periode.key) ?? { periode, timesheetIds: [] };
      p.timesheetIds.push(t.id);
      periodes.set(periode.key, p);
    }
  }
  const plaatsingen = client.placements.map((pl) => ({
    startDate: pl.startDate,
    // Beëindigd zonder einddatum: loopt tot zijn laatste urenstaat (anders nooit compleet).
    endDate:
      pl.endDate ??
      (pl.status === "ENDED" && pl.timesheets.length
        ? new Date(Math.max(...pl.timesheets.map((t) => t.weekStart.getTime())))
        : null),
    goedgekeurd: new Set(
      pl.timesheets.filter((t) => t.status === "APPROVED" || t.status === "INVOICED").map((t) => isoMaandag(periodeVan(t.weekStart, "WEEK").weken[0])),
    ),
  }));
  return {
    klant: client.companyName,
    cycle: client.billingCycle,
    periodes: [...periodes.values()].map((p) => ({ ...p, ...periodeStand(p.periode, plaatsingen) })),
  };
}

/**
 * Maak de verkoopfactuur voor elke COMPLETE periode van deze klant (of, met
 * `forceer`, voor die ene periode ook als hij nog niet compleet is — bv. iemand
 * is halverwege gestopt). Incomplete periodes blijven verzamelen.
 */
export async function factureerCompletePeriodes(
  clientId: string,
  now: Date = new Date(),
  forceer?: string,
): Promise<{ facturen: AkkoordSamenvatting["facturen"]; verzameld: string[]; waarschuwingen: string[] }> {
  const facturen: AkkoordSamenvatting["facturen"] = [];
  const verzameld: string[] = [];
  const waarschuwingen: string[] = [];
  const open = await openPeriodes(clientId);
  if (!open) return { facturen, verzameld, waarschuwingen };
  for (const p of open.periodes) {
    const nu = open.cycle === "WEEK" || p.compleet || p.periode.key === forceer;
    if (!nu) {
      verzameld.push(`${open.klant}: ${p.periode.label} — ${p.binnen} van ${p.nodig} weken binnen, de factuur volgt als alles compleet is.`);
      continue;
    }
    try {
      const res = await createSalesInvoice({ clientId, timesheetIds: p.timesheetIds, issueDate: now, notes: null });
      if (!res.ok) {
        waarschuwingen.push(`De verkoopfactuur voor ${open.klant} (${p.periode.label}) is niet gemaakt: ${res.error}`);
        continue;
      }
      const inv = await db.invoice.findUnique({ where: { id: res.invoiceId }, select: { number: true } });
      facturen.push({ id: res.invoiceId, nummer: inv?.number ?? null, klant: `${open.klant} · ${p.periode.label}` });
    } catch (e) {
      waarschuwingen.push(
        `De verkoopfactuur voor ${open.klant} is niet gemaakt (${e instanceof Error ? e.message : "onbekende fout"}). De uren staan wel vast.`,
      );
    }
  }
  return { facturen, verzameld, waarschuwingen };
}

/** Eén week vastleggen — de knop op het dossier. */
export async function akkoordWeek(
  placementId: string,
  weekKey: string,
  now: Date = new Date(),
): Promise<AkkoordSamenvatting> {
  return akkoordWeken({ weekKey, placementIds: [placementId], now });
}
