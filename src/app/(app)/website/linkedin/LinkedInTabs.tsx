"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkedInGenerator, type VacancyOption } from "../../socials/LinkedInGenerator";
import { LinkedInImagePicker, type VacancyImageOption } from "./LinkedInImagePicker";

type TextDefaults = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

type View = "tekst" | "afbeelding";

const TABS: { key: View; label: string; icon: typeof FileText }[] = [
  { key: "tekst", label: "Vacaturetekst", icon: FileText },
  { key: "afbeelding", label: "Afbeelding", icon: ImageIcon },
];

export function LinkedInTabs({
  initialView,
  preselectId,
  textOptions,
  imageOptions,
  textDefaults,
  siteUrl,
  ogBase,
}: {
  initialView: View;
  preselectId?: string;
  textOptions: VacancyOption[];
  imageOptions: VacancyImageOption[];
  textDefaults: TextDefaults;
  siteUrl: string;
  ogBase: string;
}) {
  const [view, setView] = useState<View>(initialView);

  return (
    <div className="space-y-6">
      {/* Switch tussen vacaturetekst en afbeelding */}
      <div className="inline-flex rounded-xl border border-ink-200 bg-ink-50 p-1">
        {TABS.map((t) => {
          const active = t.key === view;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {view === "tekst" ? (
        <LinkedInGenerator
          vacancies={textOptions}
          preselectId={preselectId}
          defaults={textDefaults}
          siteUrl={siteUrl}
        />
      ) : (
        <LinkedInImagePicker vacancies={imageOptions} preselectId={preselectId} ogBase={ogBase} />
      )}
    </div>
  );
}
