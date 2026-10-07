import assert from "node:assert/strict";
import test from "node:test";
import { buildLinkedinPost, postLength, LINKEDIN_MAX, vacatureUrl } from "../src/lib/linkedin-template";

const post = buildLinkedinPost({
  title: "Quality Manager (CSA)", discipline: "QA/QC", location: "Nederland", employmentType: "Fulltime", salary: "Marktconform",
  summary: "Ben jij een ervaren Quality Manager met een scherp oog voor kwaliteit? Voor een mooi project in Nederland zoeken wij een Quality Manager (CSA). Een rol van 12+ maanden.",
  responsibilities: ["Kwaliteitsplan opstellen", "Audits uitvoeren", "ITP's beoordelen", "NCR's afhandelen", "KPI's rapporteren"],
  requirements: ["HBO", "ISO 9001 en EN 1090", "VCA VOL"], profile: "", offer: [],
  applyUrl: vacatureUrl("quality-manager-csa-2"), companyName: "Q4S", contactName: "", contactEmail: "", contactPhone: "",
});

test("AIDA: vraag als haak bovenaan, solliciteerlink onderaan", () => {
  const regels = post.split("\n");
  assert.ok(regels[0].length > 0 && !regels[0].startsWith("•"));
  assert.ok(post.indexOf("12+ maanden") < post.indexOf("cv-uploaden"));
  assert.match(post, /https:\/\/www\.q4s\.nl\/nl\/cv-uploaden\?vacancy=quality-manager-csa-2/);
  assert.match(post, /https:\/\/www\.q4s\.nl\/nl\/vacatures\/quality-manager-csa-2/);
});

test("geen emoji-opsommingen, geen gedachtestreepjes, max 5 hashtags, binnen de limiet", () => {
  assert.ok(!/^[🔹✅]/mu.test(post));
  assert.ok(!post.includes(" — "));
  const tags = post.split("\n").at(-1)!.split(" ").filter((t) => t.startsWith("#"));
  assert.ok(tags.length >= 3 && tags.length <= 5, tags.join(" "));
  assert.ok(!tags.includes("#VOL"));
  assert.ok(postLength(post) <= LINKEDIN_MAX);
  assert.equal(post.split("\n").filter((r) => r.startsWith("•")).length <= 4 + 3 + 5, true);
});
