"use client";

import { useMemo, useState } from "react";
import { Field, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Image as ImageIcon, LayoutGrid, IdCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LinkedInCardData } from "@/lib/linkedin-card";
import { LinkedInEditor } from "@/app/(app)/crm/vacatures/[id]/linkedin/LinkedInEditor";
import { CoverEditor } from "./CoverEditor";

export type VacancyImageOption = {
  id: string;
  label: string;
  status: string;
  card: LinkedInCardData;
};

type Kind = "cover" | "kaart";

export function LinkedInImagePicker({
  vacancies,
  preselectId,
  ogBase,
}: {
  vacancies: VacancyImageOption[];
  preselectId?: string;
  ogBase: string;
}) {
  const initialId =
    (preselectId && vacancies.some((v) => v.id === preselectId) ? preselectId : vacancies[0]?.id) ?? "";
  const [kind, setKind] = useState<Kind>("cover");
  const [selectedId, setSelectedId] = useState(initialId);

  const selected = useMemo(
    () => vacancies.find((v) => v.id === selectedId) ?? null,
    [vacancies, selectedId],
  );

  const KINDS: { key: Kind; label: string; icon: typeof LayoutGrid }[] = [
    { key: "cover", label: "Cover", icon: LayoutGrid },
    { key: "kaart", label: "Vacaturekaart", icon: IdCard },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-switch: cover-slide of losse vacaturekaart */}
      <div className="inline-flex rounded-xl border border-ink-200 bg-ink-50 p-1">
        {KINDS.map((k) => {
          const active = k.key === kind;
          const Icon = k.icon;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {k.label}
            </button>
          );
        })}
      </div>

      {kind === "cover" ? (
        <CoverEditor ogBase={ogBase} defaultCount={vacancies.length || 3} />
      ) : vacancies.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-6 w-6" />}
          title="Nog geen vacatures"
          description="Maak eerst een vacature aan; daarna kun je hier een vacaturekaart genereren."
        />
      ) : (
        <>
          <div className="max-w-md">
            <Field label="Vacature" hint="Kies de vacature waarvoor je een kaart maakt.">
              <Select defaultValue={initialId} onValueChange={setSelectedId}>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                    {v.status === "PUBLISHED" ? "  ·  live" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {selected && (
            <LinkedInEditor
              key={selected.id}
              dealId={selected.id}
              initial={selected.card}
              ogBase={ogBase}
            />
          )}
        </>
      )}
    </div>
  );
}
