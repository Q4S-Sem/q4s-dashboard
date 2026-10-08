import assert from "node:assert/strict";
import test from "node:test";
import { allowedCorsOrigin, checkVertaling, composeDescriptionHtml, type VacatureTekst } from "../src/lib/public-api";

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

const NL: VacatureTekst = {
  title: "Voorman NDO",
  location: "Rotterdam",
  employmentType: "Vast",
  salary: null,
  disciplineLabel: "Lassen",
  summary: "Wij zoeken een voorman.",
  responsibilities: ["Aansturen team", "Lasnaden controleren"],
  requirements: ["VCA"],
  niceToHave: [],
  fullText: null,
};

test("checkVertaling accepteert een volledige vertaling en laat lege bronvelden leeg", () => {
  const en = checkVertaling(NL, {
    title: "NDT Foreman", location: "Rotterdam", employmentType: "Permanent", salary: "x",
    disciplineLabel: "Welding", summary: "We are looking for a foreman.", fullText: "",
    responsibilities: ["Lead team", "Check welds"], requirements: ["VCA"], niceToHave: [],
  });
  assert.equal(en.title, "NDT Foreman");
  assert.equal(en.salary, null); // bron leeg -> blijft leeg, ook als de AI iets verzint
  assert.deepEqual(en.responsibilities, ["Lead team", "Check welds"]);
});

test("checkVertaling weigert een lijst met ander aantal regels of een leeg veld", () => {
  const base = { title: "T", location: "R", employmentType: "P", disciplineLabel: "W", summary: "S", requirements: ["VCA"], niceToHave: [] };
  assert.throws(() => checkVertaling(NL, { ...base, responsibilities: ["only one"] }));
  assert.throws(() => checkVertaling(NL, { ...base, title: "", responsibilities: ["a", "b"] }));
});

test("composeDescriptionHtml gebruikt Engelse kopjes bij lang=en", () => {
  const html = composeDescriptionHtml({ summary: null, responsibilities: ["a"], requirements: ["b"], niceToHave: ["c"] }, "en");
  assert.match(html, /Responsibilities[\s\S]*Requirements[\s\S]*Nice to have/);
  assert.doesNotMatch(composeDescriptionHtml({ summary: null, responsibilities: ["a"], requirements: [], niceToHave: [] }), /Responsibilities/);
});
