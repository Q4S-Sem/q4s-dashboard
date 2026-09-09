import { PrismaClient } from "@prisma/client";
import { archiveKey, type StoredArchiveFile } from "../src/lib/archive";
import { deleteObject, getObject, usingR2 } from "../src/lib/storage";
import { inboxKey, receivedKey } from "../src/lib/uploads";

const EXECUTE_CODE = "RESET-Q4S-TRANSACTIONS";
const execute = process.argv.includes("--execute") && process.argv.includes(EXECUTE_CODE);
const prisma = new PrismaClient();

const archivedEntityTypes = new Set([
  "invoice",
  "invoiceline",
  "purchaseinvoice",
  "purchaseinvoiceline",
  "receivedinvoice",
  "timesheet",
  "timesheetentry",
  "timesheetinbox",
]);

function parseArchiveFiles(raw: string | null): StoredArchiveFile[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter(
          (item): item is StoredArchiveFile =>
            item &&
            typeof item === "object" &&
            typeof item.file === "string" &&
            typeof item.name === "string" &&
            typeof item.mimeType === "string",
        )
      : [];
  } catch {
    return [];
  }
}

async function collect() {
  const [
    invoices,
    purchaseInvoices,
    receivedInvoices,
    timesheets,
    inboxItems,
    invoiceLines,
    purchaseLines,
    timesheetEntries,
    mailIntakeLogs,
    sequences,
    allArchived,
    settings,
  ] = await Promise.all([
    prisma.invoice.count(),
    prisma.purchaseInvoice.count(),
    prisma.receivedInvoice.findMany({ select: { id: true, fileName: true } }),
    prisma.timesheet.count(),
    prisma.timesheetInbox.findMany({ select: { id: true, fileName: true } }),
    prisma.invoiceLine.count(),
    prisma.purchaseInvoiceLine.count(),
    prisma.timesheetEntry.count(),
    prisma.mailIntakeLog.count(),
    prisma.numberSequence.findMany({
      where: { OR: [{ key: { startsWith: "invoice-" } }, { key: { startsWith: "purchase-invoice-" } }] },
      select: { key: true },
    }),
    prisma.archivedItem.findMany({ select: { id: true, entityType: true, filesJson: true } }),
    prisma.companySettings.findUnique({
      where: { id: "default" },
      select: { cloudEnabled: true, cloudProvider: true },
    }),
  ]);

  const archived = allArchived.filter((item) => archivedEntityTypes.has(item.entityType.toLowerCase()));
  const sourceFileNames = [
    ...inboxItems.map((item) => item.fileName),
    ...receivedInvoices.map((item) => item.fileName).filter((name): name is string => Boolean(name)),
  ];
  const sourceKeys = [
    ...inboxItems.map((item) => inboxKey(item.fileName)),
    ...receivedInvoices
      .map((item) => item.fileName)
      .filter((name): name is string => Boolean(name))
      .map(receivedKey),
  ];
  const archiveKeys = archived.flatMap((item) =>
    parseArchiveFiles(item.filesJson).map((file) => archiveKey(item.id, file.file)),
  );
  const uniqueSourceFileNames = [...new Set(sourceFileNames)];
  const cloudLogs = uniqueSourceFileNames.length
    ? await prisma.cloudSyncLog.findMany({
        where: { fileName: { in: uniqueSourceFileNames } },
        select: { id: true, status: true },
      })
    : [];

  const cloudByStatus = cloudLogs.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    counts: {
      invoices,
      invoiceLines,
      purchaseInvoices,
      purchaseLines,
      receivedInvoices: receivedInvoices.length,
      timesheets,
      timesheetEntries,
      inboxItems: inboxItems.length,
      mailIntakeLogs,
      invoiceSequences: sequences.length,
      archivedItems: archived.length,
      sourceFiles: new Set(sourceKeys).size,
      archivedFiles: new Set(archiveKeys).size,
    },
    storage: {
      r2Configured: usingR2(),
      cloudEnabled: settings?.cloudEnabled ?? false,
      cloudProvider: settings?.cloudProvider ?? null,
      cloudLogs: cloudByStatus,
    },
    ids: {
      archive: archived.map((item) => item.id),
      cloudLogs: cloudLogs.map((row) => row.id),
    },
    keys: {
      source: [...new Set(sourceKeys)],
      archive: [...new Set(archiveKeys)],
    },
  };
}

async function assertDeleted(keys: string[]) {
  const remaining: string[] = [];
  for (const key of keys) {
    try {
      await getObject(key);
      remaining.push(key);
    } catch {
      // Niet meer leesbaar: verwijderd of bestond al niet.
    }
  }
  if (remaining.length) throw new Error(`${remaining.length} opslagbestand(en) bestaan nog.`);
}

async function main() {
  const before = await collect();
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", before: { counts: before.counts, storage: before.storage } }));
  if (!execute) return;

  const allKeys = [...before.keys.source, ...before.keys.archive];
  if (allKeys.length && !before.storage.r2Configured) {
    throw new Error("RESET GEBLOKKEERD: productie-R2 is niet geconfigureerd in deze omgeving.");
  }
  if ((before.storage.cloudLogs.SYNCED ?? 0) > 0) {
    throw new Error(
      `RESET GEBLOKKEERD: ${before.storage.cloudLogs.SYNCED} bestand(en) zijn live naar Microsoft 365 gespiegeld; de app heeft geen delete-mirror.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.deleteMany();
    await tx.purchaseInvoiceLine.deleteMany();
    await tx.timesheetInbox.deleteMany();
    await tx.timesheetEntry.deleteMany();
    await tx.invoice.deleteMany();
    await tx.purchaseInvoice.deleteMany();
    await tx.receivedInvoice.deleteMany();
    await tx.timesheet.deleteMany();
    await tx.mailIntakeLog.deleteMany();
    await tx.numberSequence.deleteMany({
      where: { OR: [{ key: { startsWith: "invoice-" } }, { key: { startsWith: "purchase-invoice-" } }] },
    });
    if (before.ids.cloudLogs.length) {
      await tx.cloudSyncLog.deleteMany({ where: { id: { in: before.ids.cloudLogs } } });
    }
    if (before.ids.archive.length) {
      await tx.archivedItem.deleteMany({ where: { id: { in: before.ids.archive } } });
    }
  });

  for (const key of allKeys) await deleteObject(key);
  await assertDeleted(allKeys);

  const after = await collect();
  const nonZero = Object.entries(after.counts).filter(([, value]) => value !== 0);
  if (nonZero.length) {
    throw new Error(`RESET ONVOLLEDIG: ${JSON.stringify(Object.fromEntries(nonZero))}`);
  }

  console.log(JSON.stringify({ completed: true, deletedFiles: allKeys.length, after: { counts: after.counts, storage: after.storage } }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
