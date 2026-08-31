import assert from "node:assert/strict";
import test from "node:test";
import { allowedCorsOrigin } from "../src/lib/public-api";

test("production CORS only permits the configured website origin", () => {
  assert.equal(
    allowedCorsOrigin("https://q4s.nl", { NODE_ENV: "production", PUBLIC_SITE_ORIGIN: "https://q4s.nl" }),
    "https://q4s.nl",
  );
  assert.equal(
    allowedCorsOrigin("https://attacker.example", { NODE_ENV: "production", PUBLIC_SITE_ORIGIN: "https://q4s.nl" }),
    null,
  );
});

test("development can serve same-origin requests without a configured CORS origin", () => {
  assert.equal(allowedCorsOrigin(null, { NODE_ENV: "development" }), "*");
});
