"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, MessageSquare, CalendarClock } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { DISCIPLINES, colorFor, labelFor, type BadgeColor } from "@/lib/domain";
import { moveDeal } from "./actions";

export type DealColumn = {
  id: string;
  label: string;
  color: BadgeColor;
  probability: number;
  isLost?: boolean;
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
  candidateName: string | null;
  candidatePhoto: string | null;
  candidateHeadline: string | null;
  candidateLocation: string | null;
  candidateRating: string | null;
  vacancyTitle: string | null;
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
    // Verloren = meteen naar het archief: eerst bevestigen.
    const verloren = columns.find((c) => c.id === toColumnId)?.isLost;
    if (verloren && !window.confirm(`Weet je het zeker? "${card.candidateName ?? card.title}" gaat als verloren direct naar het archief.`)) return;
    const prev = cards;
    setCards((cs) =>
      verloren ? cs.filter((c) => c.id !== cardId) : cs.map((c) => (c.id === cardId ? { ...c, columnId: toColumnId } : c)),
    );
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
    <div className="overflow-x-auto pb-2">
      <div className="flex w-fit gap-2.5">
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
              "flex w-60 shrink-0 flex-col rounded-md border bg-ink-50/60 transition-colors",
              overCol === col.id ? "border-brand-400 bg-brand-50/40" : "border-ink-200",
            )}
          >
            <div className="flex items-center justify-between gap-2 px-2.5 pt-2.5 pb-1.5">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", accent)} />
                <span className="truncate text-[13px] font-semibold text-ink-700">{col.label}</span>
                <span className="text-[11px] text-ink-400">{col.probability}%</span>
              </div>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-ink-200 px-1.5 text-xs font-semibold tabular-nums text-ink-600">
                {colCards.length}
              </span>
            </div>
            <div className={cn("mx-2.5 h-0.5 rounded-full", accent)} />
            {colValue > 0 && (
              <div className="px-2.5 pt-1 text-[11px] font-medium tabular-nums text-ink-500">
                {formatCurrency(colValue)}
              </div>
            )}

            <div className="flex min-h-24 flex-1 flex-col gap-1.5 p-2">
              {colCards.length === 0 ? (
                <p className="rounded-md border border-dashed border-ink-200 px-2 py-4 text-center text-[11px] text-ink-400">
                  Sleep hier een deal
                </p>
              ) : (
                colCards.map((card) => {
                  const overdue = isOverdue(card.nextFollowUpAt);
                  const displayName = card.candidateName ?? card.title;
                  return (
                    <Link
                      key={card.id}
                      href={`/crm/deals/${card.id}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", card.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(card.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      title="Klik om te openen · sleep naar een andere fase"
                      className={cn(
                        "block cursor-grab rounded-md border border-ink-200 bg-white px-2.5 py-2 transition-colors hover:border-ink-400 active:cursor-grabbing",
                        dragId === card.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={displayName} src={card.candidatePhoto} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold leading-tight text-ink-900">{displayName}</p>
                          <p className="truncate text-[11px] leading-tight text-ink-500">
                            {card.company}
                            {card.candidateHeadline ? ` · ${card.candidateHeadline}` : ""}
                          </p>
                        </div>
                        {card.fitScore > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-amber-600" title={`Fit ${card.fitScore}/5`}>
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {card.fitScore}
                          </span>
                        )}
                      </div>
                      {(card.discipline || card.value > 0 || card.nextFollowUpAt || card.noteCount > 0) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
                          {card.discipline && (
                            <Badge color={colorFor(DISCIPLINES, card.discipline)}>
                              {labelFor(DISCIPLINES, card.discipline)}
                            </Badge>
                          )}
                          {card.value > 0 && (
                            <span className="font-semibold tabular-nums text-ink-700">{formatCurrency(card.value)}</span>
                          )}
                          <span className="ml-auto inline-flex items-center gap-2">
                            {card.noteCount > 0 && (
                              <span className="inline-flex items-center gap-0.5" title="Notities">
                                <MessageSquare className="h-3 w-3" /> {card.noteCount}
                              </span>
                            )}
                            {card.nextFollowUpAt && (
                              <span
                                className={cn("inline-flex items-center gap-0.5", overdue ? "font-semibold text-red-600" : "")}
                                title="Opvolgen op"
                              >
                                <CalendarClock className="h-3 w-3" />
                                {formatDate(card.nextFollowUpAt)}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
