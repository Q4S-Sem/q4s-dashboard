import assert from "node:assert/strict";
import test from "node:test";
import {
  invoiceMediaType,
  isoWeekRange,
  parseWeekNumber,
  toReceivedInvoiceFormValues,
  type InvoiceExtracted,
} from "../src/lib/invoice-extract";
import { formatCurrency } from "../src/lib/utils";

// ---------------------------------------------------------------------------
// De AI leest de EIGEN factuur van een ZZP'er uit; deze mapper zet die uitlezing
// om naar exact de velden van het importformulier (/ontvangen-facturen/importeren).
// Een mens controleert daarna alles vóór het opslaan — de mapper mag dus NIETS
// verzinnen: onbekend blijft leeg. Puur, dus hier volledig te testen.
// ---------------------------------------------------------------------------

/** Een complete, plausibele uitlezing; losse velden overschrijf je per test. */
function extracted(patch: Partial<InvoiceExtracted> = {}): Partial<InvoiceExtracted> {
  return {
    invoiceNumber: "2026-014",
    issueDate: "2026-08-24",
    periodStart: "2026-08-17",
    periodEnd: "2026-08-23",
    weekNumber: "34",
    year: "2026",
    hours: 40,
    hourlyRate: 65,
    overtimeHours: 0,
    amountExclVat: 2600,
    vatAmount: 546,
    vatShifted: false,
    kilometers: 220,
    totalAmount: 3146,
    name: "Rob van Son",
    confidence: 0.9,
    notes: "",
    ...patch,
  };
}

const TODAY = new Date(2026, 5, 1); // 1 juni 2026 — vaste "vandaag" voor de tests

test("een volledige factuur vult elk formulierveld in de verwachte vorm", () => {
  assert.deepEqual(toReceivedInvoiceFormValues(extracted(), TODAY), {
    number: "2026-014",
    issueDate: "2026-08-24",
    periodStart: "2026-08-17",
    periodEnd: "2026-08-23",
    amount: "3146,00",
    vatAmount: "546,00",
    kilometers: "220",
    notes: `Uren: 40 à ${formatCurrency(65)}.`,
  });
});

test("BTW verlegd: geen btw-bedrag (null) en het totaal is het bedrag excl. btw", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ vatShifted: true, vatAmount: 0, totalAmount: 2600 }),
    TODAY,
  );
  assert.equal(values.vatAmount, null);
  assert.equal(values.amount, "2600,00");
  assert.match(values.notes, /BTW verlegd\./);
});

test("BTW verlegd wint van een toch ingevuld btw-bedrag", () => {
  // Zonder totaalbedrag zou 2600 + 546 opgeteld worden; bij verlegde btw niet.
  const values = toReceivedInvoiceFormValues(
    extracted({ vatShifted: true, vatAmount: 546, totalAmount: 0 }),
    TODAY,
  );
  assert.equal(values.amount, "2600,00");
  assert.equal(values.vatAmount, null);
});

test("zonder btw-bedrag blijft het btw-veld leeg (null), niet 0", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ vatAmount: 0, vatShifted: false, totalAmount: 2600 }),
    TODAY,
  );
  assert.equal(values.vatAmount, null);
});

test("zonder totaalbedrag telt de mapper excl. btw + btw op", () => {
  const values = toReceivedInvoiceFormValues(extracted({ totalAmount: 0 }), TODAY);
  assert.equal(values.amount, "3146,00");
});

test("zonder enig bedrag blijft het bedragveld leeg — de mens vult het zelf in", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ totalAmount: 0, amountExclVat: 0, vatAmount: 0 }),
    TODAY,
  );
  assert.equal(values.amount, "");
});

test("centen worden afgerond op twee decimalen in NL-notatie", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ totalAmount: 0, amountExclVat: 1234.567, vatAmount: 0.004 }),
    TODAY,
  );
  assert.equal(values.amount, "1234,57");
});

