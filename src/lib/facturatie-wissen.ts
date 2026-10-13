import { db } from "@/lib/db";
import { FACTURATIE_ENTITY } from "@/lib/facturatie-week";

// ---------------------------------------------------------------------------
// Facturatie-testdata wissen (alleen beheerder, met bevestiging). Klanten,
// personen, plaatsingen en contracten blijven staan. Geüploade bestanden in de
// opslag blijven als wees achter (onschadelijk).
// ---------------------------------------------------------------------------

export async function facturatieTellingen() {
  const [verkoop, verstuurd, ontvangen, inkoop, urenstaten, scans, los, herinneringen, akkoorden, correcties] =
    await Promise.all([
      db.invoice.count(),
      db.invoice.count({ where: { status: { in: ["SENT", "PAID"] } } }),
      db.receivedInvoice.count(),
      db.purchaseInvoice.count(),
      db.timesheet.count(),
      db.timesheetInbox.count(),
      db.facturatieUpload.count(),
      db.timesheetHerinnering.count(),
      db.activity.count({ where: { entityType: FACTURATIE_ENTITY } }),
      db.timesheetCorrection.count(),
    ]);
  return { verkoop, verstuurd, ontvangen, inkoop, urenstaten, scans, los, herinneringen, akkoorden, correcties };
}

/** Alles in één transactie, in FK-veilige volgorde; nummering verkoop begint opnieuw. */
export async function wisFacturatieTestdata(): Promise<void> {
  await db.$transaction([
    db.invoice.deleteMany(), // regels cascade
    db.purchaseInvoice.deleteMany(),
    db.receivedInvoice.deleteMany(),
    db.facturatieUpload.deleteMany(),
    db.timesheetInbox.deleteMany(),
    db.timesheet.deleteMany(), // dagregels cascade
    db.timesheetHerinnering.deleteMany(),
    db.timesheetReminder.deleteMany(), // log van herinneringsmails: anders "al herinnerd" in de test
    db.timesheetCorrection.deleteMany(), // AI-correcties uit de testfase
    db.activity.deleteMany({ where: { entityType: FACTURATIE_ENTITY } }),
    // Alleen verkoopnummers ("invoice-<jaar>"), niet "purchase-invoice-…".
    db.numberSequence.deleteMany({ where: { key: { startsWith: "invoice-" } } }),
  ]);
}
