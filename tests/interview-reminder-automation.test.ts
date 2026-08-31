import assert from "node:assert/strict";
import test from "node:test";
import { buildInterviewReminderTasks } from "../src/lib/automation-defs";

test("interview reminder automation creates explainable review-only tasks for upcoming interviews and interviews still awaiting notes or an outcome", () => {
  const now = new Date("2026-08-31T10:00:00.000Z");
  const tasks = buildInterviewReminderTasks({
    now,
    thresholdDays: 7,
    template:
      "{status}: interview met {name} op {date} ({when}; drempel {thresholdDays} dagen; bron: {sourceKey}). Handmatige recruiter-opvolging nodig; geen bericht, agenda-uitnodiging of statuswijziging is automatisch uitgevoerd.",
    candidates: [
      // Ingepland binnen de drempel -> herinnering om voor te bereiden.
      {
        id: "cand-upcoming",
        firstName: "Ava",
        lastName: "Jansen",
        interviewStatus: "PLANNED",
        interviewDate: new Date("2026-09-03T09:00:00.000Z"),
        interviewNotes: null,
      },
      // Precies op de drempel -> nog steeds binnen het venster.
      {
        id: "cand-boundary",
        firstName: "Bram",
        lastName: "Smit",
        interviewStatus: "PLANNED",
        interviewDate: new Date("2026-09-07T13:00:00.000Z"),
        interviewNotes: null,
      },
      // Buiten de drempel -> geen taak.
      {
        id: "cand-far",
        firstName: "Chloë",
        lastName: "de Vries",
        interviewStatus: "PLANNED",
        interviewDate: new Date("2026-09-20T09:00:00.000Z"),
        interviewNotes: null,
      },
      // Datum voorbij maar nog steeds INGEPLAND -> uitkomst ontbreekt.
      {
        id: "cand-past",
        firstName: "Daan",
        lastName: "Bos",
        interviewStatus: "PLANNED",
        interviewDate: new Date("2026-08-27T09:00:00.000Z"),
        interviewNotes: null,
      },
      // Interview gehouden én vastgelegd -> geen taak.
      {
        id: "cand-done-logged",
        firstName: "Eva",
        lastName: "Willems",
        interviewStatus: "DONE",
        interviewDate: new Date("2026-08-20T09:00:00.000Z"),
        interviewNotes: "Sterke indruk, referenties opgevraagd.",
      },
      // Interview gehouden maar notities leeg (alleen witruimte) -> notities ontbreken.
      {
        id: "cand-done-blank",
        firstName: "Finn",
        lastName: "Peeters",
        interviewStatus: "DONE",
        interviewDate: new Date("2026-08-25T09:00:00.000Z"),
        interviewNotes: "   ",
      },
      // Nog geen interview -> geen taak.
      {
        id: "cand-none",
        firstName: "Gijs",
        lastName: "Mulder",
        interviewStatus: "NONE",
        interviewDate: null,
        interviewNotes: null,
      },
      // Ingepland zonder datum -> niets om aan te herinneren.
      {
        id: "cand-nodate",
        firstName: "Hanne",
        lastName: "Vos",
        interviewStatus: "PLANNED",
        interviewDate: null,
        interviewNotes: null,
      },
    ],
  });

  assert.deepEqual(tasks, [
    {
      entityType: "candidate",
      entityId: "cand-upcoming",
      sourceKey: "interview:cand-upcoming:2026-09-03:PLANNED:upcoming",
      body:
        "INTERVIEW GEPLAND: interview met Ava Jansen op 03-09-2026 (over 3 dagen; drempel 7 dagen; bron: interview:cand-upcoming:2026-09-03:PLANNED:upcoming). Handmatige recruiter-opvolging nodig; geen bericht, agenda-uitnodiging of statuswijziging is automatisch uitgevoerd.",
    },
    {
      entityType: "candidate",
      entityId: "cand-boundary",
      sourceKey: "interview:cand-boundary:2026-09-07:PLANNED:upcoming",
      body:
        "INTERVIEW GEPLAND: interview met Bram Smit op 07-09-2026 (over 7 dagen; drempel 7 dagen; bron: interview:cand-boundary:2026-09-07:PLANNED:upcoming). Handmatige recruiter-opvolging nodig; geen bericht, agenda-uitnodiging of statuswijziging is automatisch uitgevoerd.",
    },
    {
      entityType: "candidate",
      entityId: "cand-past",
      sourceKey: "interview:cand-past:2026-08-27:PLANNED:outcome",
      body:
        "INTERVIEW-UITKOMST ONTBREEKT: interview met Daan Bos op 27-08-2026 (4 dagen geleden; drempel 7 dagen; bron: interview:cand-past:2026-08-27:PLANNED:outcome). Handmatige recruiter-opvolging nodig; geen bericht, agenda-uitnodiging of statuswijziging is automatisch uitgevoerd.",
    },
    {
      entityType: "candidate",
      entityId: "cand-done-blank",
      sourceKey: "interview:cand-done-blank:2026-08-25:DONE:notes",
      body:
        "INTERVIEW-NOTITIES ONTBREKEN: interview met Finn Peeters op 25-08-2026 (6 dagen geleden; drempel 7 dagen; bron: interview:cand-done-blank:2026-08-25:DONE:notes). Handmatige recruiter-opvolging nodig; geen bericht, agenda-uitnodiging of statuswijziging is automatisch uitgevoerd.",
    },
  ]);
});

