import assert from "node:assert/strict";
import test from "node:test";
import { rotateImageBase64 } from "../src/lib/pdf-render";

test("foto een kwartslag draaien wisselt breedte en hoogte (liggende timesheet → staand)", async () => {
  const { createCanvas } = await import("@napi-rs/canvas");
  const c = createCanvas(300, 100);
  const src = Buffer.from(c.toBuffer("image/png")).toString("base64");
  const r = await rotateImageBase64(src, 90);
  assert.equal(r.mediaType, "image/jpeg");
  assert.deepEqual([r.width, r.height], [100, 300]);
  const z = await rotateImageBase64(src, 0);
  assert.deepEqual([z.width, z.height], [300, 100]);
});
