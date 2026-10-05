import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contract } from "@prisma/client";
import { requireApiSession } from "@/lib/api-auth";
import { getCompanySettings } from "@/lib/settings";
import { buildContractDoc } from "@/lib/contract-doc";
import { contractLogoDataUri, loadContractSheet, q4sHandtekeningDataUri } from "@/lib/contract-render";
import { ContractVel } from "@/components/contract/ContractVel";
import { OfferteVel } from "@/components/contract/OfferteVel";
import { PersoonsgegevensVel } from "@/components/contract/PersoonsgegevensVel";
import { velHtmlToDocx } from "@/lib/vel-docx";

/** Lege overeenkomst: zelfde vaste standaarden als de Blanco-pagina. */
const LEEG = {
  vatReverseCharge: true,
  paymentTermDays: 30,
  includeConfidentiality: true,
  includeGdpr: true,
  includeIp: true,
} as unknown as Contract;

const NAMEN: Record<string, [string, string]> = {
  overeenkomst: ["Overeenkomst van opdracht", "Contract agreement"],
  persoonsgegevens: ["Persoonsgegevens", "Personal information"],
  offerte: ["Offerte", "Quotation"],
};

/**
 * Word-versie (.docx) van een Q4S-document, als back-up om buiten het dashboard
 * verder te bewerken. ?doc=overeenkomst|persoonsgegevens|offerte&taal=nl|en (blanco)
 * of ?id=<contractId> (ingevuld contract). Alleen voor ingelogde gebruikers.
 */
export async function GET(req: Request) {
  const gate = await requireApiSession();
  if (gate) return gate;

  const url = new URL(req.url);
  const taal = url.searchParams.get("taal") === "en" ? "en" : "nl";
  const id = url.searchParams.get("id");
  const doc = url.searchParams.get("doc") ?? "overeenkomst";
  if (!id && !NAMEN[doc]) return new Response("Onbekend document", { status: 400 });

  const handtekening = q4sHandtekeningDataUri();
  let html: string;
  let voetregel: string;
  let naam: string;

  if (id) {
    const sheet = await loadContractSheet(id);
    if (!sheet) return new Response("Niet gevonden", { status: 404 });
    html = renderToStaticMarkup(createElement(ContractVel, { doc: sheet.doc, logoSrc: sheet.logoSrc, handtekening, taal }));
    voetregel = sheet.doc.footerLine;
    naam = `${NAMEN.overeenkomst[taal === "en" ? 1 : 0]} - ${sheet.contract.contractorName || sheet.contract.number || id}`;
  } else {
    const leeg = buildContractDoc(LEEG, await getCompanySettings());
    const logoSrc = contractLogoDataUri();
    voetregel = leeg.footerLine;
    html = renderToStaticMarkup(
      doc === "overeenkomst"
        ? createElement(ContractVel, { doc: leeg, logoSrc, handtekening, taal })
        : doc === "offerte"
          ? createElement(OfferteVel, { logoSrc, footerLine: voetregel, handtekening, taal })
          : createElement(PersoonsgegevensVel, { logoSrc, footerLine: voetregel, taal }),
    );
    naam = `Q4S ${NAMEN[doc][taal === "en" ? 1 : 0]} (${taal.toUpperCase()})`;
  }

  const bytes = await velHtmlToDocx(html, voetregel);
  const bestand = `${naam.replace(/[^\w .()-]+/g, "").trim()}.docx`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${bestand}"`,
      "Cache-Control": "no-store",
    },
  });
}
