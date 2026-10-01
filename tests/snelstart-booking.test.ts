import assert from "node:assert/strict";
import test from "node:test";
import { receivedInvoiceBooking, type ReceivedInvoiceBookingSource } from "../src/lib/snelstart";

const factuur = (
  patch: Partial<ReceivedInvoiceBookingSource> = {},
): ReceivedInvoiceBookingSource => ({
  id: "cm9abcdefgh12345678",
  number: "F-2026-11",
  issueDate: new Date("2026-03-01T00:00:00"),
  createdAt: new Date("2026-03-09T08:30:00"),
  amount: 3025,
  vatAmount: 525,
  vatRate: null,
  periodStart: new Date("2026-02-16T00:00:00"),
  periodEnd: new Date("2026-02-28T00:00:00"),
  supplierName: "Jansen Lastechniek",
  supplierEmail: "jan@jansenlas.nl",
  supplierVat: "NL001234567B01",
  ...patch,
});

test("een ontvangen ZZP-factuur wordt een inkoopboeking met bedrag ex btw en een vervaldatum", () => {
  const booking = receivedInvoiceBooking(factuur(), 30);

  assert.deepEqual(booking, {
    number: "F-2026-11",
    issueDate: new Date("2026-03-01T00:00:00"),
    dueDate: new Date("2026-03-31T00:00:00"),
    relationName: "Jansen Lastechniek",
    relationEmail: "jan@jansenlas.nl",
    relationVat: "NL001234567B01",
    vatRate: 21,
    subtotal: 2500,
    total: 3025,
    description: "Ontvangen factuur Jansen Lastechniek (16-02-2026 – 28-02-2026)",
  });
});

test("een expliciet btw-tarief op de factuur gaat vóór het afgeleide tarief", () => {
  const booking = receivedInvoiceBooking(factuur({ amount: 1090, vatAmount: 90, vatRate: 9 }), 30);
  assert.equal(booking.vatRate, 9);
  assert.equal(booking.subtotal, 1000);
  assert.equal(booking.total, 1090);
});

test("zonder bekend btw-bedrag boeken we 0% in plaats van btw te verzinnen", () => {
  const booking = receivedInvoiceBooking(factuur({ amount: 1500, vatAmount: null, vatRate: 21 }), 30);
  assert.equal(booking.vatRate, 0);
  assert.equal(booking.subtotal, 1500);
  assert.equal(booking.total, 1500);
});

test("zonder factuurnummer of factuurdatum vallen we terug op de registratie zelf", () => {
  const booking = receivedInvoiceBooking(
    factuur({ number: "   ", issueDate: null, periodStart: null, periodEnd: null }),
    14,
  );

  assert.equal(booking.number, "ONTV-12345678");
  assert.deepEqual(booking.issueDate, new Date("2026-03-09T08:30:00"));
  assert.deepEqual(booking.dueDate, new Date("2026-03-23T08:30:00"));
  assert.equal(booking.description, "Ontvangen factuur Jansen Lastechniek");
});

test("het terugvalnummer is stabiel en afgeleid van het id, zodat herboeken hetzelfde nummer geeft", () => {
  const a = receivedInvoiceBooking(factuur({ number: null }), 30);
  const b = receivedInvoiceBooking(factuur({ number: null }), 30);
  assert.equal(a.number, b.number);
  assert.match(a.number, /^ONTV-[A-Z0-9]{8}$/);
});
