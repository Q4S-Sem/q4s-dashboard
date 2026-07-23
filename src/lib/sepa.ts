import { round2 } from "./utils";

// ---------------------------------------------------------------------------
// SEPA Credit Transfer (pain.001.001.03) — betaalbestand voor de bank (ING).
// IBAN-only: sinds SEPA hoeft er geen BIC meer in ("NOTPROVIDED" bij de agent),
// wat het simpel + robuust houdt. Je downloadt dit bestand en uploadt het in ING
// Zakelijk Bankieren, waar jij het nog moet goedkeuren — de app zet nooit zelf
// geld weg. Betalingen worden per gewenste uitvoerdatum (factuurdatum + termijn)
// gegroepeerd in aparte PmtInf-blokken.
// ---------------------------------------------------------------------------

export type SepaPayment = {
  creditorName: string;
  creditorIban: string;
  amount: number; // EUR, > 0
  /** Referentie (EndToEndId, ≤35 tekens) — bijv. het factuurnummer. */
  reference: string;
  /** Omschrijving voor de begunstigde (o.v.v.). */
  remittance: string;
  /** Gewenste uitvoerdatum. */
  executionDate: Date;
};

export type SepaInput = {
  debtorName: string;
  debtorIban: string;
  payments: SepaPayment[];
  /** Aanmaakmoment (voor MsgId + CreDtTm). */
  createdAt: Date;
};

export type SepaResult = { xml: string; count: number; total: number };

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const amt = (n: number) => n.toFixed(2);
const dateOnly = (d: Date) => new Date(d).toISOString().slice(0, 10);
const normIban = (s: string) => s.replace(/\s+/g, "").toUpperCase();
/** Alleen toegestane tekens voor Id-velden; ingekort tot 35. */
const id35 = (s: string) => (s.replace(/[^A-Za-z0-9./+?:()-]/g, "-").slice(0, 35) || "NOTPROVIDED");

/** Bouw een SEPA-overboekingsbestand (pain.001.001.03). */
export function buildSepaCreditTransfer(input: SepaInput): SepaResult {
  const pays = input.payments.filter((p) => p.amount > 0 && normIban(p.creditorIban));
  const total = round2(pays.reduce((s, p) => s + p.amount, 0));
  const stamp = input.createdAt.getTime();
  const msgId = id35(`Q4S-${stamp}`);
  const creDtTm = input.createdAt.toISOString().slice(0, 19);

  // Groepeer per uitvoerdatum → één PmtInf-blok per datum.
  const byDate = new Map<string, SepaPayment[]>();
  for (const p of pays) {
    const k = dateOnly(p.executionDate);
    const arr = byDate.get(k);
    if (arr) arr.push(p);
    else byDate.set(k, [p]);
  }

  let pmtInfBlocks = "";
  let idx = 0;
  for (const [execDate, group] of [...byDate.entries()].sort()) {
    idx += 1;
    const grpTotal = round2(group.reduce((s, p) => s + p.amount, 0));
    const txs = group
      .map(
        (p) => `
      <CdtTrfTxInf>
        <PmtId><EndToEndId>${esc(id35(p.reference))}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${amt(p.amount)}</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>
        <Cdtr><Nm>${esc(p.creditorName.slice(0, 70))}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${esc(normIban(p.creditorIban))}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${esc(p.remittance.slice(0, 140))}</Ustrd></RmtInf>
      </CdtTrfTxInf>`,
      )
      .join("");
    pmtInfBlocks += `
    <PmtInf>
      <PmtInfId>${esc(id35(`Q4S-${stamp}-${idx}`))}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${group.length}</NbOfTxs>
      <CtrlSum>${amt(grpTotal)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${execDate}</ReqdExctnDt>
      <Dbtr><Nm>${esc(input.debtorName.slice(0, 70))}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${esc(normIban(input.debtorIban))}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${txs}
    </PmtInf>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${esc(msgId)}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${pays.length}</NbOfTxs>
      <CtrlSum>${amt(total)}</CtrlSum>
      <InitgPty><Nm>${esc(input.debtorName.slice(0, 70))}</Nm></InitgPty>
    </GrpHdr>${pmtInfBlocks}
  </CstmrCdtTrfInitn>
</Document>`;

  return { xml, count: pays.length, total };
}
