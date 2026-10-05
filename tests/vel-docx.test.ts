import { test } from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
import { parseMarkup, velHtmlToDocx } from "../src/lib/vel-docx";

test("vel-docx: markup parsen en als Word-document met dezelfde tekst wegschrijven", async () => {
  const html =
    '<style>.x{}</style><article class="ov-vel"><h1 class="ov-title">Overeenkomst &amp; co</h1>' +
    '<div class="ov-cl"><span class="ov-cn">6.1</span><div>Tarief <span class="ov-fill">€ 78,-</span></div></div>' +
    '<div class="ov-sr"><span>Naam</span><span class="ov-fill">…</span></div>' +
    "<table><tbody><tr><td>KvK</td><td>123</td></tr></tbody></table><img src=\"x\"/><footer>voet</footer></article>";
  const root = parseMarkup(html);
  const art = root.kids[0] as { tag: string; kids: unknown[] };
  assert.equal(art.tag, "article");
  assert.equal(art.kids.length, 6);

  const buf = await velHtmlToDocx(html, "Q4S B.V.");
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  const { value } = await mammoth.extractRawText({ buffer: buf });
  assert.match(value, /Overeenkomst & co/);
  assert.match(value, /6\.1\tTarief € 78,-/);
  assert.match(value, /Naam:\t…+/);
  assert.match(value, /KvK/);
  assert.doesNotMatch(value, /voet/); // per-pagina voet → Word-voettekst, niet in de tekst
});
