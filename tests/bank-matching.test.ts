import assert from "node:assert/strict";
import test from "node:test";
import {
  matchBankEntries,
  type OpenReceivedInvoice,
  type OpenSalesInvoice,
} from "../src/lib/bank-matching";
import type { CamtEntry } from "../src/lib/camt053";
import { formatCurrency } from "../src/lib/utils";

const boeking = (patch: Partial<CamtEntry> & { amount: number }): CamtEntry => ({
  date: new Date("2026-03-02T00:00:00.000Z"),
  currency: "EUR",
  counterpartyName: null,
  counterpartyIban: null,
  remittance: "",
  endToEndId: null,
  ...patch,
});

const verkoop = (patch: Partial<OpenSalesInvoice> & { id: string }): OpenSalesInvoice => ({
  number: patch.id,
  clientName: "Heerema Fabrication Group",
  total: 12100,
  ...patch,
});

const ontvangen = (patch: Partial<OpenReceivedInvoice> & { id: string }): OpenReceivedInvoice => ({
  number: null,
  firstName: "Jan",
  lastName: "Jansen",
  companyName: null,
  iban: null,
  amount: 3025,
  ...patch,
});

test("een bijschrijving met het factuurnummer in de omschrijving én het juiste bedrag is een harde match", () => {
  const [row] = matchBankEntries({
    entries: [
      boeking({
        amount: 12100,
        counterpartyName: "Heerema Fabrication Group B.V.",
        remittance: "Betaling factuur 2026-0042 PO 88123",
      }),
    ],
    salesInvoices: [verkoop({ id: "inv-1", number: "2026-0042" })],
    receivedInvoices: [],
  });

  assert.equal(row.kind, "sales");
  assert.equal(row.invoiceId, "inv-1");
  assert.equal(row.invoiceNumber, "2026-0042");
  assert.equal(row.confidence, "hoog");
  assert.equal(row.preselected, true);
  assert.equal(
    row.reason,
    "Factuurnummer 2026-0042 staat in de omschrijving en het bedrag komt exact overeen.",
  );
});

test("factuurnummer herkend maar een afwijkend bedrag blijft 'midden' en wordt niet voorgevinkt", () => {
  const [row] = matchBankEntries({
    entries: [boeking({ amount: 6000, remittance: "deelbetaling fact. 2026-0042" })],
    salesInvoices: [verkoop({ id: "inv-1", number: "2026-0042", total: 12100 })],
    receivedInvoices: [],
  });

  assert.equal(row.invoiceId, "inv-1");
  assert.equal(row.confidence, "midden");
  assert.equal(row.preselected, false);
  assert.equal(
    row.reason,
    `Factuurnummer 2026-0042 staat in de omschrijving, maar het bedrag wijkt af (afschrift ${formatCurrency(6000)} vs factuur ${formatCurrency(12100)}).`,
  );
});

test("zonder factuurnummer telt een exact bedrag plus een herkenbare klantnaam als harde match", () => {
  const [row] = matchBankEntries({
    entries: [
      boeking({
        amount: 12100,
        counterpartyName: "HEEREMA FABRICATION GROUP BV",
        remittance: "SEPA overboeking",
      }),
    ],
    salesInvoices: [verkoop({ id: "inv-1", number: "2026-0042" })],
    receivedInvoices: [],
  });

  assert.equal(row.invoiceId, "inv-1");
  assert.equal(row.confidence, "hoog");
  assert.equal(row.preselected, true);
  assert.match(row.reason, /naam op het afschrift/);
});

test("alleen een bedragtreffer is zwak: 'laag' en nooit voorgevinkt", () => {
  const [row] = matchBankEntries({
    entries: [boeking({ amount: 12100, counterpartyName: "Onbekende Partij", remittance: "" })],
    salesInvoices: [verkoop({ id: "inv-1", number: "2026-0042" })],
    receivedInvoices: [],
  });

  assert.equal(row.invoiceId, "inv-1");
  assert.equal(row.confidence, "laag");
  assert.equal(row.preselected, false);
});

test("meerdere openstaande facturen met exact hetzelfde bedrag leveren geen voorstel op", () => {
  const [row] = matchBankEntries({
    entries: [boeking({ amount: 12100, counterpartyName: "Onbekende Partij" })],
    salesInvoices: [
      verkoop({ id: "inv-1", number: "2026-0042" }),
      verkoop({ id: "inv-2", number: "2026-0043", clientName: "Van Dijk Industrie" }),
    ],
    receivedInvoices: [],
  });

  assert.equal(row.invoiceId, null);
  assert.equal(row.confidence, "geen");
  assert.equal(row.preselected, false);
  assert.match(row.reason, /Meerdere openstaande facturen/);
});

