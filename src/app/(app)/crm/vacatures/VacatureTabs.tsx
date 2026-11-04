import { Briefcase, CheckCircle2, Globe, Kanban, PencilLine } from "lucide-react";
import { db } from "@/lib/db";
import Link from "next/link";
import { mapTabVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Eén mappenbalk voor ALLE vacatures in Recruitment: eerst de werving
// (openstaand / in pipeline), dan de website-fase (concept / gereed / online).
// Zo zit alles van een vacature op één plek; /crm/vacatures en /website delen
// deze balk.
// ---------------------------------------------------------------------------

export type VacatureTab = "open" | "pipeline" | "concept" | "gereed" | "online";

const GROEPEN: { titel: string; tabs: { key: VacatureTab; label: string; icon: React.ReactNode; href: string }[] }[] = [
  {
    titel: "Werving",
    tabs: [
      { key: "open", label: "Openstaand", icon: <Briefcase className="h-4 w-4" />, href: "/crm/vacatures?view=open" },
      { key: "pipeline", label: "In pipeline", icon: <Kanban className="h-4 w-4" />, href: "/crm/vacatures?view=pipeline" },
    ],
  },
  {
    titel: "Website",
    tabs: [
      { key: "concept", label: "Concept", icon: <PencilLine className="h-4 w-4" />, href: "/website?tab=concept" },
      { key: "gereed", label: "Gereed", icon: <CheckCircle2 className="h-4 w-4" />, href: "/website?tab=gereed" },
      { key: "online", label: "Online", icon: <Globe className="h-4 w-4" />, href: "/website?tab=online" },
    ],
  },
];

/** Websitefase: geen tekst (of CONCEPT) → concept, PUBLISHED → online, anders gereed. */
export function websiteFase(vac: { status: string } | null): "concept" | "gereed" | "online" {
  if (!vac || vac.status === "CONCEPT") return "concept";
  if (vac.status === "PUBLISHED") return "online";
  return "gereed";
}

export async function VacatureTabs({ actief }: { actief: VacatureTab }) {
  const deals = await db.deal.findMany({
    where: { status: "OPEN" },
    select: { candidateId: true, vacancy: { select: { status: true } } },
  });
  const tel: Record<VacatureTab, number> = { open: 0, pipeline: 0, concept: 0, gereed: 0, online: 0 };
  for (const d of deals) {
    if (d.candidateId) {
      tel.pipeline++;
    } else {
      tel.open++;
      tel[websiteFase(d.vacancy)]++;
    }
  }

  // Onderstreepte tabs in twee groepen (werving · website) met het aantal erachter.
  return (
    <nav aria-label="Vacatures" className="flex flex-wrap items-end gap-x-6 border-b border-ink-200">
      {GROEPEN.map((g) => (
        <div key={g.titel} className="flex items-end gap-1">
          <span className="mb-2.5 mr-1 hidden text-[11px] font-medium text-ink-400 sm:inline">{g.titel}</span>
          {g.tabs.map((t) => {
            const aan = t.key === actief;
            return (
              <Link key={t.key} href={t.href} aria-current={aan ? "page" : undefined} className={mapTabVariants(aan)}>
                <span className={aan ? "text-ink-900" : "text-ink-400"}>{t.icon}</span>
                {t.label}
                <span className={cn("rounded-sm px-1.5 text-[11px] font-semibold tabular-nums", aan ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-500")}>
                  {tel[t.key]}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
