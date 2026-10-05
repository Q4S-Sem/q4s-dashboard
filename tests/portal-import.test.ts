import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePortalTsv } from "../src/lib/portal-import";

test("portal-import: header, CRLF, lege regels, url-normalisatie, specials in wachtwoord", () => {
  const rows = parsePortalTsv(
    "\uFEFFnaam\tlink\tgebruikersnaam\twachtwoord\tnotitie\r\n" +
      "Magnit\tportal.magnitglobal.com\tinfo@q4s.nl\t2024-Q4s-2024!\t\r\n" +
      "\r\n" +
      "DNV\thttps://id.veracity.com/\tenter\t2345@#$%6789^&*(abC\t2FA\n" +
      "Kort\n",
  );
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    name: "Magnit",
    url: "https://portal.magnitglobal.com",
    username: "info@q4s.nl",
    password: "2024-Q4s-2024!",
    notes: "",
  });
  assert.equal(rows[1].password, "2345@#$%6789^&*(abC");
  assert.equal(rows[1].notes, "2FA");
  assert.deepEqual(rows[2], { name: "Kort", url: "", username: "", password: "", notes: "" });
});
