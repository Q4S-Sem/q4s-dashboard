import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Eén knop-/schakelaarstijl in het hele dashboard: knoppen via buttonVariants,
// segment-schakelaars via segmentVariants, mapje-tabs via mapTabVariants
// (src/components/ui/button.tsx). Deze test vangt een nieuwe handgemaakte
// gevulde knop of schakelaar met een eigen kleur (de oorzaak van "elke pagina
// ziet er anders uit").

const ROOT = join(__dirname, "..", "src");
// Bewust eigen stijl: publieke site/login (andere huisstijl), app-shell en de
// update-balk op donkere achtergrond, en de ui-bouwstenen zelf.
const UITZONDERING = [/^components[\\/]ui[\\/]/, /^app[\\/](login|vacature|talentpool|vakproef)[\\/]/, /^components[\\/](app-shell|update-notifier)\.tsx$/, /AgendaCalendar\.tsx$/ /* dagnummer in de kalender, geen knop */];

function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsx(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

test("geen handgemaakte gevulde knoppen of schakelaars met eigen kleur", () => {
  const fout: string[] = [];
  for (const f of tsx(ROOT)) {
    const rel = relative(ROOT, f);
    if (UITZONDERING.some((r) => r.test(rel))) continue;
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/<(button|Link|a)\b([\s\S]*?)>/g)) {
      const attrs = m[2];
      if (/buttonVariants|segmentVariants|mapTabVariants/.test(attrs)) continue;
      const knop =
        /\bpx-\d/.test(attrs) &&
        /\brounded/.test(attrs) &&
        /\b(bg-ink-900|bg-brand-600|bg-violet-600|bg-emerald-600|bg-gradient-to-r)\b/.test(attrs);
      if (knop) fout.push(`${rel}:${src.slice(0, m.index).split("\n").length}`);
    }
  }
  assert.deepEqual(fout, [], `Gebruik buttonVariants/segmentVariants i.p.v. eigen klassen:\n${fout.join("\n")}`);
});

test("zoekvelden gebruiken ZOEK_INPUT (één zoekveld-stijl)", () => {
  const fout: string[] = [];
  for (const f of tsx(ROOT)) {
    const rel = relative(ROOT, f);
    if (/tabel-zoek\.tsx$/.test(rel) || /^app[\\/](login|vacature|talentpool|vakproef)[\\/]/.test(rel)) continue;
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/<input\b[\s\S]*?\/>/g)) {
      if (/className="[^"]*\bpl-9\b/.test(m[0])) fout.push(`${rel}:${src.slice(0, m.index).split("\n").length}`);
    }
  }
  assert.deepEqual(fout, [], `Gebruik ZOEK_INPUT uit ui/tabel-zoek:\n${fout.join("\n")}`);
});

test("keuzelijsten gebruiken de gedeelde Select (geen losse <select>)", () => {
  const fout: string[] = [];
  for (const f of tsx(ROOT)) {
    const rel = relative(ROOT, f);
    if (/^components[\\/]ui[\\/]/.test(rel) || /^app[\\/](login|vacature|talentpool|vakproef)[\\/]/.test(rel)) continue;
    // ContractForm: €/%-kiezer die aan het invoerveld vastzit (inline eenheid, geen losse keuzelijst).
    if (/ContractForm\.tsx$/.test(rel)) continue;
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/<select\b/g)) fout.push(`${rel}:${src.slice(0, m.index).split("\n").length}`);
  }
  assert.deepEqual(fout, [], `Gebruik Select uit ui/field:\n${fout.join("\n")}`);
});
