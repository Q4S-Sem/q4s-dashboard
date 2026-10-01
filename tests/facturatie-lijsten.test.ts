import assert from "node:assert/strict";
import test from "node:test";
import {
  hoortBijInkoopTab,
  hoortBijVerkoopTab,
  inkoopBucket,
  inkoopTellingen,
  isInkoopBetaalbaar,
  isVerkoopTeLaat,
  verkoopTellingen,
  verkoopWeergaveStatus,
  type InkoopRij,
  type VerkoopRij,
} from "../src/lib/facturatie-lijsten";

const NU = new Date("2026-10-01T09:00:00.000Z");

const concept: VerkoopRij = { status: "DRAFT", dueDate: new Date("2026-09-01") };
const klaar: VerkoopRij = { status: "READY", dueDate: new Date("2026-09-01") };
const verzondenOpTijd: VerkoopRij = { status: "SENT", dueDate: new Date("2026-10-20") };
const verzondenTeLaat: VerkoopRij = { status: "SENT", dueDate: new Date("2026-09-20") };
const betaald: VerkoopRij = { status: "PAID", dueDate: new Date("2026-08-01") };
const geannuleerd: VerkoopRij = { status: "CANCELLED", dueDate: new Date("2026-08-01") };

test("alleen een verstuurde factuur over de vervaldatum is te laat", () => {
  assert.equal(isVerkoopTeLaat(verzondenTeLaat, NU), true);
  assert.equal(isVerkoopTeLaat(verzondenOpTijd, NU), false);
  // Een concept of een betaalde factuur is nooit "te laat": er valt niets te innen.
  assert.equal(isVerkoopTeLaat(concept, NU), false);
  assert.equal(isVerkoopTeLaat(betaald, NU), false);
  assert.equal(isVerkoopTeLaat(geannuleerd, NU), false);
});

test("de weergavestatus toont OVERDUE zonder de ruwe status te veranderen", () => {
  assert.equal(verkoopWeergaveStatus(verzondenTeLaat, NU), "OVERDUE");
  assert.equal(verkoopWeergaveStatus(verzondenOpTijd, NU), "SENT");
  assert.equal(verkoopWeergaveStatus(concept, NU), "DRAFT");
  // De rij zelf blijft ongemoeid — acties kijken naar `status`, niet naar de badge.
  assert.equal(verzondenTeLaat.status, "SENT");
});

test("een te late factuur staat zowel bij Verzonden als bij Te laat", () => {
  assert.equal(hoortBijVerkoopTab(verzondenTeLaat, "verzonden", NU), true);
  assert.equal(hoortBijVerkoopTab(verzondenTeLaat, "telaat", NU), true);
  assert.equal(hoortBijVerkoopTab(verzondenOpTijd, "telaat", NU), false);
});

test("elk verkoop-tabblad toont exact zijn eigen statussen", () => {
  assert.equal(hoortBijVerkoopTab(concept, "concept", NU), true);
  assert.equal(hoortBijVerkoopTab(klaar, "concept", NU), false);
  assert.equal(hoortBijVerkoopTab(klaar, "klaar", NU), true);
  assert.equal(hoortBijVerkoopTab(betaald, "betaald", NU), true);
  assert.equal(hoortBijVerkoopTab(geannuleerd, "geannuleerd", NU), true);
  assert.equal(hoortBijVerkoopTab(geannuleerd, "alles", NU), true);
});

test("de verkoop-tellingen komen overeen met wat elk tabblad toont", () => {
  const rows = [concept, concept, klaar, verzondenOpTijd, verzondenTeLaat, betaald, geannuleerd];
  assert.deepEqual(verkoopTellingen(rows, NU), {
    alles: 7,
    concept: 2,
    klaar: 1,
    verzonden: 2,
    telaat: 1,
    betaald: 1,
    geannuleerd: 1,
  });
});

test("een vervaldatum als ISO-tekst telt hetzelfde als een Date", () => {
  assert.equal(isVerkoopTeLaat({ status: "SENT", dueDate: "2026-09-20" }, NU), true);
  assert.equal(isVerkoopTeLaat({ status: "SENT", dueDate: "2026-10-20" }, NU), false);
  // Onleesbare datum → tijd 0 → geldt als lang verstreken, dus zichtbaar i.p.v. stil weg.
  assert.equal(isVerkoopTeLaat({ status: "SENT", dueDate: "rommel" }, NU), true);
});

// ---------------------------------------------------------------------------

test("elke ontvangen factuur valt in precies één bakje", () => {
  const rijen: { rij: InkoopRij; bucket: string }[] = [
    { rij: { status: "PAID", matched: false }, bucket: "betaald" },
    { rij: { status: "DISPUTED", matched: true }, bucket: "afwijking" },
    { rij: { status: "APPROVED", matched: false }, bucket: "afwijking" },
    { rij: { status: "APPROVED", matched: true }, bucket: "tebetalen" },
    { rij: { status: "APPROVED", matched: null }, bucket: "tebetalen" },
    { rij: { status: "NEW", matched: true }, bucket: "controleren" },
    { rij: { status: "NEW", matched: null }, bucket: "controleren" },
  ];
  for (const { rij, bucket } of rijen) {
    assert.equal(inkoopBucket(rij), bucket, JSON.stringify(rij));
    const treffers = (["controleren", "tebetalen", "betaald", "afwijking"] as const).filter((t) =>
      hoortBijInkoopTab(rij, t),
    );
    assert.deepEqual(treffers, [bucket], `${JSON.stringify(rij)} hoort in één tabblad`);
  }
});

test("betaald is een eindstation — een afwijking haalt hem er niet meer uit", () => {
  assert.equal(inkoopBucket({ status: "PAID", matched: false }), "betaald");
  assert.equal(isInkoopBetaalbaar({ status: "PAID", matched: true }), false);
});

test("alleen een goedgekeurde factuur zonder afwijking is betaalbaar", () => {
  assert.equal(isInkoopBetaalbaar({ status: "APPROVED", matched: true }), true);
  assert.equal(isInkoopBetaalbaar({ status: "APPROVED", matched: false }), false);
  assert.equal(isInkoopBetaalbaar({ status: "NEW", matched: true }), false);
  assert.equal(isInkoopBetaalbaar({ status: "DISPUTED", matched: true }), false);
});

test("de inkoop-tellingen tellen op tot het totaal", () => {
  const rows: InkoopRij[] = [
    { status: "NEW", matched: null },
    { status: "NEW", matched: true },
    { status: "APPROVED", matched: true },
    { status: "APPROVED", matched: false },
    { status: "DISPUTED", matched: null },
    { status: "PAID", matched: true },
  ];
  const t = inkoopTellingen(rows);
  assert.deepEqual(t, { alles: 6, controleren: 2, tebetalen: 1, betaald: 1, afwijking: 2 });
  assert.equal(t.controleren + t.tebetalen + t.betaald + t.afwijking, t.alles);
});

test("het declaraties-tabblad bevat nooit een ontvangen factuur", () => {
  assert.equal(hoortBijInkoopTab({ status: "APPROVED", matched: true }, "declaraties"), false);
  assert.equal(hoortBijInkoopTab({ status: "NEW", matched: null }, "alles"), true);
});
