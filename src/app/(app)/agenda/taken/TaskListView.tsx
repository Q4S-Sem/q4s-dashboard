"use client";

import { useMemo, useState } from "react";
import { MoreVertical, Trash2, Check } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/field";
import { toggleTask, deleteTask, reassignTask } from "./actions";
import type { Person } from "./AssigneeSelect";

export type TaskRowData = {
  id: string;
  title: string;
  done: boolean;
  dueLabel: string;
  dueTone: "today" | "tomorrow" | "overdue" | "done" | "normal" | "none";
  assigneeId: string | null;
  assigneeName: string | null;
};

const toneClass: Record<TaskRowData["dueTone"], string> = {
  today: "text-amber-600 font-medium",
  tomorrow: "text-blue-600 font-medium",
  overdue: "text-red-600 font-medium",
  done: "text-ink-400 line-through",
  normal: "text-ink-500",
  none: "text-ink-300",
};

/** Ronde checkbox links, precies zoals de referentie. */
function DoneToggle({ id, done }: { id: string; done: boolean }) {
  return (
    <form action={toggleTask}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={done ? "Heropenen" : "Afronden"}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
          done
            ? "border-ink-900 bg-ink-900 text-white hover:bg-ink-700"
            : "border-ink-300 bg-white text-transparent hover:border-ink-500",
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>
    </form>
  );
}

/** ⋮-menu per rij (verwijderen) — portal zodat het nooit achter een rij valt. */
function RowMenu({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    if (open) {
      setOpen(false);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label="Meer acties"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} aria-hidden />
            <div
              style={{ top: pos?.top, right: pos?.right }}
              className="fixed z-[95] w-44 overflow-hidden rounded-lg border border-ink-200 bg-white p-1 shadow-xl"
            >
              <form action={deleteTask}>
                <input type="hidden" name="id" value={id} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Verwijderen
                </button>
              </form>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

export function TaskListView({ rows, people }: { rows: TaskRowData[]; people: Person[] }) {
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, pageCount);
  const shown = useMemo(
    () => rows.slice((current - 1) * perPage, current * perPage),
    [rows, current, perPage],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <th className="w-16 px-4 py-3">Done</th>
              <th className="px-4 py-3">Titel</th>
              <th className="px-4 py-3">Vervaldatum</th>
              <th className="px-4 py-3">Toegewezen</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-ink-400">
                  Geen taken in deze selectie.
                </td>
              </tr>
            ) : (
              shown.map((t) => (
                <tr key={t.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                  <td className="px-4 py-3">
                    <DoneToggle id={t.id} done={t.done} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "font-medium",
                        t.done ? "text-ink-400 line-through" : "text-ink-900",
                      )}
                    >
                      {t.title}
                    </span>
                  </td>
                  <td className={cn("whitespace-nowrap px-4 py-3", toneClass[t.dueTone])}>
                    {t.dueLabel}
                  </td>
                  <td className="px-4 py-3">
                    {t.done ? (
                      t.assigneeName ? (
                        <span className="inline-flex items-center gap-2 text-ink-500">
                          <Avatar name={t.assigneeName} size="xs" /> {t.assigneeName}
                        </span>
                      ) : (
                        <span className="italic text-ink-400">Niet toegewezen</span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {t.assigneeName && <Avatar name={t.assigneeName} size="xs" />}
                        <Select
                          aria-label="Toewijzen aan"
                          defaultValue={t.assigneeId ?? ""}
                          onValueChange={(v) => reassignTask(t.id, v || null)}
                          className="w-40"
                        >
                          <option value="">Niet toegewezen</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowMenu id={t.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Voettekst: rijen per pagina + paginanavigatie */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-ink-600">
          <Select
            aria-label="Rijen per pagina"
            defaultValue={String(perPage)}
            onValueChange={(v) => {
              setPerPage(Number(v));
              setPage(1);
            }}
            className="w-20"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </Select>
          <span>Rijen per pagina</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-600">
          <span>Pagina {current} van {pageCount}</span>
          <div className="flex items-center gap-1">
            <PagerButton label="«" disabled={current <= 1} onClick={() => setPage(1)} />
            <PagerButton label="‹" disabled={current <= 1} onClick={() => setPage(current - 1)} />
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-ink-900 px-2 text-xs font-semibold text-white">
              {current}
            </span>
            <PagerButton label="›" disabled={current >= pageCount} onClick={() => setPage(current + 1)} />
            <PagerButton label="»" disabled={current >= pageCount} onClick={() => setPage(pageCount)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PagerButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-500 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}
