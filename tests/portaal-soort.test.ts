import { test } from "node:test";
import assert from "node:assert/strict";
import { connectorKey, portaalLink, raadPortaalSoort } from "../src/lib/portaal-soort";

const p = (name: string, url = "", notes = "") => ({ name, url, notes });

test("Portaalsoort: MSP/VMS, bedrijfsportaal en overig", () => {
  assert.equal(raadPortaalSoort(p("Damen", "https://flexdamen.my.site.com/vms")), "MSP");
  assert.equal(raadPortaalSoort(p("Airswift", "", "Portaal: iCIMS - Airswift")), "MSP");
  assert.equal(raadPortaalSoort(p("BAM", "", "Portaal: Nétive VMS Force 2")), "MSP");
  assert.equal(raadPortaalSoort(p("Belastingdienst")), "OVERIG");
  assert.equal(raadPortaalSoort(p("Damen Access (mensen aanmelden)", "https://access.damen.com")), "KLANT");
});

test("Portaallink uit de notitie en connector-sleutel", () => {
  assert.equal(portaalLink(p("X", "", "zie https://a.nl/login.")), "https://a.nl/login.");
  assert.equal(portaalLink(p("X", "https://b.nl")), "https://b.nl");
  assert.equal(connectorKey("Danniq / TenneT"), "danniq-tennet");
  assert.equal(connectorKey("Nétive"), "netive");
});
