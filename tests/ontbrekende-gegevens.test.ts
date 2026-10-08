import assert from "node:assert/strict";
import test from "node:test";
import { getoondeStatus, inMapActief, ontbrekendeGegevens, ontbrekendVoorActief } from "../src/lib/ontbrekende-gegevens";

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

test("plaatsing pas actief met klant, beide tarieven en complete werknemer", () => {
  const compleet = {
    employmentType: "LOONDIENST", phone: "06", email: "a@b.nl", address: "Straat 1",
    postalCode: "1234AB", city: "Rotterdam", dateOfBirth: new Date(1990, 0, 1),
    nationality: "NL", iban: "NL96INGB0007873625", bsn: "123456789",
  };
  assert.deepEqual(ontbrekendVoorActief({ heeftKlant: true, costRate: 80, chargeRate: 95 }, compleet), []);
  assert.deepEqual(
    ontbrekendVoorActief({ heeftKlant: false, costRate: 80, chargeRate: 0 }, { ...compleet, iban: "" }),
    ["Klant", "Verkooptarief", "IBAN"],
  );
});

test("map Actief (= facturatie): compleet of handmatig geforceerd; contract telt niet mee", () => {
  assert.equal(inMapActief({ status: "ACTIVE" }, ["IBAN"]), false);
  assert.equal(getoondeStatus({ status: "ACTIVE" }, ["IBAN"]), "INCOMPLETE");
  assert.equal(inMapActief({ status: "ACTIVE", forceActive: true }, ["IBAN"]), true);
  assert.equal(inMapActief({ status: "ACTIVE" }, []), true);
  assert.equal(inMapActief({ status: "INCOMPLETE" }, []), false);
  // Alleen geboortedatum mist → toch in Actief en in de facturatie.
  assert.equal(inMapActief({ status: "ACTIVE" }, ["Geboortedatum"]), true);
  assert.equal(getoondeStatus({ status: "ACTIVE" }, ["Geboortedatum"]), "ACTIVE");
  assert.equal(inMapActief({ status: "ACTIVE" }, ["Geboortedatum", "IBAN"]), false);
});

test("werknemer in dienst: geen inkooptarief nodig, wel verkooptarief", () => {
  const inDienst = {
    employmentType: "LOONDIENST", phone: "06", email: "a@b.nl", address: "Straat 1",
    postalCode: "1234AB", city: "Rotterdam", dateOfBirth: new Date(1990, 0, 1),
    nationality: "NL", iban: "NL96INGB0007873625", bsn: "123456789",
  };
  assert.deepEqual(ontbrekendVoorActief({ heeftKlant: true, costRate: 0, chargeRate: 95 }, inDienst), []);
  assert.deepEqual(ontbrekendVoorActief({ heeftKlant: true, costRate: 0, chargeRate: 0 }, inDienst), ["Verkooptarief"]);
  assert.deepEqual(
    ontbrekendVoorActief({ heeftKlant: true, costRate: 0, chargeRate: 95 }, { ...inDienst, employmentType: "ZZP", companyName: "X", kvkNumber: "1", vatNumber: "NL1" }),
    ["Inkooptarief"],
  );
});
