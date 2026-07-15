"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BadgeColor } from "@/lib/domain";

export type KanbanColumn = { id: string; label: string; color?: BadgeColor };
export type KanbanCard = {
  id: string;
  columnId: string;
  title: string;
  subtitle?: string | null;
  href: string;
  tags?: { label: string; color?: BadgeColor }[];
  /** 1..5 prioriteit (optioneel) — getoond als sterren. */
  stars?: number;
  meta?: string | null;
};

const ACCENT: Record<BadgeColor, string> = {
  slate: "bg-slate-300",
  blue: "bg-blue-400",
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  violet: "bg-violet-400",
  cyan: "bg-cyan-400",
};

/**
 * Generiek Kanban-bord met HTML5 drag-and-drop. Sleep een kaart naar een andere
 * kolom → `onMove(cardId, toColumnId)` (server action). De verplaatsing is
 * optimistisch; faalt de server, dan draait hij terug.
 */
export function KanbanBoard({
  columns,
  cards: initialCards,
  onMove,
  emptyLabel = "Geen kaarten",
}: {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onMove: (cardId: string, toColumnId: string) => Promise<void>;
  emptyLabel?: string;
}) {
  const [cards, setCards] = useState<KanbanCard[]>(initialCards);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  async function move(cardId: string, toColumnId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.columnId === toColumnId) return;
    const prev = cards;
    // Optimistisch verplaatsen.
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, columnId: toColumnId } : c)));
    try {
      await onMove(cardId, toColumnId);
    } catch {
      setCards(prev); // terugdraaien bij fout
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => {
        const colCards = cards.filter((c) => c.columnId === col.id);
        const accent = ACCENT[col.color ?? "slate"];
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.id);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragId;
              setOverCol(null);
              setDragId(null);
              if (id) move(id, col.id);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border bg-slate-50/60 transition-colors",
              overCol === col.id ? "border-brand-400 bg-brand-50/40" : "border-slate-200",
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", accent)} />
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
              </div>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-xs font-semibold tabular-nums text-slate-600">
                {colCards.length}
              </span>
            </div>
            <div className={cn("h-1 rounded-full mx-3", accent)} />

            <div className="flex flex-1 flex-col gap-2 p-3">
              {colCards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                  {emptyLabel}
                </p>
              ) : (
                colCards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", card.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(card.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
                      dragId === card.id && "opacity-50",
                    )}
                  >
                    <Link
                      href={card.href}
                      className="block font-medium text-slate-900 hover:text-brand-700"
                    >
                      {card.title}
                    </Link>
                    {card.subtitle && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">{card.subtitle}</p>
                    )}
                    {(card.tags?.length || card.stars || card.meta) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {card.tags?.map((t, i) => (
                          <Badge key={i} color={t.color ?? "slate"}>
                            {t.label}
                          </Badge>
                        ))}
                        {card.stars ? (
                          <span className="inline-flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "h-3.5 w-3.5",
                                  i < (card.stars ?? 0)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-slate-300",
                                )}
                              />
                            ))}
                          </span>
                        ) : null}
                        {card.meta && (
                          <span className="text-xs text-slate-400">{card.meta}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