test("alleen een weeknummer: de periode wordt maandag t/m zondag van die ISO-week", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ periodStart: "", periodEnd: "", weekNumber: "week 34", year: "2026" }),
    TODAY,
  );
  assert.equal(values.periodStart, "2026-08-17");
  assert.equal(values.periodEnd, "2026-08-23");
});

test("staat er geen jaar bij de week, dan telt het jaar van de factuurdatum", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ periodStart: "", periodEnd: "", weekNumber: "34", year: "", issueDate: "2025-08-22" }),
    TODAY,
  );
  assert.equal(values.periodStart, "2025-08-18");
  assert.equal(values.periodEnd, "2025-08-24");
});

test("zonder jaar én zonder factuurdatum valt de week terug op het huidige jaar", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ periodStart: "", periodEnd: "", weekNumber: "34", year: "", issueDate: "" }),
    TODAY,
  );
  assert.equal(values.periodStart, "2026-08-17");
  assert.equal(values.periodEnd, "2026-08-23");
});

test("een half ingevulde periode wordt aangevuld vanuit het weeknummer", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ periodStart: "2026-08-17", periodEnd: "", weekNumber: "34", year: "2026" }),
    TODAY,
  );
  assert.equal(values.periodEnd, "2026-08-23");
});

test("zonder periode én zonder bruikbaar weeknummer blijven de datums leeg", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ periodStart: "", periodEnd: "", weekNumber: "", year: "" }),
    TODAY,
  );
  assert.equal(values.periodStart, "");
  assert.equal(values.periodEnd, "");
});

test("datums in Nederlandse notatie worden genormaliseerd naar YYYY-MM-DD", () => {
  assert.equal(toReceivedInvoiceFormValues(extracted({ issueDate: "24-08-2026" }), TODAY).issueDate, "2026-08-24");
  assert.equal(toReceivedInvoiceFormValues(extracted({ issueDate: "24/08/2026" }), TODAY).issueDate, "2026-08-24");
  assert.equal(toReceivedInvoiceFormValues(extracted({ issueDate: "24.08.2026" }), TODAY).issueDate, "2026-08-24");
});

test("een onzinnige of onmogelijke datum wordt leeg, niet gegokt", () => {
  assert.equal(toReceivedInvoiceFormValues(extracted({ issueDate: "onbekend" }), TODAY).issueDate, "");
  assert.equal(toReceivedInvoiceFormValues(extracted({ issueDate: "2026-02-30" }), TODAY).issueDate, "");
  assert.equal(toReceivedInvoiceFormValues(extracted({ issueDate: "2026-13-01" }), TODAY).issueDate, "");
});

test("kilometers: 0, negatief of ontbrekend blijft leeg", () => {
  assert.equal(toReceivedInvoiceFormValues(extracted({ kilometers: 0 }), TODAY).kilometers, "");
  assert.equal(toReceivedInvoiceFormValues(extracted({ kilometers: -10 }), TODAY).kilometers, "");
  assert.equal(toReceivedInvoiceFormValues(extracted({ kilometers: undefined }), TODAY).kilometers, "");
});

test("kilometers met decimalen komen in NL-notatie terug", () => {
  assert.equal(toReceivedInvoiceFormValues(extracted({ kilometers: 220.5 }), TODAY).kilometers, "220,5");
  assert.equal(toReceivedInvoiceFormValues(extracted({ kilometers: 220.004 }), TODAY).kilometers, "220");
});

test("de notitie vat uren, overuren, verlegde btw en de AI-opmerking samen", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({
      hours: 40,
      hourlyRate: 65,
      overtimeHours: 3,
      vatShifted: true,
      vatAmount: 0,
      notes: "  Tarief wijkt af van de plaatsing.  ",
    }),
    TODAY,
  );
  assert.equal(
    values.notes,
    `Uren: 40 à ${formatCurrency(65)}. Overuren: 3. BTW verlegd. Tarief wijkt af van de plaatsing.`,
  );
});

