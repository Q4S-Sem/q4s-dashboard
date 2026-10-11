import assert from "node:assert/strict";
import test from "node:test";
import { geminiThinking } from "../src/lib/ai";

test("snel uitlezen: 2.5 budget 0, 3.x niveau low, anders niets", () => {
  assert.deepEqual(geminiThinking("gemini-2.5-flash", true), { thinkingBudget: 0 });
  assert.deepEqual(geminiThinking("gemini-flash-latest", true), { thinkingLevel: "low" });
  assert.equal(geminiThinking("gemini-flash-latest", false), undefined);
});
