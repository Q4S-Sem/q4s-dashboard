import assert from "node:assert/strict";
import test from "node:test";
import { parseCamt053 } from "../src/lib/camt053";

// Realistisch (ingekort) CAMT.053-afschrift zoals een Nederlandse bank het
// levert: één dagafschrift met twee bijschrijvingen (CRDT) en één afschrijving
// (DBIT), met entiteiten (&amp;), een <DtTm>-boekdatum en een EndToEndId dat op
// "NOTPROVIDED" staat.
const AFSCHRIFT = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>CAMT053-20260302</MsgId><CreDtTm>2026-03-05T02:15:00+01:00</CreDtTm></GrpHdr>
    <Stmt>
      <Id>NL02INGB0123456789EUR-2026-061</Id>
      <Acct><Id><IBAN>NL02 INGB 0123 4567 89</IBAN></Id><Ccy>EUR</Ccy></Acct>
      <Ntry>
        <Amt Ccy="EUR">12100.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>2026-03-02</Dt></BookgDt>
        <ValDt><Dt>2026-03-01</Dt></ValDt>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>2026-0042</EndToEndId></Refs>
          <RltdPties>
            <Dbtr><Nm>Heerema Fabrication Group B.V.</Nm></Dbtr>
            <DbtrAcct><Id><IBAN>NL44RABO0123456789</IBAN></Id></DbtrAcct>
          </RltdPties>
          <RmtInf><Ustrd>Betaling factuur 2026-0042</Ustrd><Ustrd>PO 88123</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">3025.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>2026-03-03</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>ZZP-2026-03</EndToEndId></Refs>
          <RltdPties>
            <Cdtr><Nm>Jansen Lastechniek</Nm></Cdtr>
            <CdtrAcct><Id><IBAN>NL91ABNA0417164300</IBAN></Id></CdtrAcct>
          </RltdPties>
          <RmtInf><Ustrd>Factuur F-2026-11 week 8 &amp; 9</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">605.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><DtTm>2026-03-04T00:00:00+01:00</DtTm></BookgDt>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>NOTPROVIDED</EndToEndId></Refs>
          <RltdPties><Dbtr><Nm>Van Dijk Industrie</Nm></Dbtr></RltdPties>
          <RmtInf><Ustrd>deelbetaling</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

test("parses a CAMT.053 statement into signed entries with counterparty and remittance", () => {
  const statements = parseCamt053(AFSCHRIFT);
  assert.equal(statements.length, 1);
  assert.equal(statements[0].id, "NL02INGB0123456789EUR-2026-061");
  assert.equal(statements[0].iban, "NL02INGB0123456789");

  assert.deepEqual(statements[0].entries, [
    {
      date: new Date("2026-03-02T00:00:00.000Z"),
      amount: 12100,
      currency: "EUR",
      counterpartyName: "Heerema Fabrication Group B.V.",
      counterpartyIban: "NL44RABO0123456789",
      remittance: "Betaling factuur 2026-0042 PO 88123",
      endToEndId: "2026-0042",
    },
    {
      date: new Date("2026-03-03T00:00:00.000Z"),
      amount: -3025,
      currency: "EUR",
      counterpartyName: "Jansen Lastechniek",
      counterpartyIban: "NL91ABNA0417164300",
      remittance: "Factuur F-2026-11 week 8 & 9",
      endToEndId: "ZZP-2026-03",
    },
    {
      date: new Date("2026-03-04T00:00:00.000Z"),
      amount: 605,
      currency: "EUR",
      counterpartyName: "Van Dijk Industrie",
      counterpartyIban: null,
      remittance: "deelbetaling",
      endToEndId: null,
    },
  ]);
});

