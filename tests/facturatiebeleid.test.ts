import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FACTUURSTROOM,
  isOntvangenFactuurBetaalbaar,
  isVerzendtypeToegestaan,
} from "../src/lib/facturatiebeleid";

test("Q4S gebruikt de eigen factuur van de freelancer en maakt geen self-billing inkoopfactuur", () => {
  assert.deepEqual(FACTUURSTROOM, {
    freelancerDocument: "RECEIVED_INVOICE",
    customerDocument: "SALES_INVOICE",
    selfBillingEnabled: false,
  });
});

test("alleen een goedgekeurde ontvangen factuur mag naar SEPA", () => {
  assert.equal(isOntvangenFactuurBetaalbaar("APPROVED"), true);
  for (const status of ["NEW", "DISPUTED", "PAID", "CANCELLED", "DRAFT"]) {
    assert.equal(isOntvangenFactuurBetaalbaar(status), false, status);
  }
});

test("de verzendmap accepteert alleen verkoopfacturen naar klanten", () => {
  assert.equal(isVerzendtypeToegestaan("verkoop"), true);
  assert.equal(isVerzendtypeToegestaan("inkoop"), false);
  assert.equal(isVerzendtypeToegestaan("purchase"), false);
  assert.equal(isVerzendtypeToegestaan(""), false);
});

test("actieve routes kunnen geen self-billingfactuur maken of verzenden", () => {
  const invoicing = readFileSync(new URL("../src/lib/invoicing.ts", import.meta.url), "utf8");
  const verzendmap = readFileSync(
    new URL("../src/app/(app)/verzenden/page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(invoicing, /purchaseInvoice\.create/);
  assert.doesNotMatch(verzendmap, /Verstuur inkoop|Inkoop naar medewerkers|tab=inkoop/);
});

test("betalingen gebruikt de ontvangen freelancerfactuur als betaalbron", () => {
  const betalingen = readFileSync(new URL("../src/lib/betalingen.ts", import.meta.url), "utf8");

  assert.match(betalingen, /db\.receivedInvoice\.findMany/);
  assert.doesNotMatch(betalingen, /db\.purchaseInvoice/);
});
