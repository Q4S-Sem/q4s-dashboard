import assert from "node:assert/strict";
import test from "node:test";
import { toReceivedInvoiceFormValues, type InvoiceExtracted } from "../src/lib/invoice-extract";
import { weekSlotVanDatum } from "../src/lib/week-koppeling";

// Een ZZP-factuur hoort in de week van ZIJN periode, niet in de week waarop hij
// geüpload werd (registreerOntvangenFactuur rekent zo de weekKey uit).
const NU = new Date(2026, 9, 1);
const week = (d: Record<string, string>) =>
  weekSlotVanDatum(
    toReceivedInvoiceFormValues(
      { periodStart: "", periodEnd: "", weekNumber: "", year: "", ...d } as unknown as InvoiceExtracted,
      NU,
    ).periodStart,
  )?.key ?? null;

test("ZZP-factuur: week volgt uit de periode op de factuur", () => {
  // Echte periode-datums (24-08 t/m 30-08-2026) -> week 35.
  assert.equal(week({ periodStart: "2026-08-24", periodEnd: "2026-08-30" }), "2026-W35");
  // Alleen een weeknummer.
  assert.equal(week({ weekNumber: "35", year: "2026" }), "2026-W35");
  // Niets -> null: dan valt hij terug op de week van het scherm.
  assert.equal(week({}), null);
});
