import assert from "node:assert/strict";
import test from "node:test";
import { buildLinkedinPost, eersteReactie, hookOpties, vacatureUrl, type PostInput } from "../src/lib/linkedin-template";

const inp: PostInput = {
  title: "Quality Manager (CSA)", discipline: "QA/QC", location: "Nederland", employmentType: "Fulltime", salary: "",
  summary: "Ben jij een ervaren Quality Manager? Een rol van 12+ maanden.",
  responsibilities: ["Opstellen van het kwaliteitsplan"], requirements: [], profile: "", offer: [],
  applyUrl: vacatureUrl("quality-manager-csa-2"), companyName: "Q4S", contactName: "", contactEmail: "", contactPhone: "",
};

test("drie verschillende openingszinnen uit de vacature", () => {
  const h = hookOpties(inp);
  assert.equal(h.length, 3);
  assert.equal(h[0], "Ben jij een ervaren Quality Manager?");
  assert.match(h[1], /Gezocht: Quality Manager \(CSA\) in Nederland voor 12\+ maanden/);
  assert.match(h[2], /Eerste klus: opstellen van het kwaliteitsplan\./);
});

test("gekozen hook bovenaan, links naar de eerste reactie", () => {
  const post = buildLinkedinPost(inp, { hook: "Gezocht: QM", linksInReactie: true });
  assert.ok(post.startsWith("𝗚𝗲𝘇𝗼𝗰𝗵𝘁"));
  assert.ok(!post.includes("https://"));
  assert.match(eersteReactie(inp), /cv-uploaden\?vacancy=quality-manager-csa-2\nAlle details: https:\/\/www\.q4s\.nl\/nl\/vacatures\/quality-manager-csa-2/);
  assert.ok(buildLinkedinPost(inp).includes("https://www.q4s.nl/nl/cv-uploaden"));
});
