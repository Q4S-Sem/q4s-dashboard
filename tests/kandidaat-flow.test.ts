import assert from "node:assert/strict";
import test from "node:test";
import { kandidaatStap } from "../src/lib/kandidaat-flow";

test("kandidaat-flow: beoordelen → profiel → pipeline → klaar", () => {
  assert.equal(kandidaatStap({ rating: "ONBEKEND", discipline: "QA_QC", inPipeline: false }), 2);
  assert.equal(kandidaatStap({ rating: "GOED", discipline: null, inPipeline: false }), 3);
  assert.equal(kandidaatStap({ rating: "REDELIJK", discipline: "LASSEN", inPipeline: false }), 4);
  assert.equal(kandidaatStap({ rating: "GOED", discipline: "LASSEN", inPipeline: true }), 5);
});
