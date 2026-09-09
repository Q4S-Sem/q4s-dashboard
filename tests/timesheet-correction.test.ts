import assert from "node:assert/strict";
import test from "node:test";
import {
  LEARN_THRESHOLD,
  buildCorrectionHint,
  correctionFieldLabel,
  diffTimesheet,
  learnedSuggestions,
  type CorrectionPair,
} from "../src/lib/timesheet-correction-core";

// ---------------------------------------------------------------------------
// Het correctie-geheugen van de urenstaat-scan. We kunnen het AI-model niet
// bijtrainen; wat we WEL kunnen is onthouden wat de AI las en wat de mens ervan
// maakte, dat als aandachtspunt aan het volgende extractie-prompt meegeven, en
// een fout die de mens al twee keer op dezelfde manier verbeterde alvast (maar
// zichtbaar) voorstellen.
//
// Alles hier is puur: geen database, geen datum-van-nu, geen AI.
// ---------------------------------------------------------------------------

/** Een weekstaat zoals het scherm hem invult: dag-uren Ma..Zo + overuren + km. */
function week(
  dagUren: (string | number)[],
  overuren: string | number = "",
  kilometers: string | number = "",
) {
  return { dagUren, overuren, kilometers };
}

/** Dezelfde fout n keer achter elkaar in de historie. */
function historie(n: number, ai: CorrectionPair["ai"], human: CorrectionPair["human"]) {
  return Array.from({ length: n }, () => ({ ai, human }));
}

// --- diffTimesheet ---------------------------------------------------------

test("identieke uitlezing en bevestiging → geen enkel verschil", () => {
  const ai = week([8, 8, 8, 8, 8, 0, 0], 2, 120);
  const human = week(["8", "8", "8", "8", "8", "", ""], "2", "120");
  assert.deepEqual(diffTimesheet(ai, human), []);
});

test("een verkeerd gelezen dag komt terug als één verschil", () => {
  const diff = diffTimesheet(week([8, 8, 8, 8, 8]), week([8, 8, 6, 8, 8]));
  assert.deepEqual(diff, [{ field: "dag2", from: 8, to: 6 }]);
  assert.equal(correctionFieldLabel("dag2"), "Wo");
});

test("overuren en kilometers doen net zo goed mee", () => {
  const diff = diffTimesheet(week([8, 8, 8, 8, 8], 0, 0), week([8, 8, 8, 8, 8], 3, 220));
  assert.deepEqual(diff, [
    { field: "overuren", from: 0, to: 3 },
    { field: "kilometers", from: 0, to: 220 },
  ]);
  assert.equal(correctionFieldLabel("overuren"), "Overuren");
  assert.equal(correctionFieldLabel("kilometers"), "Kilometers");
});

test("leeg en 0 zijn hetzelfde: 'niet gewerkt' is geen correctie", () => {
  assert.deepEqual(diffTimesheet(week(["", "", 0], "", 0), week([0, "", ""], 0, "")), []);
});

test("het klassieke left-pack-probleem levert de verschoven dagen op", () => {
  // AI las 'Ma t/m Do 8', maar er was pas vanaf dinsdag gewerkt.
  const diff = diffTimesheet(week([8, 8, 8, 8, 0, 0, 0]), week([0, 8, 8, 8, 8, 0, 0]));
  assert.deepEqual(diff, [
    { field: "dag0", from: 8, to: 0 },
    { field: "dag4", from: 0, to: 8 },
  ]);
});

test("diffTimesheet is puur: invoer blijft ongemoeid, uitkomst herhaalbaar", () => {
  const ai = week([8, 8, 8, 8, 8], 0, 0);
  const human = week([8, 8, 6, 8, 8], 0, 0);
  const snapshot = JSON.stringify([ai, human]);
  assert.deepEqual(diffTimesheet(ai, human), diffTimesheet(ai, human));
  assert.equal(JSON.stringify([ai, human]), snapshot);
});

// --- learnedSuggestions ----------------------------------------------------

test("geen historie → geen suggesties", () => {
  assert.deepEqual(learnedSuggestions([], week([8, 8, 8, 8, 8])), []);
});

test("één eerdere correctie is te weinig — pas vanaf twee stellen we iets voor", () => {
  assert.equal(LEARN_THRESHOLD, 2);
  const eenmalig = historie(1, week([8, 8, 8, 8, 8]), week([8, 8, 6, 8, 8]));
  assert.deepEqual(learnedSuggestions(eenmalig, week([8, 8, 8, 8, 8])), []);
});

test("twee keer dezelfde correctie én de AI herhaalt de fout → voorstel met de juiste waarde", () => {
  const geschiedenis = historie(2, week([8, 8, 8, 8, 8]), week([8, 8, 6, 8, 8]));
  const suggesties = learnedSuggestions(geschiedenis, week([8, 8, 8, 8, 8]));
  assert.equal(suggesties.length, 1);
  assert.equal(suggesties[0].field, "dag2");
  assert.equal(suggesties[0].from, 8);
  assert.equal(suggesties[0].to, 6);
  assert.ok(suggesties[0].reason.length > 0);
});

