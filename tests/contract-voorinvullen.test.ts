import assert from "node:assert/strict";
import test from "node:test";
import { contractUitPlaatsing, plaatsingUitContract } from "../src/lib/contract-tarieven";

const persoon = {
  firstName: "Rob", lastName: "Van Son", companyName: "Van Son Quality Control", address: "Dorpsstraat 1",
  postalCode: "1234AB", city: "Rotterdam", kvkNumber: "72946105", vatNumber: "NL001B01", iban: "NL91ABNA0417164300",
};
const plaatsing = {
  title: "QC Lead", startDate: new Date(2026, 0, 5), endDate: null, costRate: 78, rateUnit: "HOUR",
  overtimeCostRate: 85.5, kmRateBuy: 0.23, workLocation: "Maasvlakte", vatReverseCharge: true,
  client: { companyName: "KBR" },
  saturdaySurchargeBuy: 10, saturdaySurchargeUnit: "FIXED", sundaySurchargeBuy: 50, sundaySurchargeUnit: "PCT",
  shiftSurchargeBuy: 5, shiftSurchargeUnit: "FIXED", shiftEnabled: false,
  offshoreSurchargeBuy: 0, offshoreSurchargeUnit: "PCT", offshoreEnabled: false,
};

test("plaatsing → contract: partijen, opdracht en tarieven voor-ingevuld", () => {
  const c = contractUitPlaatsing(persoon, plaatsing);
  assert.equal(c.contractorName, "Van Son Quality Control");
  assert.equal(c.contractorAddress, "Dorpsstraat 1, 1234AB Rotterdam");
  assert.equal(c.thirdParty, "KBR — Maasvlakte");
  assert.equal(c.rateDay, "€ 78,-");
  assert.equal(c.rateOvertime, "€ 85,50");
  assert.equal(c.rateSaturday, "€ 88,-");
  assert.equal(c.rateSunday, "50 %");
  assert.equal(c.rateShift, undefined); // shift staat uit
});

test("heen en terug: contract → plaatsing geeft dezelfde inkooptarieven", () => {
  const c = contractUitPlaatsing(persoon, plaatsing);
  const tekst = Object.fromEntries(Object.entries(c).filter(([, v]) => typeof v === "string"));
  const { data } = plaatsingUitContract(tekst, "inkoop");
  assert.equal(data.costRate, 78);
  assert.equal(data.overtimeCostRate, 85.5);
  assert.equal(data.saturdaySurchargeBuy, 10);
  assert.equal(data.sundaySurchargeBuy, 50);
  assert.equal(data.kmRateBuy, 0.23);
});

test("zonder plaatsing: alleen de persoonsgegevens", () => {
  const c = contractUitPlaatsing({ ...persoon, companyName: null }, null);
  assert.equal(c.contractorName, "Rob Van Son");
  assert.equal(c.rateDay, undefined);
});
