"use client";

import { useState } from "react";
import { Kanban, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { KanbanBoard, type KanbanColumn, type KanbanCard } from "./KanbanBoard";
import { DealBoard, type DealColumn, type DealCard } from "./DealBoard";
import { moveApplication } from "./actions";

type Tab = "pipeline" | "kandidaten";

/**
 * De CRM-borden onder tabs. Primair: de deal-pipeline (het verkoopproces om een
 * openstaande vacature bij een eigen klant in te vullen met een kandidaat uit de
 * talentpool). Daarnaast het referentiebord met de kandidaten-sollicitatiepipeline.
 */
export function CrmBoards({
  dealColumns,
  dealCards,
  applicationColumns,
  applicationCards,
}: {
  dealColumns: DealColumn[];
  dealCards: DealCard[];
  applicationColumns: KanbanColumn[];
  applicationCards: KanbanCard[];
}) {
  const [tab, setTab] = useState<Tab>("pipeline");

  const tabs: { id: Tab; label: string; icon: typeof Kanban; count: number }[] = [
    { id: "pipeline", label: "Deal-pipeline", icon: Kanban, count: dealCards.length },
    { id: "kandidaten", label: "Kandidaten", icon: ClipboardList, count: applicationCards.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-ink-200 bg-ink-50 p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1.5 text-xs font-semibold tabular-nums",
                  active ? "bg-ink-100 text-ink-600" : "bg-ink-200 text-ink-500",
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "pipeline" && <DealBoard columns={dealColumns} cards={dealCards} />}
      {tab === "kandidaten" && (
        <KanbanBoard
          columns={applicationColumns}
          cards={applicationCards}
          onMove={moveApplication}
          emptyLabel="Geen sollicitaties in deze fase"
        />
      )}
    </div>
  );
}
