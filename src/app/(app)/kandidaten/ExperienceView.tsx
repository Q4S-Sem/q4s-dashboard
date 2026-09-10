import { Briefcase } from "lucide-react";

/**
 * Nette weergave van de (door de AI samengevatte) werkervaring. De tekst komt
 * binnen als: een intro-zin over profiel/jaren ervaring, gevolgd door een regel
 * per functie die begint met "•". We tonen de intro als lead-zin en elke functie
 * als een eigen kaartje, met witruimte ertussen zodat het rustig leesbaar is.
 */
function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** True voor een regel die als opsommingspunt/functie bedoeld is. */
function isBullet(line: string): boolean {
  return /^[•\-*·]/.test(line);
}

/** Strip het opsommingsteken vooraan. */
function stripBullet(line: string): string {
  return line.replace(/^[•\-*·]\s*/, "").trim();
}

export function ExperienceView({ summary }: { summary: string }) {
  const lines = splitLines(summary);
  if (lines.length === 0) return null;

  // Alles vóór het eerste opsommingspunt = intro/profiel-zin(nen).
  const firstBullet = lines.findIndex(isBullet);
  const intro = (firstBullet === -1 ? lines : lines.slice(0, firstBullet)).join(" ");
  const bullets = (firstBullet === -1 ? [] : lines.slice(firstBullet))
    .filter(isBullet)
    .map(stripBullet);

  return (
    <div className="space-y-4">
      {intro && (
        <p className="text-sm leading-relaxed text-ink-700">{intro}</p>
      )}
      {bullets.length > 0 && (
        <ul className="space-y-3">
          {bullets.map((b, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-lg border border-ink-200 bg-white p-3.5 shadow-sm"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <Briefcase className="h-4 w-4" />
              </span>
              <span className="text-sm leading-relaxed text-ink-700">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
