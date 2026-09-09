// Verwijdert UITSLUITEND de legacy self-billing inkoopfacturen (PurchaseInvoice).
// PurchaseInvoiceLine cascadeert mee (onDelete: Cascade).
// Timesheets blijven bestaan (relatie is onDelete: SetNull).
// Verkoopfacturen (Invoice) en ontvangen facturen (ReceivedInvoice) worden NIET geraakt.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const before = {
    purchaseInvoices: await db.purchaseInvoice.count(),
    purchaseLines: await db.purchaseInvoiceLine.count(),
    salesInvoices: await db.invoice.count(),
    receivedInvoices: await db.receivedInvoice.count(),
    timesheets: await db.timesheet.count(),
  };
  console.log("VOOR:", JSON.stringify(before, null, 2));

  const del = await db.purchaseInvoice.deleteMany({});
  console.log(`Verwijderd: ${del.count} inkoopfactu(u)r(en) (regels cascade).`);

  const after = {
    purchaseInvoices: await db.purchaseInvoice.count(),
    purchaseLines: await db.purchaseInvoiceLine.count(),
    salesInvoices: await db.invoice.count(),
    receivedInvoices: await db.receivedInvoice.count(),
    timesheets: await db.timesheet.count(),
  };
  console.log("NA:", JSON.stringify(after, null, 2));

  const ok =
    after.purchaseInvoices === 0 &&
    after.purchaseLines === 0 &&
    after.salesInvoices === before.salesInvoices &&
    after.receivedInvoices === before.receivedInvoices &&
    after.timesheets === before.timesheets;
  console.log(ok ? "OK: alleen inkoopfacturen weg, rest ongewijzigd." : "LET OP: onverwachte wijziging — controleer.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
