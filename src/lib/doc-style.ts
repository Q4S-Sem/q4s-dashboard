/**
 * De huisstijl van de documenten die de deur uit gaan — CV's, evaluatie-
 * formulieren, en wat er later bijkomt.
 *
 * Eén accentkleur voor alles, instelbaar bij Instellingen → CV-vormgeving. Die
 * pagina heet naar het CV omdat dat de eerste was, maar de kleur is van het
 * briefpapier: twee documenten van dezelfde afzender in twee kleuren leest als
 * twee bedrijven.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/** Het Q4S-oranje. Wordt gebruikt als er niets (geldigs) is ingesteld. */
export const DEFAULT_ACCENT = "#e8430a";

export function documentAccent(s: { cvAccent?: string | null } | null | undefined): string {
  const v = String(s?.cvAccent ?? "");
  return HEX.test(v) ? v : DEFAULT_ACCENT;
}

/** Wat lichter/donkerder maken van een hexkleur, voor tinten uit één accent. */
export function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const kanaal = (v: string) => {
    const n = parseInt(v, 16);
    const uit = amount >= 0 ? n + (255 - n) * amount : n * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(uit)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${kanaal(m[1])}${kanaal(m[2])}${kanaal(m[3])}`;
}

/** Zwarte of witte tekst, afhankelijk van wat leesbaar is op deze kleur. */
export function readableOn(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#111110" : "#ffffff";
}
