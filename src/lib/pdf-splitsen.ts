import { PDFDocument } from "pdf-lib";
import { aiJSONFromFile, isVisionConfigured } from "./ai";

// ---------------------------------------------------------------------------
// Eén PDF met urenstaat + factuur → twee losse PDF's, die elk apart worden
// uitgelezen. De AI zegt alleen per pagina WAT het is; het knippen doet pdf-lib.
// ---------------------------------------------------------------------------

export type PaginaSoort = "TIMESHEET" | "FACTUUR" | "OVERIG";

/** Pagina's (0-based) per deel. Null = geen combinatie (dan niets splitsen). */
export function groepeerPaginas(soorten: PaginaSoort[]): { uren: number[]; factuur: number[] } | null {
  const factuur = soorten.flatMap((s, i) => (s === "FACTUUR" ? [i] : []));
  // Overige pagina's (bijlagen, voorblad) blijven bij de urenstaat.
  const uren = soorten.flatMap((s, i) => (s !== "FACTUUR" ? [i] : []));
  if (factuur.length === 0 || !soorten.includes("TIMESHEET")) return null;
  return { uren, factuur };
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    paginas: {
      type: "array",
      description: "Eén item per pagina, in volgorde (pagina 1 eerst).",
      items: { type: "string", enum: ["TIMESHEET", "FACTUUR", "OVERIG"] },
    },
  },
  required: ["paginas"],
};

async function knip(bron: PDFDocument, paginas: number[]): Promise<Uint8Array> {
  const doel = await PDFDocument.create();
  for (const p of await doel.copyPages(bron, paginas)) doel.addPage(p);
  return doel.save();
}

/**
 * Is dit een PDF met zowel urenstaat- als factuurpagina's? Geef dan beide delen
 * terug als losse bestanden. Eén pagina, geen PDF of geen combinatie → null.
 * ponytail: urenstaat en factuur op DEZELFDE pagina kun je niet knippen; daar
 * vangt de bevatFactuur/bevatUrenstaat-herkenning bij het uitlezen het op.
 */
export async function splitsUrenstaatEnFactuur(file: File): Promise<{ urenstaat: File; factuur: File } | null> {
  const isPdf = file.type.includes("pdf") || /\.pdf$/i.test(file.name);
  if (!isPdf || !isVisionConfigured()) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bron: PDFDocument;
  try {
    bron = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    return null;
  }
  const aantal = bron.getPageCount();
  if (aantal < 2) return null;

  let soorten: PaginaSoort[];
  try {
    const res = await aiJSONFromFile<{ paginas: PaginaSoort[] }>({
      system: "Je sorteert pagina's van een document voor een uitzendbureau.",
      prompt:
        `Dit PDF-bestand heeft ${aantal} pagina's. Zeg per pagina wat het is: TIMESHEET (urenstaat: dagen met gewerkte uren), ` +
        "FACTUUR (factuur van de medewerker: factuurnummer, bedragen, btw/totaal) of OVERIG (iets anders). " +
        `Geef precies ${aantal} items, in volgorde.`,
      schema: SCHEMA,
      schemaName: "pagina_soorten",
      file: { base64: Buffer.from(bytes).toString("base64"), mediaType: "application/pdf" },
      maxTokens: 400,
      effort: "low",
    });
    soorten = res.paginas;
  } catch {
    return null; // twijfel → niet knippen, gewoon zoals vroeger uitlezen
  }
  if (!Array.isArray(soorten) || soorten.length !== aantal) return null;
  const groep = groepeerPaginas(soorten);
  if (!groep) return null;

  const basis = file.name.replace(/\.pdf$/i, "");
  const maak = async (paginas: number[], deel: string) =>
    new File([Buffer.from(await knip(bron, paginas))], `${basis} (${deel}).pdf`, { type: "application/pdf" });
  return { urenstaat: await maak(groep.uren, "urenstaat"), factuur: await maak(groep.factuur, "factuur") };
}
