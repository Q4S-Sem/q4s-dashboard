import assert from "node:assert/strict";
import test from "node:test";
import { ontbrekendeGegevens } from "../src/lib/ontbrekende-gegevens";

test("ZZP zonder IBAN, BTW en telefoon → die drie ontbreken", () => {
  const m = ontbrekendeGegevens({
    employmentType: "ZZP",
    email: "hartman.metaal@gmail.com",
    address: "Wilgenhof 30",
    postalCode: "4289JB",
    city: "Giessen",
    dateOfBirth: new Date(1980, 0, 1),
    nationality: "NL",
    companyName: "Hartman Metaalwerken",
    kvkNumber: "18090024",
    vatNumber: " ",
  });
  assert.deepEqual(m, ["Telefoon", "IBAN", "BTW-nummer"]);
});

test("loondienst: geen bedrijfsgegevens nodig, wel BSN", () => {
  const m = ontbrekendeGegevens({ employmentType: "LOONDIENST" });
  assert.ok(m.includes("BSN"));
  assert.ok(!m.includes("KvK-nummer"));
});