test("zonder uurtarief noemt de notitie alleen de uren", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ hours: 37.5, hourlyRate: 0, overtimeHours: 0, notes: "" }),
    TODAY,
  );
  assert.equal(values.notes, "Uren: 37,5.");
});

test("valt er niets te melden, dan blijft de notitie leeg", () => {
  const values = toReceivedInvoiceFormValues(
    extracted({ hours: 0, hourlyRate: 0, overtimeHours: 0, notes: "" }),
    TODAY,
  );
  assert.equal(values.notes, "");
});

test("een lege uitlezing geeft een leeg, veilig formulier", () => {
  assert.deepEqual(toReceivedInvoiceFormValues(null, TODAY), {
    number: "",
    issueDate: "",
    periodStart: "",
    periodEnd: "",
    amount: "",
    vatAmount: null,
    kilometers: "",
    notes: "",
  });
  assert.deepEqual(toReceivedInvoiceFormValues(undefined, TODAY), toReceivedInvoiceFormValues({}, TODAY));
});

test("het factuurnummer komt getrimd terug", () => {
  assert.equal(toReceivedInvoiceFormValues(extracted({ invoiceNumber: "  2026-014 " }), TODAY).number, "2026-014");
});

test("de mapper is puur: zelfde invoer, zelfde uitkomst en de invoer blijft ongemoeid", () => {
  const input = extracted();
  const snapshot = JSON.stringify(input);
  assert.deepEqual(toReceivedInvoiceFormValues(input, TODAY), toReceivedInvoiceFormValues(input, TODAY));
  assert.equal(JSON.stringify(input), snapshot);
});

// --- weeknummer → ISO-weekperiode -----------------------------------------

test("parseWeekNumber pikt het weeknummer uit vrije tekst", () => {
  assert.equal(parseWeekNumber("34"), 34);
  assert.equal(parseWeekNumber("week 34"), 34);
  assert.equal(parseWeekNumber("Week nr. 5"), 5);
  assert.equal(parseWeekNumber("wk 34/2026"), 34);
  assert.equal(parseWeekNumber(53), 53);
});

test("parseWeekNumber weigert wat geen weeknummer kan zijn", () => {
  assert.equal(parseWeekNumber(""), null);
  assert.equal(parseWeekNumber(undefined), null);
  assert.equal(parseWeekNumber("2026"), null);
  assert.equal(parseWeekNumber("week 0"), null);
  assert.equal(parseWeekNumber("week 54"), null);
});

test("isoWeekRange geeft maandag t/m zondag, ook over de jaargrens", () => {
  assert.deepEqual(isoWeekRange(34, 2026), { start: "2026-08-17", end: "2026-08-23" });
  assert.deepEqual(isoWeekRange(1, 2026), { start: "2025-12-29", end: "2026-01-04" });
  assert.deepEqual(isoWeekRange(53, 2026), { start: "2026-12-28", end: "2027-01-03" });
});

test("isoWeekRange weigert een week die dat jaar niet bestaat", () => {
  assert.equal(isoWeekRange(53, 2025), null); // 2025 heeft 52 weken
  assert.equal(isoWeekRange(0, 2026), null);
  assert.equal(isoWeekRange(54, 2026), null);
});

// --- bestandstype ----------------------------------------------------------

test("invoiceMediaType herkent PDF's en afbeeldingen, ook zonder bruikbare MIME", () => {
  assert.equal(invoiceMediaType("factuur.pdf", "application/pdf"), "application/pdf");
  assert.equal(invoiceMediaType("factuur.PDF", "application/octet-stream"), "application/pdf");
  assert.equal(invoiceMediaType("scan.jpg", "application/octet-stream"), "image/jpeg");
  assert.equal(invoiceMediaType("scan.png", "image/png"), "image/png");
});

test("invoiceMediaType wijst bestanden af die het vision-model niet leest", () => {
  assert.equal(invoiceMediaType("factuur.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), null);
  assert.equal(invoiceMediaType("factuur", ""), null);
  assert.equal(invoiceMediaType("factuur.heic", "image/heic"), null);
});
