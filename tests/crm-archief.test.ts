import { test } from "node:test";
import assert from "node:assert/strict";
import { crmArchiefWhere, CRM_ARCHIEF_DAGEN } from "../src/lib/crm-archief";

test("CRM-archief: alleen geplaatst/verloren, ouder dan 3 dagen (ook zonder closedAt)", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  const w = crmArchiefWhere(now) as {
    status: { in: string[] };
    OR: [{ closedAt: { lt: Date } }, { closedAt: null; updatedAt: { lt: Date } }];
  };
  assert.equal(CRM_ARCHIEF_DAGEN, 3);
  assert.deepEqual(w.status.in, ["WON", "LOST"]);
  assert.equal(w.OR[0].closedAt.lt.toISOString(), "2026-09-29T12:00:00.000Z");
  assert.equal(w.OR[1].updatedAt.lt.toISOString(), "2026-09-29T12:00:00.000Z");
});