test("een afschrijving matcht op bedrag plus de IBAN van de freelancer", () => {
  const [row] = matchBankEntries({
    entries: [
      boeking({
        amount: -3025,
        counterpartyName: "J JANSEN LASTECHNIEK",
        counterpartyIban: "NL91 ABNA 0417 1643 00",
        remittance: "uitbetaling week 8",
      }),
    ],
    salesInvoices: [],
    receivedInvoices: [ontvangen({ id: "ont-1", iban: "NL91ABNA0417164300" })],
  });

  assert.equal(row.kind, "received");
  assert.equal(row.invoiceId, "ont-1");
  assert.equal(row.confidence, "hoog");
  assert.equal(row.preselected, true);
  assert.match(row.reason, /tegenrekening/);
});

test("een afschrijving matcht ook op bedrag plus de volledige naam van de freelancer", () => {
  const [row] = matchBankEntries({
    entries: [boeking({ amount: -3025, counterpartyName: "Jan Jansen" })],
    salesInvoices: [],
    receivedInvoices: [ontvangen({ id: "ont-1" })],
  });

  assert.equal(row.invoiceId, "ont-1");
  assert.equal(row.confidence, "hoog");
});

test("een deelnaam koppelt niet: 'J. Jansen' is nog geen Johannes Jansen", () => {
  const [row] = matchBankEntries({
    entries: [boeking({ amount: -3025, counterpartyName: "J. Jansen" })],
    salesInvoices: [],
    receivedInvoices: [ontvangen({ id: "ont-1", firstName: "Johannes", lastName: "Jansen" })],
  });

  assert.equal(row.invoiceId, "ont-1");
  assert.equal(row.confidence, "laag");
  assert.equal(row.preselected, false);
});

test("een bijschrijving kijkt alleen naar verkoopfacturen en een afschrijving alleen naar ontvangen facturen", () => {
  const rows = matchBankEntries({
    entries: [
      boeking({ amount: 3025, remittance: "factuur F-2026-11" }),
      boeking({ amount: -12100, remittance: "factuur 2026-0042" }),
    ],
    salesInvoices: [verkoop({ id: "inv-1", number: "2026-0042" })],
    receivedInvoices: [ontvangen({ id: "ont-1", number: "F-2026-11" })],
  });

  assert.deepEqual(
    rows.map((r) => [r.kind, r.invoiceId, r.confidence]),
    [
      ["sales", null, "geen"],
      ["received", null, "geen"],
    ],
  );
});

test("dezelfde factuur wordt nooit aan twee boekingen toegewezen; de sterkste treffer wint", () => {
  const rows = matchBankEntries({
    entries: [
      // Zwak: alleen het bedrag.
      boeking({ amount: 12100, counterpartyName: "Onbekend" }),
      // Sterk: factuurnummer én bedrag.
      boeking({ amount: 12100, remittance: "voldoening 2026-0042" }),
    ],
    salesInvoices: [verkoop({ id: "inv-1", number: "2026-0042" })],
    receivedInvoices: [],
  });

  assert.equal(rows[1].invoiceId, "inv-1");
  assert.equal(rows[1].confidence, "hoog");
  assert.equal(rows[0].invoiceId, null);
  assert.equal(rows[0].confidence, "geen");
  assert.match(rows[0].reason, /andere boeking/);
  // De volgorde van het afschrift blijft staan.
  assert.deepEqual(
    rows.map((r) => r.index),
    [0, 1],
  );
});

test("zonder openstaande facturen of zonder bedrag komt er geen voorstel", () => {
  const rows = matchBankEntries({
    entries: [boeking({ amount: 500 }), boeking({ amount: 0 })],
    salesInvoices: [],
    receivedInvoices: [],
  });

  assert.deepEqual(
    rows.map((r) => [r.invoiceId, r.confidence, r.preselected]),
    [
      [null, "geen", false],
      [null, "geen", false],
    ],
  );
  assert.match(rows[1].reason, /zonder bedrag/);
});

test("een te kort factuurnummer wordt niet blind in de omschrijving gezocht", () => {
  const [row] = matchBankEntries({
    entries: [boeking({ amount: 999, remittance: "ordernr 7712 spoed" })],
    salesInvoices: [verkoop({ id: "inv-1", number: "77", total: 1 })],
    receivedInvoices: [],
  });

  assert.equal(row.invoiceId, null);
  assert.equal(row.confidence, "geen");
});
