/**
 * "Verwijderen & resetten vanaf Week verwerken" — de databasekant.
 *
 * Een mens ontdekt een fout (verkeerde uren, verkeerde factuur) en wil de hele
 * week terugdraaien zodat 'ie 'm opnieuw kan doen. Dat betekent: de urenstaat
 * van die week weg, de concept-verkoopfactuur weg, de ontvangen (inkoop)factuur
 * weg, en de uitgelezen weekstaat terug in de inbox zodat hij weer bovenaan in
 * "Week verwerken" staat.
 *
 * Beschermd (nooit stilzwijgend weg):
 *  - een verkoopfactuur die al vrijgegeven/verstuurd/betaald is (READY/SENT/PAID)
 *    → de hele reset stopt met "locked" (crediteren i.p.v. verwijderen);
 *  - een betaalde ontvangen factuur (PAID) → idem.
 *
 * Alles gebeurt in één Prisma-transactie, in FK-veilige volgorde. De
 * bijbehorende bestanden (geüploade factuur-PDF) worden ná de transactie
 * opgeruimd.
 */

import { db } from "./db";
import { deleteReceivedUpload } from "./uploads";
import { formatWeekLabel } from "./utils";
import {
  mayDeleteConceptInvoice,
  isReceivedInvoiceResettable,
  type WeekResetResult,
} from "./week-reset-core";

export type WeekResetOutcome = {
  result: WeekResetResult;
  /** Reden bij "locked" — welke factuur blokkeert (voor de melding). */
  lockedReason?: string;
  /** Menselijke weeklabel(s) die geraakt zijn. */
  weekLabel?: string;
  /** Verwijderd verkoopfactuurnummer (voor de melding), indien er een was. */
  deletedInvoiceNumber?: string | null;
  /** De consultant, zodat de UI kan terugkeren/filteren. */
  consultantId?: string | null;
};

/**
 * Zet één urenstaat (timesheet) volledig terug: verwijder de concept-
 * verkoopfactuur en de gekoppelde ontvangen factuur, gooi de urenstaat weg en
 * zet de uitgelezen weekstaat terug in de inbox (status EXTRACTED, timesheetId
 * los). Bestandsnamen die opgeruimd moeten worden komen terug zodat de caller
 * ze ná de transactie kan wissen.
 */
async function resetTimesheetCore(timesheetId: string): Promise<
  WeekResetOutcome & { filesToDelete: string[] }
> {
  const ts = await db.timesheet.findUnique({
    where: { id: timesheetId },
    include: {
      placement: { select: { consultantId: true } },
      invoiceLine: { include: { invoice: { select: { id: true, status: true, number: true } } } },
      inbox: { select: { id: true } },
    },
  });
  if (!ts) return { result: "missing", filesToDelete: [] };

  const weekLabel = formatWeekLabel(ts.weekStart);
  const consultantId = ts.placement?.consultantId ?? null;
  const invoice = ts.invoiceLine?.invoice ?? null;

  // Beschermde verkoopfactuur? Dan niets aanraken.
  if (invoice && !mayDeleteConceptInvoice(invoice.status)) {
    return {
      result: "locked",
      lockedReason: `De verkoopfactuur ${invoice.number ?? ""} van deze week is al vrijgegeven of verstuurd. Crediteer die eerst; hij wordt niet automatisch verwijderd.`.trim(),
      weekLabel,
      consultantId,
      filesToDelete: [],
    };
  }

  // De ontvangen (inkoop)factuur die op dezelfde week/persoon slaat.
  const received =
    consultantId != null
      ? await db.receivedInvoice.findFirst({
          where: {
            consultantId,
            OR: [
              { periodStart: { lte: ts.weekStart }, periodEnd: { gte: ts.weekStart } },
              { periodStart: ts.weekStart },
            ],
          },
          select: { id: true, status: true, fileName: true },
          orderBy: { createdAt: "desc" },
        })
      : null;

  if (received && !isReceivedInvoiceResettable(received.status)) {
    return {
      result: "locked",
      lockedReason:
        "De ontvangen factuur van deze week is al betaald. Die blijft als administratie staan; de week wordt niet gereset.",
      weekLabel,
      consultantId,
      filesToDelete: [],
    };
  }

  const filesToDelete: string[] = [];
  if (received?.fileName) filesToDelete.push(received.fileName);

  await db.$transaction(async (tx) => {
    // 1) Concept-verkoopfactuur weg (regels casceren via de FK, maar expliciet
    //    voor de duidelijkheid). InvoiceLine.timesheetId is SetNull, dus de
    //    urenstaat blokkeert dit niet.
    if (invoice) {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });
      await tx.invoice.delete({ where: { id: invoice.id } });
    }
    // 2) Ontvangen (inkoop)factuur weg.
    if (received) {
      await tx.receivedInvoice.delete({ where: { id: received.id } });
    }
    // 3) De uitgelezen weekstaat terug in de inbox: status EXTRACTED, losgekoppeld
    //    van de (straks verwijderde) urenstaat, en uit de wachtkamer.
    if (ts.inbox) {
      await tx.timesheetInbox.update({
        where: { id: ts.inbox.id },
        data: {
          status: "EXTRACTED",
          timesheetId: null,
          wachtkamerSince: null,
          wachtkamerReason: null,
        },
      });
    }
    // 4) De urenstaat zelf weg (entries casceren via onDelete: Cascade).
    await tx.timesheet.delete({ where: { id: ts.id } });
  });

  return {
    result: "reset",
    weekLabel,
    consultantId,
    deletedInvoiceNumber: invoice?.number ?? null,
    filesToDelete,
  };
}

