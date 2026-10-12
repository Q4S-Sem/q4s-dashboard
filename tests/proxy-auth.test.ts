import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { isOpenbaar, userIdUitCookie } from "../src/lib/proxy-auth";

test("openbare pagina's vs dashboard", () => {
  for (const p of ["/login", "/vacature/las-inspecteur", "/v/abc", "/vakproef/x", "/talentpool", "/wachtwoord-vergeten"]) assert.ok(isOpenbaar(p), p);
  for (const p of ["/", "/facturatie/verkoop/1/pdf", "/vacatures", "/vakproefjes", "/loginx", "/socials/cv-generator/1/pdf"]) assert.ok(!isOpenbaar(p), p);
});

test("sessie-cookie: alleen een geldige handtekening telt", () => {
  const sig = createHmac("sha256", "geheim").update("user1").digest("base64url");
  assert.equal(userIdUitCookie(`user1.${sig}`, "geheim"), "user1");
  assert.equal(userIdUitCookie(`user2.${sig}`, "geheim"), null);
  assert.equal(userIdUitCookie(`user1.${sig}`, "ander"), null);
  assert.equal(userIdUitCookie(undefined, "geheim"), null);
  assert.equal(userIdUitCookie(`user1.${sig}`, null), null);
});