test("geeft de AI de juiste waarde al, dan valt er niets te verbeteren", () => {
  const geschiedenis = historie(2, week([8, 8, 8, 8, 8]), week([8, 8, 6, 8, 8]));
  assert.deepEqual(learnedSuggestions(geschiedenis, week([8, 8, 6, 8, 8])), []);
});

test("de AI leest nu iets anders fout dan eerder → geen blinde correctie", () => {
  const geschiedenis = historie(2, week([8, 8, 8, 8, 8]), week([8, 8, 6, 8, 8]));
  // Woensdag staat nu op 4 — dat is niet de fout die de mens twee keer verbeterde.
  assert.deepEqual(learnedSuggestions(geschiedenis, week([8, 8, 4, 8, 8])), []);
});

test("twee keer dezelfde gemiste kilometers → voorstel voor de km", () => {
  const geschiedenis = historie(2, week([8, 8, 8, 8, 8], 0, 0), week([8, 8, 8, 8, 8], 0, 220));
  const suggesties = learnedSuggestions(geschiedenis, week([8, 8, 8, 8, 8], 0, 0));
  assert.deepEqual(
    suggesties.map((s) => ({ field: s.field, from: s.from, to: s.to })),
    [{ field: "kilometers", from: 0, to: 220 }],
  );
});

test("wisselende correcties op hetzelfde veld → niets voorstellen (te onzeker)", () => {
  const geschiedenis: CorrectionPair[] = [
    ...historie(2, week([8, 8, 8, 8, 8]), week([8, 8, 6, 8, 8])),
    ...historie(2, week([8, 8, 8, 8, 8]), week([8, 8, 4, 8, 8])),
  ];
  assert.deepEqual(learnedSuggestions(geschiedenis, week([8, 8, 8, 8, 8])), []);
});

test("de vaakst gemaakte correctie wint van een eenmalige uitschieter", () => {
  const geschiedenis: CorrectionPair[] = [
    ...historie(2, week([8, 8, 8, 8, 8]), week([8, 8, 6, 8, 8])),
    ...historie(1, week([8, 8, 8, 8, 8]), week([8, 8, 4, 8, 8])),
  ];
  const suggesties = learnedSuggestions(geschiedenis, week([8, 8, 8, 8, 8]));
  assert.deepEqual(
    suggesties.map((s) => ({ field: s.field, to: s.to })),
    [{ field: "dag2", to: 6 }],
  );
});

test("learnedSuggestions is puur: de historie wordt niet aangeraakt", () => {
  const geschiedenis = historie(2, week([8, 8, 8, 8, 8]), week([8, 8, 6, 8, 8]));
  const vers = week([8, 8, 8, 8, 8]);
  const snapshot = JSON.stringify([geschiedenis, vers]);
  assert.deepEqual(learnedSuggestions(geschiedenis, vers), learnedSuggestions(geschiedenis, vers));
  assert.equal(JSON.stringify([geschiedenis, vers]), snapshot);
});

// --- buildCorrectionHint ---------------------------------------------------

test("lege historie → lege hint (het prompt blijft dan onveranderd)", () => {
  assert.equal(buildCorrectionHint([]), "");
});

test("historie zonder afwijkingen levert ook geen hint op", () => {
  const gelijk = historie(2, week([8, 8, 8, 8, 8]), week([8, 8, 8, 8, 8]));
  assert.equal(buildCorrectionHint(gelijk), "");
});

test("de hint noemt het veld, wat de AI las en wat het moest zijn", () => {
  const hint = buildCorrectionHint(historie(2, week([8, 8, 8, 8, 8], 0, 0), week([8, 8, 6, 8, 8], 0, 220)));
  assert.ok(hint.includes("Wo"), hint);
  assert.ok(hint.includes("Kilometers"), hint);
  assert.ok(hint.includes("6"), hint);
  assert.ok(hint.includes("220"), hint);
});

test("de hint blijft compact: maximaal 4 regels", () => {
  const veel: CorrectionPair[] = [
    ...historie(2, week([8, 8, 8, 8, 8], 0, 0), week([0, 8, 8, 8, 8], 0, 0)),
    ...historie(2, week([8, 8, 8, 8, 8], 0, 0), week([8, 6, 8, 8, 8], 0, 0)),
    ...historie(2, week([8, 8, 8, 8, 8], 0, 0), week([8, 8, 6, 8, 8], 0, 0)),
    ...historie(2, week([8, 8, 8, 8, 8], 0, 0), week([8, 8, 8, 4, 8], 3, 0)),
    ...historie(2, week([8, 8, 8, 8, 8], 0, 0), week([8, 8, 8, 8, 8], 0, 220)),
  ];
  const regels = buildCorrectionHint(veel).split("\n");
  assert.ok(regels.length <= 4, `4 regels verwacht, kreeg er ${regels.length}`);
  assert.ok(regels.every((r) => r.trim().length > 0));
});

test("buildCorrectionHint is puur en herhaalbaar", () => {
  const geschiedenis = historie(2, week([8, 8, 8, 8, 8]), week([8, 8, 6, 8, 8]));
  const snapshot = JSON.stringify(geschiedenis);
  assert.equal(buildCorrectionHint(geschiedenis), buildCorrectionHint(geschiedenis));
  assert.equal(JSON.stringify(geschiedenis), snapshot);
});
