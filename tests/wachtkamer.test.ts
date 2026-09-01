import assert from "node:assert/strict";
import test from "node:test";
import {
  splitWachtkamer,
  wachtDagen,
  wachtLabel,
  type WachtkamerMarkering,
} from "../src/lib/wachtkamer";

// ---------------------------------------------------------------------------
// Een klein testrijtje: alleen wat splitWachtkamer nodig heeft (een id), zodat de
// helper puur op vorm werkt en niets van GateReviewRow hoeft te weten.
// ---------------------------------------------------------------------------

type Rij = { id: string; naam: string };

const rij = (id: string, naam = id): Rij => ({ id, naam });

/** 1 maart 2026, 12:00 — het vaste "nu" in deze tests. */
const NU = new Date("2026-03-01T12:00:00.000Z");

/** `dagen` dagen vóór NU (op hetzelfde tijdstip). */
function dagenGeleden(dagen: number): Date {
  return new Date(NU.getTime() - dagen * 86_400_000);
}

// ---------------------------------------------------------------------------
// wachtDagen — hoe lang staat dit al te wachten
// ---------------------------------------------------------------------------

test("wachtDagen telt hele dagen, dus vandaag geparkeerd is nul", () => {
  assert.equal(wachtDagen(NU, NU), 0);
  assert.equal(wachtDagen(dagenGeleden(0.9), NU), 0);
});

test("wachtDagen rondt naar beneden af — anderhalve dag is één dag", () => {
  assert.equal(wachtDagen(dagenGeleden(1), NU), 1);
  assert.equal(wachtDagen(dagenGeleden(1.5), NU), 1);
  assert.equal(wachtDagen(dagenGeleden(17), NU), 17);
});

test("een datum in de toekomst of een onzinnige datum levert nooit een negatief aantal op", () => {
  assert.equal(wachtDagen(new Date(NU.getTime() + 5 * 86_400_000), NU), 0);
  assert.equal(wachtDagen(new Date("onzin"), NU), 0);
  assert.equal(wachtDagen(NU, new Date("onzin")), 0);
});

// ---------------------------------------------------------------------------
// wachtLabel — dezelfde wachttijd, maar leesbaar in de lijst
// ---------------------------------------------------------------------------

test("de dag van parkeren leest als 'vandaag geparkeerd', niet als '0 dagen'", () => {
  assert.equal(wachtLabel(0), "vandaag geparkeerd");
});

test("enkelvoud en meervoud kloppen bij dagen", () => {
  assert.equal(wachtLabel(1), "1 dag");
  assert.equal(wachtLabel(2), "2 dagen");
  assert.equal(wachtLabel(6), "6 dagen");
});

test("vanaf een week telt het in weken, naar beneden afgerond", () => {
  assert.equal(wachtLabel(7), "1 week");
  assert.equal(wachtLabel(13), "1 week");
  assert.equal(wachtLabel(14), "2 weken");
  assert.equal(wachtLabel(30), "4 weken");
});

test("een onzinnig aantal dagen valt terug op vandaag", () => {
  assert.equal(wachtLabel(-3), "vandaag geparkeerd");
  assert.equal(wachtLabel(Number.NaN), "vandaag geparkeerd");
});

// ---------------------------------------------------------------------------
// splitWachtkamer — wie blijft er op het weekoverzicht, wie zit in de wachtkamer
// ---------------------------------------------------------------------------

test("zonder geparkeerde regels blijft alles gewoon te controleren", () => {
  const rows = [rij("a"), rij("b")];
  const uitkomst = splitWachtkamer({ rows, parked: [], now: NU });
  assert.deepEqual(uitkomst.teControleren, rows);
  assert.deepEqual(uitkomst.inWachtkamer, []);
});

