import { cn } from "@/lib/utils";

// A GitHub-style contribution heatmap of Q4S activity (urenstaten, facturen,
// sollicitaties, afspraken, declaraties) over the last ~53 weeks.

const MONTHS = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function tone(count: number): string {
  if (count <= 0) return "bg-ink-100";
  if (count <= 2) return "bg-emerald-200";
  if (count <= 5) return "bg-emerald-300";
  if (count <= 9) return "bg-emerald-500";
  return "bg-emerald-700";
}

export function ActivityHeatmap({ counts }: { counts: Record<string, number> }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Monday of the current ISO week, then 52 weeks back for the grid start.
  const curMonday = new Date(today);
  curMonday.setDate(curMonday.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(curMonday);
  start.setDate(start.getDate() - 52 * 7);

  type Cell = { date: Date; count: number; future: boolean };
  const weeks: Cell[][] = [];
  const inRange: Cell[] = [];
  for (let w = 0; w < 53; w++) {
    const col: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(date.getDate() + w * 7 + d);
      const cell: Cell = {
        date,
        count: counts[dayKey(date)] ?? 0,
        future: date > today,
      };
      col.push(cell);
      if (!cell.future) inRange.push(cell);
    }
    weeks.push(col);
  }

  // ---- Stats ----
  const total = inRange.reduce((s, c) => s + c.count, 0);
  const monthTotals = new Array(12).fill(0);
  for (const c of inRange) monthTotals[c.date.getMonth()] += c.count;
  const bestMonthIdx = monthTotals.indexOf(Math.max(...monthTotals));
  const bestMonth = total > 0 ? MONTHS[bestMonthIdx] : "—";

  let bestDay: Cell | null = null;
  for (const c of inRange) if (!bestDay || c.count > bestDay.count) bestDay = c;
  const bestDayLabel =
    bestDay && bestDay.count > 0
      ? bestDay.date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
      : "—";

  let longest = 0;
  let run = 0;
  for (const c of inRange) {
    if (c.count > 0) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  let current = 0;
  for (let i = inRange.length - 1; i >= 0; i--) {
    if (inRange[i].count > 0) current += 1;
    else break;
  }

  // Month label above the column where a new month starts (top row = Monday).
  const monthLabels = weeks.map((col, i) => {
    const first = col[0].date;
    const prev = i > 0 ? weeks[i - 1][0].date : null;
    return !prev || prev.getMonth() !== first.getMonth() ? MONTHS[first.getMonth()] : "";
  });

  const dowLabels = ["", "Ma", "", "Wo", "", "Vr", ""];

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold tracking-tight text-ink-900 tabular-nums">
            {total.toLocaleString("nl-NL")}
          </p>
          <p className="text-sm text-ink-500">activiteiten in het afgelopen jaar</p>
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-ink-400 sm:flex">
          Minder
          <span className="h-3 w-3 rounded-sm bg-ink-100" />
          <span className="h-3 w-3 rounded-sm bg-emerald-200" />
          <span className="h-3 w-3 rounded-sm bg-emerald-300" />
          <span className="h-3 w-3 rounded-sm bg-emerald-500" />
          <span className="h-3 w-3 rounded-sm bg-emerald-700" />
          Meer
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          {/* Month labels */}
          <div className="mb-1 flex pl-8 text-[10px] text-ink-400">
            {monthLabels.map((m, i) => (
              <div key={i} className="w-[15px] shrink-0">
                {m}
              </div>
            ))}
          </div>
          <div className="flex">
            {/* Day-of-week labels */}
            <div className="mr-1 flex w-7 shrink-0 flex-col gap-[3px] text-[10px] text-ink-400">
              {dowLabels.map((d, i) => (
                <div key={i} className="flex h-[12px] items-center">
                  {d}
                </div>
              ))}
            </div>
            {/* Grid */}
            <div className="flex gap-[3px]">
              {weeks.map((col, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {col.map((cell, di) => (
                    <span
                      key={di}
                      title={`${cell.date.toLocaleDateString("nl-NL")} · ${cell.count} activiteit${cell.count === 1 ? "" : "en"}`}
                      className={cn(
                        "h-[12px] w-[12px] rounded-sm",
                        cell.future ? "bg-transparent" : tone(cell.count),
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-ink-100 pt-4 sm:grid-cols-4">
        <Stat label="Drukste maand" value={bestMonth} />
        <Stat label="Drukste dag" value={bestDayLabel} />
        <Stat label="Langste reeks" value={`${longest} ${longest === 1 ? "dag" : "dagen"}`} />
        <Stat label="Huidige reeks" value={`${current} ${current === 1 ? "dag" : "dagen"}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 text-lg font-semibold capitalize text-ink-900">{value}</p>
    </div>
  );
}
