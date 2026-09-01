import assert from "node:assert/strict";
import test from "node:test";
import { openrouterVisionErrorMessage } from "../src/lib/ai";

// ---------------------------------------------------------------------------
// openrouterVisionErrorMessage — vertaalt een HTTP-fout van OpenRouter naar een
// Nederlandse melding. Het geval dat telt: het gekozen vision-model leest geen
// PDF's. Dan moet de melding naar OPENROUTER_VISION_MODEL wijzen, niet naar een
// kale statuscode.
// ---------------------------------------------------------------------------

const MODEL = "google/gemini-2.0-flash-001";

test("wijst naar OPENROUTER_VISION_MODEL als het model geen PDF's leest", () => {
  const msg = openrouterVisionErrorMessage(
    404,
    '{"error":{"message":"No endpoints found that support file input"}}',
    "application/pdf",
    MODEL,
  );
  assert.match(msg, /OPENROUTER_VISION_MODEL/);
  assert.match(msg, /PDF's niet lezen/);
  assert.match(msg, new RegExp(MODEL));
});

test("noemt het mediatype bij een geweigerde afbeelding", () => {
  const msg = openrouterVisionErrorMessage(
    400,
    "This model does not support image input",
    "image/png",
    MODEL,
  );
  assert.match(msg, /image\/png/);
  assert.match(msg, /OPENROUTER_VISION_MODEL/);
});

test("gewone fouten blijven een kale OpenRouter-fout", () => {
  assert.equal(
    openrouterVisionErrorMessage(401, "Invalid API key", "image/png", MODEL),
    "OpenRouter-fout (401): Invalid API key.",
  );
  assert.equal(
    openrouterVisionErrorMessage(429, "", "application/pdf", MODEL),
    "OpenRouter-fout (429).",
  );
});

test("een 500 met 'unsupported' is geen mediatype-advies", () => {
  // Alleen 400/404/415 duiden op een verkeerd model; een serverfout niet.
  assert.match(
    openrouterVisionErrorMessage(500, "unsupported upstream error", "application/pdf", MODEL),
    /^OpenRouter-fout \(500\)/,
  );
});

test("kapt een lange foutbody af", () => {
  const msg = openrouterVisionErrorMessage(502, "x".repeat(500), "image/jpeg", MODEL);
  assert.equal(msg, `OpenRouter-fout (502): ${"x".repeat(200)}.`);
});
