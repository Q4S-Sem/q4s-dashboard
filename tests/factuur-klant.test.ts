import assert from "node:assert/strict";
import test from "node:test";
import { factuurKlantInfo } from "../src/lib/factuur-klant";

const bedrijf = { contactName: "Finad", invoiceEmail: "invoices@hsm.nl", invoiceEmail2: "ap@hsm.nl", email: "info@hsm.nl" };

test("plaatsing wint van het bedrijf, leeg valt terug", () => {
  const r = factuurKlantInfo(bedrijf, [{ poNumber: "Wng-25-007", projectManager: "Dhr. J. N. Lemmerzaal" }]);
  assert.deepEqual(r, { purchaseOrder: "Wng-25-007", attention: "Finad", projectManager: "Dhr. J. N. Lemmerzaal", emailTo: "invoices@hsm.nl, ap@hsm.nl" });
  const p = factuurKlantInfo(bedrijf, [{ invoiceAttention: "M. Jansen", invoiceEmail: "proj@hsm.nl" }]);
  assert.equal(p.attention, "M. Jansen");
  assert.equal(p.emailTo, "proj@hsm.nl");
});

test("twee plaatsingen die verschillen: niets gokken", () => {
  const r = factuurKlantInfo(bedrijf, [{ poNumber: "A", projectManager: "X" }, { poNumber: "B", projectManager: "X" }]);
  assert.equal(r.purchaseOrder, null);
  assert.equal(r.projectManager, "X");
});

test("geen factuurmail bij bedrijf → algemene mail", () => {
  assert.equal(factuurKlantInfo({ email: "info@x.nl" }, []).emailTo, "info@x.nl");
});
