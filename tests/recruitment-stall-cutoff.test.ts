import assert from "node:assert/strict";
import test from "node:test";
import {
  APPLICATION_IDLE_DAYS,
  CANDIDATE_IDLE_DAYS,
  countStalledItems,
  stalledBefore,
} from "../src/lib/recruitment-kpi";

const NOW = new Date("2026-08-31T10:00:00.000Z");

test("de afkapdatum is een hele UTC-dag en schuift mee met de drempel", () => {
  assert.equal(stalledBefore(NOW, 0).toISOString(), "2026-08-31T00:00:00.000Z");
  assert.equal(stalledBefore(NOW, 7).toISOString(), "2026-08-24T00:00:00.000Z");
  assert.equal(stalledBefore(NOW, 14).toISOString(), "2026-08-17T00:00:00.000Z");
  // Het tijdstip binnen de dag doet niet mee: om 23:59 geldt dezelfde afkapdatum.
  assert.equal(
    stalledBefore(new Date("2026-08-31T23:59:59.999Z"), 14).toISOString(),
    stalledBefore(NOW, 14).toISOString(),
  );
});

test("updatedAt < afkapdatum selecteert exact dezelfde records als countStalledItems", () => {
  // Rond de kandidaat-drempel (14 dagen): 17-08 is precies 14 dagen en valt dus
  // NET buiten; 16-08 is 15 dagen en telt mee.
  const candidates = [
    { id: "net-niet", availability: "ONBEKEND", updatedAt: new Date("2026-08-17T23:00:00.000Z") },
    { id: "net-wel", availability: "ONBEKEND", updatedAt: new Date("2026-08-16T23:00:00.000Z") },
    { id: "vers", availability: "ONBEKEND", updatedAt: NOW },
  ];
  const applications = [
    { id: "open-oud", status: "SCREENING", createdAt: NOW, updatedAt: new Date("2026-08-23T23:00:00.000Z") },
    { id: "open-grens", status: "SCREENING", createdAt: NOW, updatedAt: new Date("2026-08-24T00:00:00.000Z") },
    // Afgewezen sollicitaties vragen geen opvolging en tellen nooit mee.
    { id: "dicht-oud", status: "REJECTED", createdAt: NOW, updatedAt: new Date("2026-01-01T00:00:00.000Z") },
  ];

  const counts = countStalledItems({ now: NOW, candidates, applications });
  assert.equal(counts.candidates, 1);
  assert.equal(counts.applications, 1);

  const candidateCutoff = stalledBefore(NOW, CANDIDATE_IDLE_DAYS);
  const applicationCutoff = stalledBefore(NOW, APPLICATION_IDLE_DAYS);
  assert.deepEqual(
    candidates.filter((c) => c.updatedAt < candidateCutoff).map((c) => c.id),
    ["net-wel"],
  );
  assert.deepEqual(
    applications
      .filter((a) => a.status !== "REJECTED" && a.updatedAt < applicationCutoff)
      .map((a) => a.id),
    ["open-oud"],
  );
});
