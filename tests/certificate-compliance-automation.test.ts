import assert from "node:assert/strict";
import test from "node:test";
import { buildCertificateComplianceTasks } from "../src/lib/automation-defs";

test("certificate compliance tasks cover expired and upcoming active certificates with explainable idempotency keys", () => {
  const now = new Date("2026-08-31T10:00:00.000Z");
  const tasks = buildCertificateComplianceTasks({
    now,
    thresholdDays: 30,
    template: "{status}: {name} verloopt op {date} (bron {sourceKey}). Handmatige review vereist.",
    certificates: [
      { id: "expired-cert", consultantId: "consultant-1", name: "VCA VOL", expiryDate: new Date("2026-08-15T00:00:00.000Z") },
      { id: "upcoming-cert", consultantId: "consultant-2", name: "NEN 1090", expiryDate: new Date("2026-09-15T00:00:00.000Z") },
      { id: "later-cert", consultantId: "consultant-3", name: "ISO 9712", expiryDate: new Date("2026-10-15T00:00:00.000Z") },
      { id: "no-expiry-cert", consultantId: "consultant-4", name: "Heftruck", expiryDate: null },
    ],
  });

  assert.deepEqual(tasks, [
    {
      entityType: "consultant",
      entityId: "consultant-1",
      sourceKey: "certificate:expired-cert:2026-08-15:expired",
      body: "VERLOPEN: VCA VOL verloopt op 15-08-2026 (bron certificate:expired-cert:2026-08-15:expired). Handmatige review vereist.",
    },
    {
      entityType: "consultant",
      entityId: "consultant-2",
      sourceKey: "certificate:upcoming-cert:2026-09-15:expiring",
      body: "VERLOOPT BINNEN 30 DAGEN: NEN 1090 verloopt op 15-09-2026 (bron certificate:upcoming-cert:2026-09-15:expiring). Handmatige review vereist.",
    },
  ]);
});

test("certificate compliance tasks never create an external action or candidate state change", () => {
  const tasks = buildCertificateComplianceTasks({
    now: new Date("2026-08-31T10:00:00.000Z"),
    thresholdDays: 30,
    template: "Controleer {name} ({status}) vóór handmatige opvolging.",
    certificates: [
      { id: "cert-1", consultantId: "consultant-1", name: "VCA VOL", expiryDate: new Date("2026-08-31T00:00:00.000Z") },
    ],
  });

  assert.deepEqual(tasks[0], {
    entityType: "consultant",
    entityId: "consultant-1",
    sourceKey: "certificate:cert-1:2026-08-31:expiring",
    body: "Controleer VCA VOL (VERLOOPT BINNEN 30 DAGEN) vóór handmatige opvolging.",
  });
  assert.deepEqual(Object.keys(tasks[0]).sort(), ["body", "entityId", "entityType", "sourceKey"]);
});
