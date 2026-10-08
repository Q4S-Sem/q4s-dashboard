import assert from "node:assert/strict";
import test from "node:test";
import { afwijkingUrenstaat, herstelUren, twijfelFactuur, type InvoiceExtracted } from "../src/lib/invoice-extract";

const basis = { hours: 4, hourlyRate: 65, hoursLineAmount: 2600, notes: "", name: "J. Jansen", totalAmount: 2600, amountExclVat: 2600, vatShifted: true } as InvoiceExtracted;

test("verkeerd gelezen aantal → herstel uit bedrag ÷ tarief", () => {
  assert.equal(twijfelFactuur(basis), "uren × tarief ≠ bedrag op de urenregel (2340.00 verschil)");
  const h = herstelUren(basis);
  assert.equal(h.hours, 40);
  assert.match(h.notes, /aangepast van 4 naar 40/);
  // Geen net kwartier → niets aanpassen (liever een mens laten kijken).
  assert.equal(herstelUren({ ...basis, hoursLineAmount: 2601.13 }).hours, 4);
  assert.equal(herstelUren({ ...basis, hours: 40 }).notes, "");
});

test("afwijking met de urenstaat geeft een herlees-reden, dagen tellen ook", () => {
  assert.equal(afwijkingUrenstaat({ hours: 40 }, 40), null);
  assert.equal(afwijkingUrenstaat({ hours: 5 }, 40), null); // 5 dagen × 8 uur
  assert.match(afwijkingUrenstaat({ hours: 38 }, 40) ?? "", /urenstaat 40/);
  assert.equal(afwijkingUrenstaat({ hours: 38 }, null), null);
});
