import { zipSync } from "fflate";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { salesSendData } from "@/lib/verzenden";
import { readUpload, inboxKey } from "@/lib/uploads";
import { auditFlag } from "@/lib/audit";
import { requireAdminApiSession } from "@/lib/api-auth";

// Kiwa/SNA-audit-ZIP voor verkoopfacturen: ?q=2025116,2025143,...
// Per factuur een eigen map met de factuur-PDF + de originele
// urenspecificaties (bronbestanden van de gekoppelde urenstaten).
// Valt een factuur onder de LET OP-regel (creditnota/training/doorbelasting/
// inleen), dan gaat de eerstvolgende reguliere factuur automatisch mee.

function safe(name: string): string {
  return name.replace(/[^a-zA-Z0-9._ -]+/g, "_").slice(0, 120) || "bestand";
}

type FullInvoice = NonNullable<
  Awaited<ReturnType<typeof loadInvoice>>
>;

async function loadInvoice(number: string) {
  return db.invoice.findFirst({
    where: { number: { equals: number, mode: "insensitive" } },
    include: {
      client: true,
      lines: {
        include: {
          timesheet: {
            select: {
              id: true,
              weekStart: true,
              inbox: { select: { fileName: true, originalName: true } },
            },
          },
        },
      },
    },
  });
}

export async function GET(req: Request) {
  const gate = await requireAdminApiSession();
  if (gate) return gate;

  const url = new URL(req.url);
  const terms = (url.searchParams.get("q") ?? "")
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 25);
  if (terms.length === 0) return new Response("Geen factuurnummers opgegeven", { status: 400 });

  const settings = await getCompanySettings();
  // Alle nummers voor de vervangingsregel (eerstvolgende factuur).
  const allNumbers = (
    await db.invoice.findMany({ select: { number: true }, orderBy: { number: "asc" } })
  ).map((i) => i.number);

  const files: Record<string, Uint8Array> = {};
  const notes: string[] = [];
  const included = new Set<string>();

  async function addInvoice(inv: FullInvoice, folderSuffix = "") {
    if (included.has(inv.id)) return;
    included.add(inv.id);
    const folder = safe(`${inv.number}${folderSuffix}`);
    try {
      const data = salesSendData(inv, settings);
      files[`${folder}/${data.pdfName}`] = await renderInvoicePdf(data.pdfDoc);
    } catch {
      notes.push(`${inv.number}: factuur-PDF kon niet gegenereerd worden`);
    }
    // Urenspecificaties: de originele bronbestanden van de urenstaten op de factuur.
    let n = 0;
    for (const line of inv.lines) {
      const inbox = line.timesheet?.inbox;
      if (!inbox) continue;
      try {
        const data = await readUpload(inboxKey(inbox.fileName));
        n += 1;
        files[`${folder}/urenspecificaties/${safe(inbox.originalName)}`] = data;
      } catch {
        notes.push(`${inv.number}: urenspecificatie ${inbox.originalName} niet gevonden in opslag`);
      }
    }
    if (n === 0) {
      notes.push(`${inv.number}: geen urenspecificatie-bronbestand gekoppeld (handmatig aanvullen indien vereist)`);
    }
  }

  for (const term of terms) {
    const inv = await loadInvoice(term);
    if (!inv) {
      notes.push(`${term}: niet gevonden in Verkoopfacturen`);
      continue;
    }
    const flag = auditFlag(inv);
    await addInvoice(inv);
    if (flag) {
      notes.push(`${inv.number}: ${flag} — eerstvolgende factuur toegevoegd conform de opvraag`);
      // Eerstvolgende REGULIERE factuur zoeken (sla ook die met een flag over).
      const sorted = [...allNumbers].sort((a, b) => a.localeCompare(b, "nl", { numeric: true }));
      let idx = sorted.indexOf(inv.number);
      while (idx !== -1 && idx < sorted.length - 1) {
        idx += 1;
        const next = await loadInvoice(sorted[idx]);
        if (!next) break;
        if (!auditFlag(next)) {
          await addInvoice(next, " (vervangend)");
          break;
        }
        await addInvoice(next, " (ook bijzonder)");
      }
    }
  }

  if (included.size === 0) {
    return new Response("Geen van de opgegeven facturen gevonden", { status: 404 });
  }

  const readme = [
    "Kiwa/SNA-audit — verkoopfacturen met urenspecificaties",
    `Opgevraagde nummers: ${terms.join(", ")}`,
    "",
    notes.length === 0 ? "Alles compleet." : `Opmerkingen:\n${notes.map((n) => `- ${n}`).join("\n")}`,
    "",
    "Mapindeling: één map per factuurnummer, met de factuur-PDF en de map",
    "urenspecificaties/ met de originele urenstaat-bestanden.",
  ].join("\n");
  files["LEES MIJ.txt"] = new TextEncoder().encode(readme);

  const zipped = zipSync(files, { level: 6 });
  return new Response(Buffer.from(zipped), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Audit-facturen.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