test("een geparkeerde regel verdwijnt uit te controleren en komt met reden in de wachtkamer", () => {
  const parked: WachtkamerMarkering[] = [
    { id: "b", since: dagenGeleden(3), reason: "uren wijken af" },
  ];
  const uitkomst = splitWachtkamer({ rows: [rij("a"), rij("b"), rij("c")], parked, now: NU });

  assert.deepEqual(
    uitkomst.teControleren.map((r) => r.id),
    ["a", "c"],
  );
  assert.equal(uitkomst.inWachtkamer.length, 1);
  assert.equal(uitkomst.inWachtkamer[0].row.id, "b");
  assert.equal(uitkomst.inWachtkamer[0].reason, "uren wijken af");
  assert.equal(uitkomst.inWachtkamer[0].dagen, 3);
  assert.equal(uitkomst.inWachtkamer[0].wachtLabel, "3 dagen");
  assert.equal(uitkomst.inWachtkamer[0].since.getTime(), dagenGeleden(3).getTime());
});

test("de langst wachtende staat bovenaan", () => {
  const parked: WachtkamerMarkering[] = [
    { id: "a", since: dagenGeleden(2), reason: null },
    { id: "b", since: dagenGeleden(20), reason: null },
    { id: "c", since: dagenGeleden(9), reason: null },
  ];
  const uitkomst = splitWachtkamer({ rows: [rij("a"), rij("b"), rij("c")], parked, now: NU });

  assert.deepEqual(
    uitkomst.inWachtkamer.map((w) => w.row.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(uitkomst.teControleren, []);
});

test("even lang wachten houdt de volgorde van het overzicht aan", () => {
  const since = dagenGeleden(4);
  const parked: WachtkamerMarkering[] = [
    { id: "a", since, reason: null },
    { id: "b", since, reason: null },
  ];
  const uitkomst = splitWachtkamer({ rows: [rij("a"), rij("b")], parked, now: NU });
  assert.deepEqual(
    uitkomst.inWachtkamer.map((w) => w.row.id),
    ["a", "b"],
  );
});

test("een markering zonder datum parkeert niets — die regel hoort gewoon op het overzicht", () => {
  const parked: WachtkamerMarkering[] = [{ id: "a", since: null, reason: "wordt genegeerd" }];
  const uitkomst = splitWachtkamer({ rows: [rij("a")], parked, now: NU });
  assert.deepEqual(
    uitkomst.teControleren.map((r) => r.id),
    ["a"],
  );
  assert.deepEqual(uitkomst.inWachtkamer, []);
});

test("een markering voor een regel die er niet (meer) is wordt overgeslagen", () => {
  const parked: WachtkamerMarkering[] = [{ id: "weg", since: dagenGeleden(5), reason: null }];
  const uitkomst = splitWachtkamer({ rows: [rij("a")], parked, now: NU });
  assert.deepEqual(
    uitkomst.teControleren.map((r) => r.id),
    ["a"],
  );
  assert.deepEqual(uitkomst.inWachtkamer, []);
});

test("een lege of alleen-spaties reden telt als geen reden", () => {
  const parked: WachtkamerMarkering[] = [{ id: "a", since: dagenGeleden(1), reason: "   " }];
  const uitkomst = splitWachtkamer({ rows: [rij("a")], parked, now: NU });
  assert.equal(uitkomst.inWachtkamer[0].reason, null);
});

test("de reden mag ontbreken in de markering", () => {
  const uitkomst = splitWachtkamer({
    rows: [rij("a")],
    parked: [{ id: "a", since: dagenGeleden(1) }],
    now: NU,
  });
  assert.equal(uitkomst.inWachtkamer[0].reason, null);
});

test("de originele regel gaat ongewijzigd mee, zodat de wachtkamer alles kan tonen", () => {
  const a = rij("a", "Jan de Vries");
  const uitkomst = splitWachtkamer({
    rows: [a],
    parked: [{ id: "a", since: dagenGeleden(1), reason: "geen plaatsing" }],
    now: NU,
  });
  assert.equal(uitkomst.inWachtkamer[0].row, a);
  assert.equal(uitkomst.inWachtkamer[0].row.naam, "Jan de Vries");
});

test("rommelige invoer laat de helper niet omvallen", () => {
  const leeg = splitWachtkamer({
    rows: null as unknown as Rij[],
    parked: null as unknown as WachtkamerMarkering[],
    now: NU,
  });
  assert.deepEqual(leeg, { teControleren: [], inWachtkamer: [] });
});
