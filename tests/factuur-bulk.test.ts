import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_OPEN_TABS,
  capOpen,
  invoicePdfHref,
  invoicePdfPreviewHref,
  isDeletableInvoice,
  isSendableInvoice,
  parseBulkIds,
  partitionBulk,
} from "../src/lib/factuur-bulk";

// ---------------------------------------------------------------------------
// De guards onder de selectie op /facturen (aanvinken → Openen / Verwijderen /
// Verzenden). De knoppen in de balk én de server-actions draaien HETZELFDE
// predicaat, zodat "wat je aanvinkt" en "wat er gebeurt" niet uit elkaar lopen.
//
// PUUR: geen database, geen fetch.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Wat mag weg, wat mag verstuurd
// ---------------------------------------------------------------------------

test("alleen een concept of geannuleerde factuur mag verwijderd worden", () => {
  assert.equal(isDeletableInvoice("DRAFT"), true);
  assert.equal(isDeletableInvoice("CANCELLED"), true);
  assert.equal(isDeletableInvoice("SENT"), false);
  assert.equal(isDeletableInvoice("PAID"), false);
  assert.equal(isDeletableInvoice("OVERDUE"), false);
  assert.equal(isDeletableInvoice(""), false);
});

test("alleen een concept mag verstuurd worden — precies de verzendmap-selectie", () => {
  assert.equal(isSendableInvoice("DRAFT"), true);
  assert.equal(isSendableInvoice("SENT"), false);
  assert.equal(isSendableInvoice("PAID"), false);
  assert.equal(isSendableInvoice("CANCELLED"), false);
  assert.equal(isSendableInvoice("OVERDUE"), false);
});

// ---------------------------------------------------------------------------
// parseBulkIds — de aangevinkte ids uit het verborgen formulierveld
// ---------------------------------------------------------------------------

test("de ids komen als kommalijst binnen en worden opgeschoond", () => {
  assert.deepEqual(parseBulkIds("a,b,c"), ["a", "b", "c"]);
  assert.deepEqual(parseBulkIds(" a , b ,, c , "), ["a", "b", "c"]);
});

test("dubbele ids tellen één keer, in de volgorde van aanvinken", () => {
  assert.deepEqual(parseBulkIds("b,a,b,a"), ["b", "a"]);
});

test("niets aangevinkt levert een lege lijst op", () => {
  assert.deepEqual(parseBulkIds(""), []);
  assert.deepEqual(parseBulkIds("   "), []);
  assert.deepEqual(parseBulkIds(undefined), []);
  assert.deepEqual(parseBulkIds(null), []);
});

// ---------------------------------------------------------------------------
// partitionBulk — welke van de aangevinkte facturen mogen echt
// ---------------------------------------------------------------------------

const rijen = [
  { id: "d1", status: "DRAFT" },
  { id: "d2", status: "DRAFT" },
  { id: "s1", status: "SENT" },
  { id: "p1", status: "PAID" },
  { id: "c1", status: "CANCELLED" },
];

test("verwijderen: concept en geannuleerd mogen, verstuurd/betaald wordt overgeslagen", () => {
  const res = partitionBulk(["d1", "s1", "p1", "c1"], rijen, isDeletableInvoice);
  assert.deepEqual(res.ids, ["d1", "c1"]);
  assert.equal(res.skipped, 2);
});

test("verzenden: alleen concepten gaan mee", () => {
  const res = partitionBulk(["d1", "d2", "c1", "s1"], rijen, isSendableInvoice);
  assert.deepEqual(res.ids, ["d1", "d2"]);
  assert.equal(res.skipped, 2);
});

test("een id dat niet (meer) bestaat telt als overgeslagen, niet als fout", () => {
  const res = partitionBulk(["d1", "weg"], rijen, isDeletableInvoice);
  assert.deepEqual(res.ids, ["d1"]);
  assert.equal(res.skipped, 1);
});

test("dubbel aangevinkte ids worden één keer verwerkt", () => {
  const res = partitionBulk(["d1", "d1", "d1"], rijen, isDeletableInvoice);
  assert.deepEqual(res.ids, ["d1"]);
  assert.equal(res.skipped, 0);
});

test("de volgorde van de selectie blijft behouden", () => {
  const res = partitionBulk(["d2", "d1"], rijen, isSendableInvoice);
  assert.deepEqual(res.ids, ["d2", "d1"]);
});

test("een lege selectie doet niets", () => {
  assert.deepEqual(partitionBulk([], rijen, isDeletableInvoice), { ids: [], skipped: 0 });
});

// ---------------------------------------------------------------------------
// Openen — dezelfde PDF-route als de verzendmap gebruikt
// ---------------------------------------------------------------------------

test("de PDF-link wijst naar de bestaande verkoop-PDF-route", () => {
  assert.equal(invoicePdfHref("abc123"), "/verzenden/verkoop/abc123/pdf");
});

test("de factuurdetail-preview embedt exact dezelfde PDF zonder PDF-toolbar", () => {
  assert.equal(
    invoicePdfPreviewHref("abc123"),
    "/verzenden/verkoop/abc123/pdf#toolbar=0&navpanes=0&view=FitH",
  );
});

test("openen wordt afgetopt zodat de browser de tabbladen niet blokkeert", () => {
  const veel = Array.from({ length: MAX_OPEN_TABS + 3 }, (_, i) => `id${i}`);
  const res = capOpen(veel);
  assert.equal(res.open.length, MAX_OPEN_TABS);
  assert.equal(res.capped, 3);
  assert.deepEqual(res.open[0], "id0");
});

test("tot en met de limiet gaat alles open en is er niets afgetopt", () => {
  const paar = ["a", "b", "c"];
  assert.deepEqual(capOpen(paar), { open: paar, capped: 0 });
  assert.deepEqual(capOpen([]), { open: [], capped: 0 });
});
