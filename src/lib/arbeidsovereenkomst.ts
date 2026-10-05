// ---------------------------------------------------------------------------
// Arbeidsovereenkomst — de wettelijke grenzen die het formulier bewaakt.
// Puur (geen DB), getest in tests/arbeidsovereenkomst.test.ts.
//
// Bronnen (BW Boek 7): proeftijd 7:652 · aanzegplicht 7:668 · tussentijds
// opzeggen bepaalde tijd 7:667 lid 3 · concurrentiebeding bepaalde tijd 7:653
// lid 2 · vakantie min. 4× weekuren 7:634 · loon bij ziekte 7:629 ·
// verplichte scholing kosteloos 7:611a.
// ---------------------------------------------------------------------------

export type ArbeidsWaarden = Record<string, string | undefined>;

export const SOORTEN_DIENSTVERBAND = ["bepaalde tijd", "onbepaalde tijd"] as const;
export const PROEFTIJDEN = ["geen proeftijd", "1 maand", "2 maanden"] as const;

/** "12 maanden" / "1 jaar" / "6 mnd" → aantal maanden; onleesbaar → null. */
export function duurInMaanden(duur: string | undefined): number | null {
  const m = (duur ?? "").toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(jaar|jr|maand|maanden|mnd|week|weken)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (m[2].startsWith("j")) return n * 12;
  if (m[2].startsWith("w")) return n / 4.33;
  return n;
}

/** Wat er wettelijk niet klopt aan de ingevulde keuzes (leeg = in orde). */
export function arbeidsWaarschuwingen(w: ArbeidsWaarden): string[] {
  const uit: string[] = [];
  const bepaald = w.soort === "bepaalde tijd";
  const maanden = duurInMaanden(w.duur);
  const proef = w.proeftijd === "2 maanden" ? 2 : w.proeftijd === "1 maand" ? 1 : 0;

  if (bepaald && proef > 0) {
    if (maanden !== null && maanden <= 6) {
      uit.push("Bij een contract van 6 maanden of korter mag er geen proeftijd in (art. 7:652 BW).");
    } else if (proef === 2 && (maanden === null || maanden < 24)) {
      uit.push("Bij bepaalde tijd korter dan 2 jaar is de proeftijd maximaal 1 maand (art. 7:652 BW).");
    }
  }
  if (bepaald && !w.duur && !w.einddatum) uit.push("Vul bij bepaalde tijd de duur of de einddatum in.");

  const uren = Number((w.urenPerWeek ?? "").replace(",", "."));
  const dagen = Number((w.vakantiedagen ?? "").replace(",", "."));
  if (uren > 0 && dagen > 0 && dagen * 8 < uren * 4) {
    uit.push(`Wettelijk minimum is 4× de weekuren aan vakantie (${uren * 4} uur ≈ ${Math.ceil((uren * 4) / 8)} dagen) — art. 7:634 BW.`);
  }
  if (bepaald && w.concurrentiebeding && !/^(n\.?v\.?t\.?|geen|nee)$/i.test(w.concurrentiebeding.trim())) {
    uit.push("Een concurrentiebeding bij bepaalde tijd is alleen geldig met een schriftelijke motivering in het contract (art. 7:653 lid 2 BW).");
  }
  return uit;
}
