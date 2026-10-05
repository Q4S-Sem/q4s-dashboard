import { test } from "node:test";
import assert from "node:assert/strict";
import { ontbrekendeContractVelden } from "../src/lib/contract-check";

test("contract-check: leeg contract mist alles, compleet contract niets", () => {
  assert.equal(ontbrekendeContractVelden({}).length, 12);
  const compleet = {
    number: "Q4S-OVO-2026-001",
    contractorName: "RvS Inspections",
    contractorAddress: "Rotterdam",
    contractorKvk: "81234567",
    contractorVat: "NL001234567B01",
    contractorIban: "NL96INGB0007873625",
    workDescription: "NDO-inspecties",
    startDate: new Date("2026-10-05"),
    projectDuration: "4 maanden", // einddatum mag ontbreken als de duur er staat
    rateDayFixed: "€ 650,-", // dagtarief telt ook als tarief
  };
  assert.deepEqual(ontbrekendeContractVelden(compleet), []);
  assert.deepEqual(ontbrekendeContractVelden({ ...compleet, contractorKvk: "  " }), ["KvK-nummer"]);
  assert.deepEqual(
    ontbrekendeContractVelden({ ...compleet, projectDuration: "", rateDayFixed: "" }),
    ["Einddatum of contractduur", "Uurtarief of dagtarief"],
  );
});
