"use client";

import { useMemo, useState } from "react";
import { Field, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Image as ImageIcon } from "lucide-react";
import type { LinkedInCardData } from "@/lib/linkedin-card";
import { LinkedInEditor } from "@/app/(app)/crm/vacatures/[id]/linkedin/LinkedInEditor";

export type VacancyImageOption = {
  id: string;
  label: string;
  status: string;
  card: LinkedInCardData;
};

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
  const [selectedId, setSelectedId] = useState(initialId);

  const selected = useMemo(
    () => vacancies.find((v) => v.id === selectedId) ?? null,
    [vacancies, selectedId],
  );

  if (vacancies.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon className="h-6 w-6" />}
        title="Nog geen vacatures"
        description="Maak eerst een vacature aan; daarna kun je hier de LinkedIn-afbeelding genereren."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <Field label="Vacature" hint="Kies de vacature waarvoor je een afbeelding maakt.">
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
    </div>
  );
}
