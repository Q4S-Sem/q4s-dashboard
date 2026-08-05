"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, MessageSquare, User, CalendarClock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { DISCIPLINES, colorFor, labelFor, type BadgeColor } from "@/lib/domain";
import { moveDeal } from "./actions";

export type DealColumn = {
  id: string;
  label: string;
  color: BadgeColor;
  probability: number;
};

export type DealCard = {
  id: string;
  columnId: string;
  title: string;
  company: string;
  discipline: string | null;
  value: number;
  positions: number;
  fitScore: number;
  ownerName: string | null;
  nextFollowUpAt: string | null;
  lastActivityAt: string | null;
  noteCount: number;
};

const ACCENT: Record<BadgeColor, string> = {
  slate: "bg-ink-300",
  blue: "bg-blue-400",
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  violet: "bg-violet-400",
  cyan: "bg-cyan-400",
  orange: "bg-orange-400",
};

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return d.getTime() <= end.getTime();
}

/**
 * De deal-pipeline: een Kanban met configureerbare fases (kolommen) en rijke
 * kaarten (bedrijf, waarde, eigenaar, opvolging, activiteit). Sleep een kaart
 * naar een andere fase → moveDeal (server action, logt de fasewissel).
 */
export function DealBoard({
  columns,
  cards: initialCards,
}: {
  columns: DealColumn[];
  cards: DealCard[];
}) {
  const [cards, setCards] = useState<DealCard[]>(initialCards);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  async function move(cardId: string, toColumnId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.columnId === toColumnId) return;
    const prev = cards;
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, columnId: toColumnId } : c)));
    try {
      await moveDeal(cardId, toColumnId);
    } catch {
      setCards(prev);
    }
  }

  if (columns.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink-200 px-4 py-10 text-center text-sm text-ink-400">
        Geen zichtbare fases. Stel je pipeline in bij CRM-instellingen.
      </p>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => {
        const colCards = cards.filter((c) => c.columnId === col.id);
        const accent = ACCENT[col.color ?? "slate"];
        const colValue = colCards.reduce((s, c) => s + c.value, 0);
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
              "flex w-72 shrink-0 flex-col rounded-xl border bg-ink-50/60 transition-colors",
              overCol === col.id ? "border-brand-400 bg-brand-50/40" : "border-ink-200",
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", accent)} />
                <span className="text-sm font-semibold text-ink-700">{col.label}</span>
                <span className="text-[11px] text-ink-400">{col.probability}%</span>
              </div>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink-200 px-1.5 text-xs font-semibold tabular-nums text-ink-600">
                {colCards.length}
              </span>
            </div>
            <div className={cn("h-1 rounded-full mx-3", accent)} />
            {colValue > 0 && (
              <div className="px-3 pt-1.5 text-[11px] font-medium tabular-nums text-ink-500">
                {formatCurrency(colValue)}
              </div>
            )}

            <div className="flex flex-1 flex-col gap-2 p-3">
              {colCards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-xs text-ink-400">
                  Sleep hier een deal
                </p>
              ) : (
                colCards.map((card) => {
                  const overdue = isOverdue(card.nextFollowUpAt);
                  return (
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
                        "group cursor-grab rounded-lg border border-ink-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
                        dragId === card.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/crm/deals/${card.id}`}
                          className="block font-medium text-ink-900 hover:text-brand-700"
                        >
                          {card.title}
                        </Link>
                        {card.fitScore > 0 && (
                          <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5" title={`Fit ${card.fitScore}/5`}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "h-3 w-3",
                                  i < card.fitScore ? "fill-amber-400 text-amber-400" : "text-ink-200",
                                )}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-500">{card.company}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {card.discipline && (
                          <Badge color={colorFor(DISCIPLINES, card.discipline)}>
                            {labelFor(DISCIPLINES, card.discipline)}
                          </Badge>
                        )}
                        {card.value > 0 && (
                          <span className="text-xs font-semibold tabular-nums text-ink-700">
                            {formatCurrency(card.value)}
                          </span>
                        )}
                        {card.positions > 1 && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-ink-400">
                            <Users className="h-3 w-3" /> {card.positions}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-ink-100 pt-2 text-[11px] text-ink-400">
                        <span className="inline-flex items-center gap-1 truncate">
                          {card.ownerName ? (
                            <>
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{card.ownerName}</span>
                            </>
                          ) : (
                            <span className="text-ink-300">Geen eigenaar</span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="inline-flex items-center gap-0.5" title="Notities">
                            <MessageSquare className="h-3 w-3" /> {card.noteCount}
                          </span>
                          {card.nextFollowUpAt && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5",
                                overdue ? "font-semibold text-red-600" : "text-ink-400",
                              )}
                              title="Opvolgen op"
                            >
                              <CalendarClock className="h-3 w-3" />
                              {formatDate(card.nextFollowUpAt)}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
