import { zipSync } from "fflate";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { salesSendData } from "@/lib/verzenden";
import { readUpload, uploadKey, receivedKey } from "@/lib/uploads";
import { matchSalesInvoices } from "@/lib/steekproef";
import { requireAdminApiSession } from "@/lib/api-auth";

// Kiwa/SNA-steekproefbundel voor ÉÉN inkoopfactuur (ReceivedInvoice):
// alle aanwezige stukken in een nette mapstructuur, klaar voor de submap
// "Steekproef ZZP" van de auditor.
//
//   01 Opdracht & Overeenkomst/   (dossier CONTRACT)
//   02 KvK-uittreksel/            (dossier KVK)
//   03 ID-vastlegging/            (dossier ID)
//   04 Inkoopfactuur/             (upload op de ontvangen factuur)
//   05 Betaalbewijs/              (dossier BETAALBEWIJS)
//   06 Verkoopfacturen/           (gegenereerde Q4S-facturen die erbij horen)

function safe(name: string): string {
  return name.replace(/[^a-zA-Z0-9._ -]+/g, "_").slice(0, 120) || "bestand";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminApiSession();
  if (gate) return gate;

  const { id } = await params;
  const inv = await db.receivedInvoice.findUnique({
    where: { id },
    include: { consultant: true },
  });
  if (!inv) return new Response("Inkoopfactuur niet gevonden", { status: 404 });

  const c = inv.consultant;
  const wie = (c.companyName?.trim() || `${c.firstName} ${c.lastName}`).trim();

  const [docs, salesRaw, settings] = await Promise.all([
    db.document.findMany({
      where: {
        consultantId: c.id,
        category: { in: ["CONTRACT", "KVK", "ID", "BETAALBEWIJS"] },
      },
    }),
    db.invoice.findMany({
      where: {
        lines: { some: { timesheet: { placement: { consultantId: c.id } } } },
      },
      include: {
        client: true,
        lines: { include: { timesheet: { select: { weekStart: true } } } },
      },
    }),
    getCompanySettings(),
  ]);

  const salesMatches = matchSalesInvoices(
    { id: inv.id, issueDate: inv.issueDate, periodStart: inv.periodStart, periodEnd: inv.periodEnd },
    salesRaw.map((s) => ({
      ...s,
      weekStarts: s.lines
        .map((l) => l.timesheet?.weekStart)
        .filter((w): w is Date => Boolean(w)),
    })),
  );

  const files: Record<string, Uint8Array> = {};
  const missing: string[] = [];

  const FOLDER: Record<string, string> = {
    CONTRACT: "01 Opdracht & Overeenkomst",
    KVK: "02 KvK-uittreksel",
    ID: "03 ID-vastlegging",
    BETAALBEWIJS: "05 Betaalbewijs",
  };
  for (const d of docs) {
    try {
      const data = await readUpload(uploadKey(c.id, d.fileName));
      files[`${FOLDER[d.category]}/${safe(d.originalName)}`] = data;
    } catch {
      missing.push(`${FOLDER[d.category]}: ${d.originalName} (bestand niet gevonden in opslag)`);
    }
  }

  if (inv.fileName) {
    try {
      const data = await readUpload(receivedKey(inv.fileName));
      files[`04 Inkoopfactuur/${safe(inv.originalName ?? `inkoopfactuur-${inv.number ?? inv.id}.pdf`)}`] = data;
    } catch {
      missing.push("04 Inkoopfactuur: upload niet gevonden in opslag");
    }
  } else {
    missing.push("04 Inkoopfactuur: geen bestand geüpload op de ontvangen factuur");
  }

  for (const s of salesMatches) {
    try {
      const data = salesSendData(s, settings);
      files[`06 Verkoopfacturen/${data.pdfName}`] = await renderInvoicePdf(data.pdfDoc);
    } catch {
      missing.push(`06 Verkoopfacturen: factuur ${s.number} kon niet gegenereerd worden`);
    }
  }
  if (salesMatches.length === 0) {
    missing.push("06 Verkoopfacturen: geen verkoopfactuur gevonden die deze periode dekt");
  }

  // LEES MIJ met wat er (nog) ontbreekt — zo levert niemand per ongeluk een
  // incomplete bundel aan zonder het te weten.
  const readme = [
    `Kiwa/SNA-steekproef — ${wie}`,
    `Inkoopfactuur: ${inv.number ?? "zonder nummer"}`,
    inv.issueDate ? `Factuurdatum: ${inv.issueDate.toLocaleDateString("nl-NL")}` : null,
    "",
    missing.length === 0
      ? "Alle stukken aanwezig."
      : `LET OP — nog aan te vullen:\n${missing.map((m) => `- ${m}`).join("\n")}`,
    "",
    "Ontbrekende dossierstukken upload je bij Medewerkers > (persoon) > Documenten",
    "met de juiste categorie (Contract, KvK-uittreksel, Identiteitsbewijs, Betaalbewijs).",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  files["LEES MIJ.txt"] = new TextEncoder().encode(readme);

  const zipped = zipSync(files, { level: 6 });
  const stamp = safe(`${wie}-${inv.number ?? inv.id}`);
  return new Response(Buffer.from(zipped), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Steekproef-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
