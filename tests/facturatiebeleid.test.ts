import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FACTUURSTROOM, isOntvangenFactuurBetaalbaar } from "../src/lib/facturatiebeleid";

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

test("actieve routes kunnen geen self-billingfactuur maken of verzenden", () => {
  const lees = (pad: string) => readFileSync(new URL(pad, import.meta.url), "utf8");
  const invoicing = lees("../src/lib/invoicing.ts");
  // De enige PDF-route die Q4S naar buiten stuurt, en de lijst eromheen.
  const pdfRoute = lees("../src/app/(app)/facturatie/verkoop/[id]/pdf/route.ts");
  const verkoopActies = lees("../src/app/(app)/facturatie/verkoop/actions.ts");

  assert.doesNotMatch(invoicing, /purchaseInvoice\.create/);
  // De verzendweg kent alleen `Invoice` (verkoop) — geen inkoopdocument.
  assert.doesNotMatch(pdfRoute, /purchaseInvoice/);
  assert.match(pdfRoute, /db\.invoice\.findUnique/);
  assert.doesNotMatch(verkoopActies, /purchaseInvoice/);
});

test("betalingen gebruikt de ontvangen freelancerfactuur als betaalbron", () => {
  const betalingen = readFileSync(new URL("../src/lib/betalingen.ts", import.meta.url), "utf8");

  assert.match(betalingen, /db\.receivedInvoice\.findMany/);
  assert.doesNotMatch(betalingen, /db\.purchaseInvoice/);
});
