import assert from "node:assert/strict";
import test from "node:test";
import { puntKort } from "../src/lib/linkedin-og";

test("kaartpunten eindigen nooit met puntjes of een half woord", () => {
  assert.equal(
    puntKort("Opstellen en beheren van het kwaliteitsplan voor civiele, staal- en afbouwactiviteiten (CSA)"),
    "Opstellen en beheren van het kwaliteitsplan voor civiele, staal- en afbouwactiviteiten",
  );
  assert.equal(puntKort("Uitvoeren van kwaliteitsaudits en inspecties op projectlocaties"), "Uitvoeren van kwaliteitsaudits en inspecties op projectlocaties");
  const lang = puntKort("Coördineren met opdrachtgever, onderaannemers en inspectie-instanties over planning, kwaliteit, documentatie en de oplevering van het complete project");
  assert.ok(lang.length <= 95 && !lang.endsWith("\u2026") && !lang.endsWith(","), lang);
  assert.ok("Coördineren met opdrachtgever, onderaannemers en inspectie-instanties over planning, kwaliteit, documentatie en de oplevering van het complete project".startsWith(lang));
});
