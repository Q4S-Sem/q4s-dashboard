import { Briefcase, CheckCircle2, Globe, Kanban, PencilLine } from "lucide-react";
import { db } from "@/lib/db";
import { FilterTegels, type TegelToon } from "@/components/ui/filter-tegels";

// ---------------------------------------------------------------------------
// Eén mappenbalk voor ALLE vacatures in Recruitment: eerst de werving
// (openstaand / in pipeline), dan de website-fase (concept / gereed / online).
// Zo zit alles van een vacature op één plek; /crm/vacatures en /website delen
// deze balk.
// ---------------------------------------------------------------------------

export type VacatureTab = "open" | "pipeline" | "concept" | "gereed" | "online";

const TABS: { key: VacatureTab; label: string; icon: React.ReactNode; toon: TegelToon; href: string }[] = [
  { key: "open", label: "Openstaand", icon: <Briefcase className="h-4 w-4" />, toon: "slate", href: "/crm/vacatures?view=open" },
  { key: "pipeline", label: "In pipeline", icon: <Kanban className="h-4 w-4" />, toon: "violet", href: "/crm/vacatures?view=pipeline" },
  { key: "concept", label: "Website · concept", icon: <PencilLine className="h-4 w-4" />, toon: "amber", href: "/website?tab=concept" },
  { key: "gereed", label: "Gereed", icon: <CheckCircle2 className="h-4 w-4" />, toon: "blue", href: "/website?tab=gereed" },
  { key: "online", label: "Online", icon: <Globe className="h-4 w-4" />, toon: "green", href: "/website?tab=online" },
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

  return (
    <FilterTegels
      label="Vacatures"
      items={TABS.map((t) => ({ key: t.key, label: t.label, waarde: tel[t.key], icon: t.icon, toon: t.toon, href: t.href, actief: t.key === actief }))}
    />
  );
}
