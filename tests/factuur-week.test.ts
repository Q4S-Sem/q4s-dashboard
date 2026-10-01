import test from "node:test";
import assert from "node:assert/strict";
test("ZZP-factuur: week volgt uit de periode op de factuur", () => {
import { toReceivedInvoiceFormValues } from "../src/lib/invoice-extract";
import { weekSlotVanDatum } from "../src/lib/week-koppeling";
const base:any={periodStart:"",periodEnd:"",weekNumber:"",year:""};
const now=new Date(2026,9,1);
// periode-datums (Balder: 24-08 t/m 30-08) → wk 35
assert.equal(weekSlotVanDatum(toReceivedInvoiceFormValues({...base,periodStart:"2026-08-24",periodEnd:"2026-08-30"},now).periodStart)?.key,"2026-W35");
// alleen weeknummer
assert.equal(weekSlotVanDatum(toReceivedInvoiceFormValues({...base,weekNumber:"35",year:"2026"},now).periodStart)?.key,"2026-W35");
// niets → null (fallback op scherm-week)
assert.equal(weekSlotVanDatum(toReceivedInvoiceFormValues(base,now).periodStart),null);
});