/** Ruim de losse bestanden op ná de transactie (best effort). */
async function cleanupFiles(files: string[]): Promise<void> {
  for (const f of files) {
    try {
      await deleteReceivedUpload(f);
    } catch {
      // Best effort — een achtergebleven bestand is geen ramp.
    }
  }
}

/**
 * Reset de week vanaf een URENSTAAT (Urenregistratie → weekstaat).
 */
export async function resetWeekForTimesheet(timesheetId: string): Promise<WeekResetOutcome> {
  const { filesToDelete, ...outcome } = await resetTimesheetCore(timesheetId);
  await cleanupFiles(filesToDelete);
  return outcome;
}

/**
 * Reset de week vanaf een ONTVANGEN FACTUUR (Ontvangen facturen).
 *
 * De ontvangen factuur is niet hard aan één urenstaat gekoppeld (Optie A), dus
 * we zoeken de urensta(a)t(en) van dezelfde persoon in de factuurperiode en
 * resetten die. Zit er geen urenstaat aan (losse import), dan verwijderen we
 * alleen de factuur zelf — dan is er niets te "resetten" in de wizard.
 */
export async function resetWeekForReceivedInvoice(receivedId: string): Promise<WeekResetOutcome> {
  const inv = await db.receivedInvoice.findUnique({
    where: { id: receivedId },
    select: {
      id: true,
      status: true,
      fileName: true,
      consultantId: true,
      periodStart: true,
      periodEnd: true,
      number: true,
    },
  });
  if (!inv) return { result: "missing" };

  if (!isReceivedInvoiceResettable(inv.status)) {
    return {
      result: "locked",
      lockedReason:
        "Deze factuur is al betaald en blijft als administratie staan. Zet 'm eerst terug of crediteer 'm.",
      consultantId: inv.consultantId,
    };
  }

  // De urensta(a)t(en) van deze persoon in de factuurperiode.
  const timesheets =
    inv.periodStart && inv.periodEnd
      ? await db.timesheet.findMany({
          where: {
            placement: { consultantId: inv.consultantId },
            weekStart: { gte: inv.periodStart, lte: inv.periodEnd },
          },
          select: { id: true },
          orderBy: { weekStart: "asc" },
        })
      : [];

  // Geen gekoppelde urenstaat → alleen de losse factuur weg (niets te resetten).
  if (timesheets.length === 0) {
    await db.receivedInvoice.delete({ where: { id: inv.id } });
    if (inv.fileName) await cleanupFiles([inv.fileName]);
    return {
      result: "reset",
      consultantId: inv.consultantId,
      deletedInvoiceNumber: inv.number,
    };
  }

  // Reset elke gekoppelde week. Zodra er één beschermd is, stoppen we vóór er
  // iets onomkeerbaars gebeurt — alles-of-niets per factuur.
  const cores: Array<Awaited<ReturnType<typeof resetTimesheetCore>>> = [];
  for (const t of timesheets) {
    const core = await resetTimesheetCore(t.id);
    if (core.result === "locked") {
      return {
        result: "locked",
        lockedReason: core.lockedReason,
        weekLabel: core.weekLabel,
        consultantId: inv.consultantId,
      };
    }
    cores.push(core);
  }

  // De ontvangen factuur zelf is in resetTimesheetCore al meegepakt als 'ie op
  // de week matchte; bestaat 'ie dan nog, dan hier alsnog weg.
  const stillThere = await db.receivedInvoice.findUnique({ where: { id: inv.id }, select: { id: true } });
  if (stillThere) await db.receivedInvoice.delete({ where: { id: inv.id } });

  await cleanupFiles([
    ...cores.flatMap((c) => c.filesToDelete),
    ...(inv.fileName ? [inv.fileName] : []),
  ]);

  return {
    result: "reset",
    consultantId: inv.consultantId,
    weekLabel: cores[0]?.weekLabel,
    deletedInvoiceNumber: cores.find((c) => c.deletedInvoiceNumber)?.deletedInvoiceNumber ?? inv.number,
  };
}
