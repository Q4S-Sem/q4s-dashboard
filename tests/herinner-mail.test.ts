import assert from "node:assert/strict";
import test from "node:test";
import { buildReminderEmail, type ReminderEmailInput } from "../src/lib/herinner-mail";

// ---------------------------------------------------------------------------
// buildReminderEmail — de INHOUD van de wekelijkse herinnering.
//
// Puur: naam + week erin, Nederlandse tekst eruit. Geen Prisma, geen verzending,
// geen datum-van-nu. Deze tests leggen de takken vast die de weekverwerking kan
// opleveren (met/zonder deadline, met/zonder week, lege naam) plus de puurheid.
// ---------------------------------------------------------------------------

/** Een volledig gevuld geval; elke test past aan wat hij nodig heeft. */
function invoer(overrides: Partial<ReminderEmailInput> = {}): ReminderEmailInput {
  return {
    freelancerName: "Jan de Vries",
    weekLabel: "Week 12 · 2026",
    ...overrides,
  };
}

/** Alle tekstregels van de herinnering als één blok — makkelijk in zoeken. */
function tekst(mail: ReturnType<typeof buildReminderEmail>): string {
  return [mail.subject, mail.greeting, ...mail.bodyLines, mail.signature].join("\n");
}

// ---------------------------------------------------------------------------
// Onderwerp, aanhef en afsluiting
// ---------------------------------------------------------------------------

test("onderwerp, aanhef en ondertekening gebruiken de week en de voornaam", () => {
  const mail = buildReminderEmail(invoer());

  assert.equal(mail.subject, "Herinnering: timesheet en factuur — Week 12 · 2026");
  assert.equal(mail.greeting, "Beste Jan,");
  assert.equal(mail.signature, "Met vriendelijke groet,\nTeam Q4S");
});

test("een lege naam levert een nette aanhef op in plaats van 'Beste ,'", () => {
  assert.equal(buildReminderEmail(invoer({ freelancerName: "   " })).greeting, "Beste,");
  assert.equal(buildReminderEmail(invoer({ freelancerName: "" })).greeting, "Beste,");
});

test("zonder weeklabel blijft het onderwerp heel en spreekt de tekst over 'deze week'", () => {
  const mail = buildReminderEmail(invoer({ weekLabel: "   " }));

  assert.equal(mail.subject, "Herinnering: timesheet en factuur");
  assert.ok(!mail.subject.includes("—"), "geen los streepje zonder week");
  assert.ok(
    mail.bodyLines.some((r) => r.includes("deze week")),
    "zonder week hoort de tekst over 'deze week' te gaan",
  );
});

// ---------------------------------------------------------------------------
// De kern van de herinnering
// ---------------------------------------------------------------------------

test("de herinnering vraagt om zowel de timesheet als de factuur en noemt de week", () => {
  const mail = buildReminderEmail(invoer());
  const kern = mail.bodyLines[0];

  assert.ok(kern.includes("timesheet"), "de timesheet wordt niet genoemd");
  assert.ok(kern.includes("factuur"), "de factuur wordt niet genoemd");
  assert.ok(kern.includes("nog niet ontvangen"), "de kern van de herinnering ontbreekt");
  assert.ok(tekst(mail).includes("Week 12 · 2026"), "de week ontbreekt in de tekst");
});

test("de toon blijft vriendelijk: wie al gestuurd heeft mag dat gewoon zeggen", () => {
  const alles = tekst(buildReminderEmail(invoer()));

  assert.ok(alles.includes("al gestuurd"), "de ontsnappingsclausule ontbreekt");
});

// ---------------------------------------------------------------------------
// Tak — met en zonder deadline
// ---------------------------------------------------------------------------

test("met een deadline komt die als eigen regel in de mail", () => {
  const mail = buildReminderEmail(invoer({ deadlineHint: "vrijdag voor 17:00" }));
  const regel = mail.bodyLines.find((r) => r.includes("vrijdag voor 17:00"));

  assert.ok(regel, "de deadline hoort in een eigen regel te staan");
});

test("zonder deadline staat er geen lege of half afgemaakte deadline-regel", () => {
  const zonder = buildReminderEmail(invoer());
  const leeg = buildReminderEmail(invoer({ deadlineHint: "   " }));
  const nul = buildReminderEmail(invoer({ deadlineHint: null }));

  assert.deepEqual(zonder.bodyLines, leeg.bodyLines);
  assert.deepEqual(zonder.bodyLines, nul.bodyLines);
  assert.ok(!zonder.bodyLines.some((r) => r.toLowerCase().includes("uiterlijk")));
  assert.ok(zonder.bodyLines.every((r) => r.trim() !== ""));
});

test("een deadline verandert alleen de tekst, niet het onderwerp of de aanhef", () => {
  const zonder = buildReminderEmail(invoer());
  const met = buildReminderEmail(invoer({ deadlineHint: "vrijdag voor 17:00" }));

  assert.equal(met.subject, zonder.subject);
  assert.equal(met.greeting, zonder.greeting);
  assert.equal(met.bodyLines.length, zonder.bodyLines.length + 1);
});

// ---------------------------------------------------------------------------
// Puurheid
// ---------------------------------------------------------------------------

test("de functie is puur: gelijke invoer geeft gelijke uitvoer en raakt de invoer niet aan", () => {
  const input = invoer({ deadlineHint: "vrijdag voor 17:00" });
  const kopie = JSON.parse(JSON.stringify(input));

  const eerste = buildReminderEmail(input);
  const tweede = buildReminderEmail(input);

  assert.deepEqual(eerste, tweede);
  assert.deepEqual(JSON.parse(JSON.stringify(input)), kopie, "de invoer is gewijzigd");

  // De uitvoer is van de aanroeper: eraan sleutelen mag de volgende mail niet raken.
  eerste.bodyLines.push("gesleutel");
  assert.deepEqual(buildReminderEmail(input), tweede);
});
