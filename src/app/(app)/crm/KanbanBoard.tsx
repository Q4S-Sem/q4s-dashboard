"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
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
  /** Profielfoto (kandidaatkaarten); leeg = gekleurde initialen van `title`. */
  avatarSrc?: string | null;
  /** Zet een avatar op de kaart, ook zonder foto. */
  showAvatar?: boolean;
};

const ACCENT: Record<BadgeColor, string> = {
  slate: "bg-ink-300",
  blue: "bg-blue-400",
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  violet: "bg-violet-400",
  cyan: "bg-cyan-400",
  orange: "bg-brand-500",
};

/** Gekleurde kop per kolom — geeft het bord in één oogopslag structuur. */
const HEADER: Record<BadgeColor, string> = {
  slate: "bg-ink-100 text-ink-700",
  blue: "bg-blue-100 text-blue-800",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  violet: "bg-violet-100 text-violet-800",
  cyan: "bg-cyan-100 text-cyan-800",
  orange: "bg-brand-100 text-brand-800",
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
              "flex w-72 shrink-0 flex-col rounded-md border bg-ink-50/70 transition-colors",
              overCol === col.id ? "border-brand-600 bg-brand-50/60" : "border-ink-100",
            )}
          >
            <div className="p-2.5">
              <div
                className={cn(
                  "flex items-center justify-between gap-2 rounded-sm px-3 py-2",
                  HEADER[col.color ?? "slate"],
                )}
              >
                <span className="truncate text-[11px] font-black uppercase tracking-[0.12em]">
                  {col.label}
                </span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 text-[11px] font-black tabular-nums">
                  {colCards.length}
                </span>
              </div>
              <div className={cn("mt-1.5 h-[3px] rounded-full", accent)} />
            </div>

            <div className="flex flex-1 flex-col gap-2 px-2.5 pb-2.5">
              {colCards.length === 0 ? (
                <p className="rounded-sm border border-dashed border-ink-200 px-3 py-6 text-center text-xs text-ink-400">
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
                      "group q4s-hoverable cursor-grab rounded-sm border border-ink-100 bg-white p-3 active:cursor-grabbing",
                      dragId === card.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {card.showAvatar && (
                        <Avatar name={card.title} src={card.avatarSrc} size="md" />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={card.href}
                          className="block truncate font-bold tracking-tight text-ink-900 hover:text-brand-600"
                        >
                          {card.title}
                        </Link>
                        {card.subtitle && (
                          <p className="mt-0.5 truncate text-xs text-ink-500">{card.subtitle}</p>
                        )}
                      </div>
                    </div>
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
                                    : "text-ink-300",
                                )}
                              />
                            ))}
                          </span>
                        ) : null}
                        {card.meta && (
                          <span className="text-xs text-ink-400">{card.meta}</span>
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
