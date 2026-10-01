import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessPath, migrateAccessHrefs } from "../src/components/nav";

const user = (pages: string[]) => ({ role: "GEBRUIKER", allowedHubs: ["/facturatie"], allowedPages: pages });

test("root-item van een hub geeft geen toegang tot zusterpagina's", () => {
  const u = user(["/facturatie"]);
  assert.equal(canAccessPath("/facturatie", u), true);
  assert.equal(canAccessPath("/facturatie/abc/2026-W40", u), true); // dossier valt onder Week verwerken
  assert.equal(canAccessPath("/facturatie/verkoop", u), false);
  assert.equal(canAccessPath("/facturatie/inkoop/xyz", u), false);
});

test("expliciete subpagina geeft alleen die pagina", () => {
  const u = user(["/facturatie/verkoop"]);
  assert.equal(canAccessPath("/facturatie/verkoop/123", u), true);
  assert.equal(canAccessPath("/facturatie", u), false);
});

test("oude facturatie-rechten worden vertaald, niet verruimd", () => {
  assert.deepEqual(migrateAccessHrefs(["/verwerken/nieuw"]), ["/facturatie"]);
  assert.deepEqual(migrateAccessHrefs(["/facturen", "/verzenden"]), ["/facturatie/verkoop"]);
  const u = user(migrateAccessHrefs(["/facturen"]));
  assert.equal(canAccessPath("/facturatie/verkoop", u), true);
  assert.equal(canAccessPath("/facturatie/inkoop", u), false);
});
