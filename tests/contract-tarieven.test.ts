import assert from "node:assert/strict";
import test from "node:test";
import { leesWaarde, plaatsingUitContract } from "../src/lib/contract-tarieven";

test("geldbedragen en percentages van het contract lezen", () => {
  assert.deepEqual(leesWaarde("€ 78,-"), { bedrag: 78 });
  assert.deepEqual(leesWaarde("€ 1.234,50"), { bedrag: 1234.5 });
  assert.deepEqual(leesWaarde("78.50"), { bedrag: 78.5 });
  assert.deepEqual(leesWaarde("+ 10 %"), { pct: 10 });
  assert.equal(leesWaarde("zie uurtarief"), null);
  assert.equal(leesWaarde("€ 0,-"), null);
});

test("ZZP-contract → inkoopkant van de plaatsing", () => {
  const { data } = plaatsingUitContract(
    {
      rateDay: "€ 78,-",
      rateOvertime: "€ 80,-",
      rateSaturday: "€ 80,-",
      rateSunday: "€ 90,-",
      rateShift: "€ 78,-", // gelijk aan basis → geen toeslag
      rateOffshore: "+ 15 %",
      kmRate: "€ 0,21",
      startDate: "2026-08-03",
    },
    "inkoop",
  );
  assert.equal(data.costRate, 78);
  assert.equal(data.rateUnit, "HOUR");
  assert.equal(data.overtimeCostRate, 80);
  assert.equal(data.saturdaySurchargeBuy, 2);
  assert.equal(data.saturdaySurchargeUnit, "FIXED");
  assert.equal(data.sundaySurchargeBuy, 12);
  assert.equal(data.shiftSurchargeBuy, undefined);
  assert.equal(data.offshoreSurchargeBuy, 15);
  assert.equal(data.offshoreSurchargeUnit, "PCT");
  assert.equal(data.offshoreEnabled, true);
  assert.equal(data.kmRateBuy, 0.21);
  assert.equal(data.chargeRate, undefined); // verkoop blijft onaangeroerd
  assert.equal((data.startDate as Date).getDate(), 3);
});

test("klantcontract → verkoopkant, dagtarief", () => {
  const { data } = plaatsingUitContract({ rateDayFixed: "€ 760,-", rateSaturday: "+ 25 %" }, "verkoop");
  assert.equal(data.chargeRate, 760);
  assert.equal(data.rateUnit, "DAY");
  assert.equal(data.saturdaySurchargeSell, 25);
  assert.equal(data.saturdaySurchargeSellUnit, "PCT");
  assert.equal(data.costRate, undefined);
});
