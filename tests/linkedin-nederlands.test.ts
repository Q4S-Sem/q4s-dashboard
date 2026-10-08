import assert from "node:assert/strict";
import test from "node:test";
import { eenFunctie, functieTitel, hookOpties, vergoedingTekst } from "../src/lib/linkedin-template";

test("LinkedIn-post: kloppend Nederlands rond de functietitel en vergoeding", () => {
  assert.equal(functieTitel("Mechanical/ Hydraulic Inspectors"), "Mechanical/Hydraulic Inspectors");
  assert.equal(functieTitel("Voorman / NDO"), "Voorman NDO");
  assert.equal(eenFunctie("Mechanical/ Hydraulic Inspectors"), "Mechanical/Hydraulic Inspector");
  assert.equal(eenFunctie("Lassers"), "Lasser");
  assert.equal(eenFunctie("Quality Manager (CSA)"), "Quality Manager (CSA)");
  assert.equal(vergoedingTekst("Marktconform p/u"), "marktconform per uur");
  const hooks = hookOpties({
    title: "Construction Manager", discipline: "", location: "Duitsland", employmentType: "", salary: "",
    responsibilities: [], requirements: [], profile: "", offer: [], summary: "", applyUrl: "",
    companyName: "Q4S", contactName: "", contactEmail: "", contactPhone: "",
  });
  assert.equal(hooks[0], "Ben jij een ervaren Construction Manager en klaar voor je volgende project?");
});
