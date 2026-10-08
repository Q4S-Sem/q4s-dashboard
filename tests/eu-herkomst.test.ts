import assert from "node:assert/strict";
import test from "node:test";
import { herkomst } from "../src/lib/eu-herkomst";

test("EU of buiten de EU uit locatie, anders telefoon", () => {
  assert.equal(herkomst({ location: "Rotterdam, Nederland" }), "EU");
  assert.equal(herkomst({ location: "Gdańsk, Poland" }), "EU");
  assert.equal(herkomst({ location: "Mumbai, India", phone: "+31 6 12345678" }), "BUITEN_EU"); // locatie wint
  assert.equal(herkomst({ location: "Pune", phone: "+91 98765 43210" }), "BUITEN_EU");
  assert.equal(herkomst({ location: "Dordrecht", phone: "06-12345678" }), "EU");
  assert.equal(herkomst({ phone: "0048 601 234 567" }), "EU");
  assert.equal(herkomst({ phone: "+44 7700 900123" }), "BUITEN_EU"); // VK na Brexit
  assert.equal(herkomst({ phone: "+380 50 123 4567" }), "BUITEN_EU"); // Oekraïne ≠ Griekenland (30)
  assert.equal(herkomst({ phone: "+41 79 123 45 67" }), "EU"); // Zwitserland: geen vergunning nodig
  assert.equal(herkomst({ location: "Zwijndrecht" }), "ONBEKEND");
  assert.equal(herkomst({}), "ONBEKEND");
});
