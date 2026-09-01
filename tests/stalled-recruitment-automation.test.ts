import assert from "node:assert/strict";
import test from "node:test";
import { buildStalledRecruitmentTasks } from "../src/lib/automation-defs";

test("stalled recruitment automation creates explainable review-only tasks for idle candidates and open applications", () => {
  const now = new Date("2026-08-31T10:00:00.000Z");
  const tasks = buildStalledRecruitmentTasks({
    now,
    thresholdDays: 14,
    template:
      "{status}: {name} is {idleDays} dagen inactief sinds {date} (drempel {thresholdDays} dagen; bron: {sourceKey}). Handmatige recruiter-review nodig; geen bericht, statuswijziging, deal of interview is automatisch uitgevoerd.",
    candidates: [
      {
        id: "candidate-idle",
        firstName: "Ava",
        lastName: "Jansen",
        updatedAt: new Date("2026-08-16T09:00:00.000Z"),
      },
      {
        id: "candidate-recent",
        firstName: "Bram",
        lastName: "Smit",
        updatedAt: new Date("2026-08-18T10:00:00.000Z"),
      },
    ],
    applications: [
      {
        id: "application-idle",
        status: "SCREENING",
        updatedAt: new Date("2026-08-10T10:00:00.000Z"),
        candidate: { firstName: "Chloë", lastName: "de Vries" },
        vacancy: { title: "QC Inspector" },
      },
      {
        id: "application-closed",
        status: "PLACED",
        updatedAt: new Date("2026-08-01T10:00:00.000Z"),
        candidate: { firstName: "Daan", lastName: "Bos" },
        vacancy: { title: "Lasser" },
      },
    ],
  });

  assert.deepEqual(tasks, [
    {
      entityType: "candidate",
      entityId: "candidate-idle",
      sourceKey: "candidate:candidate-idle:updated:2026-08-16",
      body:
        "KANDIDAAT: Ava Jansen is 15 dagen inactief sinds 16-08-2026 (drempel 14 dagen; bron: candidate:candidate-idle:updated:2026-08-16). Handmatige recruiter-review nodig; geen bericht, statuswijziging, deal of interview is automatisch uitgevoerd.",
    },
    {
      entityType: "application",
      entityId: "application-idle",
      sourceKey: "application:application-idle:updated:2026-08-10",
      body:
        "SOLLICITATIE SCREENING: Chloë de Vries · QC Inspector is 21 dagen inactief sinds 10-08-2026 (drempel 14 dagen; bron: application:application-idle:updated:2026-08-10). Handmatige recruiter-review nodig; geen bericht, statuswijziging, deal of interview is automatisch uitgevoerd.",
    },
  ]);
});
