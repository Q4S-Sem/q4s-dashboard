import { test } from "node:test";
import assert from "node:assert/strict";
import type { Contract } from "@prisma/client";
import { buildContractDoc } from "../src/lib/contract-doc";
import type { CompanySettings } from "../src/lib/settings";

test("art. 6: overuren en dagtarief per kolom komen op het contract", () => {
  const doc = buildContractDoc(
    {
      rateOvertime: "€ 80,-",
      overtimeShift: "+ 0 %",
      overtimeSaturday: "+ 10 %",
      overtimeSunday: "+ 20 %",
      overtimeOffshore: "",
      rateDayFixed: "€ 600,-",
      dayFixedShift: "€ 650,-",
      dayFixedSaturday: "€ 700,-",
      dayFixedSunday: "€ 750,-",
      dayFixedOffshore: "€ 800,-",
    } as unknown as Contract,
    {} as CompanySettings,
  );
  assert.equal(doc.rates.overtime, "€ 80,-");
  assert.deepEqual(doc.rates.overtimeCols, ["+ 0 %", "+ 10 %", "+ 20 %", ""]);
  assert.equal(doc.rates.dayFixed, "€ 600,-");
  assert.deepEqual(doc.rates.dayFixedCols, ["€ 650,-", "€ 700,-", "€ 750,-", "€ 800,-"]);
});