test("an interview happening today is an upcoming reminder, not an outcome one", () => {
  const now = new Date("2026-08-31T15:30:00.000Z");
  const tasks = buildInterviewReminderTasks({
    now,
    thresholdDays: 7,
    template: "{status}: {name} op {date} ({when}) — bron {sourceKey}.",
    candidates: [
      {
        id: "cand-today",
        firstName: "Sanne",
        lastName: "Koning",
        interviewStatus: "PLANNED",
        interviewDate: new Date("2026-08-31T08:00:00.000Z"),
        interviewNotes: null,
      },
    ],
  });

  assert.deepEqual(tasks, [
    {
      entityType: "candidate",
      entityId: "cand-today",
      sourceKey: "interview:cand-today:2026-08-31:PLANNED:upcoming",
      body: "INTERVIEW GEPLAND: Sanne Koning op 31-08-2026 (vandaag) — bron interview:cand-today:2026-08-31:PLANNED:upcoming.",
    },
  ]);
});

test("the interview idempotency key changes only when the candidate, interview date or interview status changes", () => {
  const base = {
    id: "cand-1",
    firstName: "Ava",
    lastName: "Jansen",
    interviewStatus: "PLANNED",
    interviewDate: new Date("2026-09-03T09:00:00.000Z"),
    interviewNotes: null,
  };
  const keyFor = (candidate: typeof base, now: Date) =>
    buildInterviewReminderTasks({
      now,
      thresholdDays: 7,
      template: "{name}",
      candidates: [candidate],
    })[0]?.sourceKey;

  // Een tweede run op een later tijdstip van dezelfde dag levert dezelfde sleutel op.
  assert.equal(
    keyFor(base, new Date("2026-08-31T10:00:00.000Z")),
    keyFor(base, new Date("2026-08-31T23:00:00.000Z")),
  );
  // Ook een run op een andere dag binnen het venster houdt de sleutel stabiel.
  assert.equal(
    keyFor(base, new Date("2026-08-31T10:00:00.000Z")),
    keyFor(base, new Date("2026-09-01T10:00:00.000Z")),
  );
  // Een verzette afspraak krijgt wél een nieuwe sleutel.
  assert.notEqual(
    keyFor(base, new Date("2026-08-31T10:00:00.000Z")),
    keyFor({ ...base, interviewDate: new Date("2026-09-04T09:00:00.000Z") }, new Date("2026-08-31T10:00:00.000Z")),
  );
});

test("interview reminder tasks never carry an external-action or state-change field", () => {
  const tasks = buildInterviewReminderTasks({
    now: new Date("2026-08-31T10:00:00.000Z"),
    thresholdDays: 7,
    template: "Bereid het interview met {name} voor ({status}).",
    candidates: [
      {
        id: "cand-1",
        firstName: "Ava",
        lastName: "Jansen",
        interviewStatus: "PLANNED",
        interviewDate: new Date("2026-09-01T09:00:00.000Z"),
        interviewNotes: null,
      },
    ],
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].body, "Bereid het interview met Ava Jansen voor (INTERVIEW GEPLAND).");
  assert.deepEqual(Object.keys(tasks[0]).sort(), ["body", "entityId", "entityType", "sourceKey"]);
});
