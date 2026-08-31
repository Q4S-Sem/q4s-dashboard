import assert from "node:assert/strict";
import test from "node:test";
import { isAdminRole, isAuthRequired, productionAuthError } from "../src/lib/auth-policy";

test("production always requires authentication", () => {
  assert.equal(isAuthRequired({ NODE_ENV: "production" }), true);
  assert.equal(isAuthRequired({ NODE_ENV: "production", AUTH_REQUIRED: "false" }), true);
});

test("development remains open unless authentication is explicitly enabled", () => {
  assert.equal(isAuthRequired({ NODE_ENV: "development" }), false);
  assert.equal(isAuthRequired({ NODE_ENV: "development", AUTH_REQUIRED: "true" }), true);
});

test("production authentication rejects an absent or default signing secret", () => {
  assert.match(productionAuthError({ NODE_ENV: "production" }) ?? "", /AUTH_SECRET/);
  assert.match(
    productionAuthError({
      NODE_ENV: "production",
      AUTH_SECRET: "q4s-dev-secret-change-in-production",
    }) ?? "",
    /AUTH_SECRET/,
  );
  assert.equal(
    productionAuthError({ NODE_ENV: "production", AUTH_SECRET: "a-strong-unique-secret" }),
    null,
  );
});

test("only the ADMIN role has access to restricted operations", () => {
  assert.equal(isAdminRole("ADMIN"), true);
  assert.equal(isAdminRole("GEBRUIKER"), false);
  assert.equal(isAdminRole(null), false);
});
