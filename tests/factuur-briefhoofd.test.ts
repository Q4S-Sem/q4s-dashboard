import assert from "node:assert/strict";
import test from "node:test";
import { sampleInvoiceDoc } from "../src/lib/verzenden";

test("factuur: Q4S-briefhoofd altijd compleet, ook met lege instellingen", () => {
  const leeg = { companyName: "Q4S", address: "", postalCode: "", city: "", country: "Nederland", iban: "", bic: "", vatNumber: "", kvkNumber: "", gAccount: "", email: "", phone: "", website: "", invoicePrefix: "", defaultPaymentTermDays: 30, defaultVatRate: 21 } as never;
  const c = sampleInvoiceDoc(leeg).company;
  assert.equal(c.name, "Q4S B.V.");
  assert.deepEqual(c.addressLines, ["Arnhemseweg 12", "2994 LA Barendrecht", "The Netherlands"]);
  assert.equal(c.iban, "NL96INGB0007873625");
  assert.equal(c.bic, "INGBNL2A");
  assert.equal(c.vatNumber, "NL857718137B01");
  assert.equal(c.kvkNumber, "69073287");
  assert.equal(c.gAccount, "NL94INGB0990303241");
  assert.deepEqual(c.contactLines, ["Tel: +31(0) 85 782 6818", "www.q4s.nl", "info@q4s.nl"]);
});
