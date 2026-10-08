import assert from "node:assert/strict";
import test from "node:test";
import { CRM_ARCHIEF_DAGEN, crmArchiefWhere } from "../src/lib/crm-archief";

test("Pipeline-archief: verloren direct, geplaatst na 3 dagen (ook zonder closedAt)", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  const w = crmArchiefWhere(now) as {
    OR: [{ status: string }, { status: string; OR: [{ closedAt: { lt: Date } }, { closedAt: null; updatedAt: { lt: Date } }] }];
  };
  assert.equal(CRM_ARCHIEF_DAGEN, 3);
  assert.deepEqual(w.OR[0], { status: "LOST" });
  assert.equal(w.OR[1].status, "WON");
  assert.equal(w.OR[1].OR[0].closedAt.lt.toISOString(), "2026-09-29T12:00:00.000Z");
  assert.equal(w.OR[1].OR[1].updatedAt.lt.toISOString(), "2026-09-29T12:00:00.000Z");
});
