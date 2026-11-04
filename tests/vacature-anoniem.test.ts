import assert from "node:assert/strict";
import test from "node:test";
import { vacatureAnoniem } from "../src/lib/cv-extract";
import { siteNaam, webpaginaTekst } from "../src/lib/webpagina-tekst";

const leeg = { title: "", company: "", discipline: "OVERIG", location: "", employmentType: "", hoursPerWeek: 0, durationText: "", rateText: "", experienceText: "", educationLevel: "", positions: 1, responsibilities: "", requirements: "", niceToHave: "", certificates: "", notes: "" } as never;

test("bedrijfsnamen (opdrachtgever + bron-site) verdwijnen uit de vacaturetekst, intern blijft company staan", () => {
  const v = vacatureAnoniem(
    { ...(leeg as object), title: "NDT Inspector — TenneT", company: "TenneT B.V.", responsibilities: "Inspecties op stations van TenneT\nRapporteren aan Werkzoeken", requirements: "Ervaring bij tennet is een pre" } as never,
    [siteNaam("www.werkzoeken.nl")],
  );
  assert.equal(v.title, "NDT Inspector");
  assert.equal(v.company, "TenneT B.V.");
  assert.ok(!/tennet|werkzoeken/i.test(v.responsibilities + v.requirements));
  assert.match(v.responsibilities, /onze opdrachtgever/);
});

test("webpagina → tekst: scripts/menu weg, JobPosting-data en lijstjes blijven", () => {
  const t = webpaginaTekst('<title>Lasser</title><nav>Home Over</nav><script>x=1</script><script type="application/ld+json">{"@type":"JobPosting","title":"Lasser"}</script><ul><li>TIG &amp; MIG</li></ul>');
  assert.ok(t.includes("JobPosting") && t.includes("- TIG & MIG") && !t.includes("x=1") && !t.includes("Home Over"));
});