test("a debit entry is negative and a credit entry positive, whatever the tag prefix", () => {
  const prefixed = `<?xml version="1.0"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <ns2:BkToCstmrStmt><ns2:Stmt>
    <ns2:Id>AFSCHRIFT-1</ns2:Id>
    <ns2:Acct><ns2:Id><ns2:IBAN>NL02INGB0123456789</ns2:IBAN></ns2:Id></ns2:Acct>
    <ns2:Ntry>
      <ns2:Amt Ccy="EUR">250.75</ns2:Amt>
      <ns2:CdtDbtInd>DBIT</ns2:CdtDbtInd>
      <ns2:ValDt><ns2:Dt>2026-04-01</ns2:Dt></ns2:ValDt>
    </ns2:Ntry>
  </ns2:Stmt></ns2:BkToCstmrStmt>
</ns2:Document>`;

  const [stmt] = parseCamt053(prefixed);
  assert.equal(stmt.id, "AFSCHRIFT-1");
  assert.equal(stmt.entries.length, 1);
  // Geen BookgDt → valutadatum is de terugval.
  assert.deepEqual(stmt.entries[0].date, new Date("2026-04-01T00:00:00.000Z"));
  assert.equal(stmt.entries[0].amount, -250.75);
  assert.equal(stmt.entries[0].counterpartyName, null);
  assert.equal(stmt.entries[0].remittance, "");
});

test("a batched entry keeps each underlying transaction as its own line", () => {
  const batched = `<Document><BkToCstmrStmt><Stmt><Id>S1</Id>
    <Ntry>
      <Amt Ccy="EUR">3000.00</Amt><CdtDbtInd>CRDT</CdtDbtInd>
      <BookgDt><Dt>2026-05-04</Dt></BookgDt>
      <NtryDtls>
        <TxDtls>
          <Amt Ccy="EUR">1000.00</Amt>
          <RltdPties><Dbtr><Nm>Klant A</Nm></Dbtr></RltdPties>
          <RmtInf><Ustrd>factuur 2026-0001</Ustrd></RmtInf>
        </TxDtls>
        <TxDtls>
          <Amt Ccy="EUR">2000.00</Amt>
          <RltdPties><Dbtr><Nm>Klant B</Nm></Dbtr></RltdPties>
          <RmtInf><Ustrd>factuur 2026-0002</Ustrd></RmtInf>
        </TxDtls>
      </NtryDtls>
    </Ntry>
  </Stmt></BkToCstmrStmt></Document>`;

  const [stmt] = parseCamt053(batched);
  assert.equal(stmt.entries.length, 2);
  assert.deepEqual(
    stmt.entries.map((e) => [e.amount, e.counterpartyName, e.remittance]),
    [
      [1000, "Klant A", "factuur 2026-0001"],
      [2000, "Klant B", "factuur 2026-0002"],
    ],
  );
  // De boekdatum van de verzamelboeking geldt voor elke onderliggende transactie.
  assert.deepEqual(stmt.entries[0].date, new Date("2026-05-04T00:00:00.000Z"));
});

test("een nog niet geboekte (PDNG) regel telt niet mee — dat is nog geen geld", () => {
  const metPending = `<Document><BkToCstmrStmt><Stmt><Id>S1</Id>
    <Ntry><Amt Ccy="EUR">100.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts><Cd>PDNG</Cd></Sts>
      <BookgDt><Dt>2026-06-01</Dt></BookgDt></Ntry>
    <Ntry><Amt Ccy="EUR">200.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts>
      <BookgDt><Dt>2026-06-02</Dt></BookgDt></Ntry>
  </Stmt></BkToCstmrStmt></Document>`;

  const [stmt] = parseCamt053(metPending);
  assert.deepEqual(
    stmt.entries.map((e) => e.amount),
    [200],
  );
});

test("niet-CAMT of kapotte invoer levert geen boekingen op in plaats van een crash", () => {
  assert.deepEqual(parseCamt053(""), []);
  assert.deepEqual(parseCamt053("dit is geen xml"), []);
  assert.deepEqual(parseCamt053("<html><body>oeps</body></html>"), []);
  // Wel een afschrift, maar zonder bruikbare boeking (geen bedrag).
  assert.deepEqual(
    parseCamt053("<Document><BkToCstmrStmt><Stmt><Id>S</Id><Ntry><CdtDbtInd>CRDT</CdtDbtInd></Ntry></Stmt></BkToCstmrStmt></Document>"),
    [{ id: "S", iban: null, entries: [] }],
  );
});
