import { db } from "./db";
import { aiJSONFromFile } from "./ai";
import { readExpenseBase64 } from "./uploads";
import { round2 } from "./utils";
import { EXPENSE_CATEGORY_VALUES } from "./domain";

// ---------------------------------------------------------------------------
// Bonnetjes (declaraties): AI-uitlezing + "van wie is deze bon?". Gedeeld door
// de handmatige upload (Inkoop → Declaraties) en de mail-intake (Bonnetjes).
// ---------------------------------------------------------------------------

// ---------- AI-uitlezing van een bon ----------

type Receipt = {
  date: string;
  vendor: string;
  amount: number;
  vatAmount: number;
  category: string;
  description: string;
  notes: string;
};

const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string", description: "Datum op de bon als YYYY-MM-DD; lege string als onbekend." },
    vendor: { type: "string", description: "Naam van de winkel/leverancier; lege string als onbekend." },
    amount: { type: "number", description: "Totaalbedrag inclusief BTW in euro. 0 als onbekend." },
    vatAmount: { type: "number", description: "BTW-bedrag in euro. 0 als onbekend." },
    category: { type: "string", description: "Eén van: REIS, MATERIAAL, VERBLIJF, ETEN, PARKEREN, TOL, OVERIG." },
    description: { type: "string", description: "Korte omschrijving van de uitgave." },
    notes: { type: "string", description: "Onzekerheden; anders lege string." },
  },
  required: ["date", "vendor", "amount", "vatAmount", "category", "description", "notes"],
};

const SYSTEM_RECEIPT = `Je bent een nauwkeurige administratieve assistent bij Q4S, een Nederlands detacheringsbureau. Je leest binnengekomen bonnetjes/kassabonnen (declaraties) uit die gedetacheerde vakmensen indienen. Elke bon ziet er anders uit.

Lees de bon zorgvuldig en haal de gegevens er exact uit. Verzin niets: laat een veld leeg (lege string) of 0 als je het niet zeker uit de bon kunt halen. Kies de meest passende categorie uit: REIS (brandstof/tanken/OV/trein/km-vergoeding), MATERIAAL (gereedschap/materialen), VERBLIJF (hotel/overnachting), ETEN (eten & drinken/horeca), PARKEREN (parkeergeld/parkeergarage), TOL (tol- en tunnelgeld: Westerscheldetunnel, Kiltunnel, Liefkenshoektunnel, tolwegen, buitenlandse péage/Maut/tolvignet/telepass), OVERIG (rest). Let op: parkeren en tol zijn APARTE categorieën — een tunnel- of tolheffing hoort bij TOL, niet bij PARKEREN. Geef het resultaat terug volgens het JSON-schema.`;

export async function runExpenseExtraction(id: string): Promise<void> {
  const exp = await db.expense.findUnique({ where: { id } });
  if (!exp) throw new Error("Declaratie niet gevonden.");
  if (!exp.fileName || !exp.mimeType || !exp.originalName) {
    throw new Error("Geen bestand om uit te lezen.");
  }

  const lower = exp.originalName.toLowerCase();
  let mediaType = "";
  if (exp.mimeType.includes("pdf") || lower.endsWith(".pdf")) {
    mediaType = "application/pdf";
  } else if (/^image\/(png|jpe?g|gif|webp)$/.test(exp.mimeType)) {
    mediaType = exp.mimeType;
  } else {
    throw new Error("Niet-ondersteund bestandstype.");
  }

  const data = await aiJSONFromFile<Receipt>({
    system: SYSTEM_RECEIPT,
    prompt:
      "Lees dit bonnetje / deze kassabon uit en geef datum, leverancier, totaalbedrag, BTW, categorie en een korte omschrijving terug.",
    schema: RECEIPT_SCHEMA,
    file: { base64: await readExpenseBase64(exp.fileName), mediaType },
    maxTokens: 1200,
    effort: "medium",
  });

  let date: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(data.date)) date = new Date(`${data.date}T00:00:00`);
  const category = EXPENSE_CATEGORY_VALUES.includes(data.category) ? data.category : "OVERIG";

  await db.expense.update({
    where: { id },
    data: {
      date,
      vendor: data.vendor?.trim() || null,
      amount: typeof data.amount === "number" && data.amount > 0 ? round2(data.amount) : 0,
      vatAmount:
        typeof data.vatAmount === "number" && data.vatAmount > 0 ? round2(data.vatAmount) : null,
      category,
      description: data.description?.trim() || null,
      aiNotes: data.notes?.trim() || null,
    },
  });
}


const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Van wie is een gemailde bon? 1) afzender = e-mailadres van de persoon,
 * 2) zijn volledige naam staat in onderwerp/bestandsnaam. Twijfel (meerdere
 * treffers of niets) → null: dan wijs je hem zelf toe op Bonnetjes.
 */
export function matchPersoon(
  bron: { afzender?: string | null; tekst?: string | null },
  personen: { id: string; firstName: string; lastName: string; email: string | null }[],
): string | null {
  const afzender = norm(bron.afzender ?? "").trim();
  if (afzender) {
    const opMail = personen.filter((p) => p.email && norm(p.email).trim() === afzender);
    if (opMail.length === 1) return opMail[0].id;
  }
  const tekst = ` ${norm(bron.tekst ?? "").replace(/[^a-z0-9]+/g, " ")} `;
  const opNaam = personen.filter((p) => {
    const naam = norm(`${p.firstName} ${p.lastName}`).replace(/[^a-z0-9]+/g, " ").trim();
    return naam.includes(" ") && tekst.includes(` ${naam} `);
  });
  return opNaam.length === 1 ? opNaam[0].id : null;
}
