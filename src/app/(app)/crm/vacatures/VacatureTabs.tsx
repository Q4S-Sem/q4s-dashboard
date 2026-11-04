import { Briefcase, CheckCircle2, ChevronRight, Globe, Kanban, PencilLine } from "lucide-react";
import { db } from "@/lib/db";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Eén mappenbalk voor ALLE vacatures in Recruitment: eerst de werving
// (openstaand / in pipeline), dan de website-fase (concept / gereed / online).
// Zo zit alles van een vacature op één plek; /crm/vacatures en /website delen
// deze balk.
// ---------------------------------------------------------------------------

export type VacatureTab = "open" | "pipeline" | "concept" | "gereed" | "online";

/** Eigen kleur per fase (vaste klassen, zodat Tailwind ze vindt): icoon-vlakje, cijfer en actieve balk. */
const KLEUR: Record<VacatureTab, { vlak: string; tekst: string; balk: string }> = {
  open: { vlak: "bg-amber-50 text-amber-600", tekst: "text-amber-700", balk: "bg-amber-500" },
  pipeline: { vlak: "bg-violet-50 text-violet-600", tekst: "text-violet-700", balk: "bg-violet-500" },
  concept: { vlak: "bg-ink-100 text-ink-600", tekst: "text-ink-800", balk: "bg-ink-700" },
  gereed: { vlak: "bg-blue-50 text-blue-600", tekst: "text-blue-700", balk: "bg-blue-500" },
  online: { vlak: "bg-emerald-50 text-emerald-600", tekst: "text-emerald-700", balk: "bg-emerald-500" },
};

const GROEPEN: { titel: string; tabs: { key: VacatureTab; label: string; hint: string; icon: React.ReactNode; href: string }[] }[] = [
  {
    titel: "Werving",
    tabs: [
      { key: "open", label: "Openstaand", hint: "nog geen kandidaat", icon: <Briefcase className="h-4 w-4" />, href: "/crm/vacatures?view=open" },
      { key: "pipeline", label: "In pipeline", hint: "kandidaat gekoppeld", icon: <Kanban className="h-4 w-4" />, href: "/crm/vacatures?view=pipeline" },
    ],
  },
  {
    titel: "Website",
    tabs: [
      { key: "concept", label: "Concept", hint: "website-tekst schrijven", icon: <PencilLine className="h-4 w-4" />, href: "/website?tab=concept" },
      { key: "gereed", label: "Gereed", hint: "klaar om live te zetten", icon: <CheckCircle2 className="h-4 w-4" />, href: "/website?tab=gereed" },
      { key: "online", label: "Online", hint: "staat op q4s.nl", icon: <Globe className="h-4 w-4" />, href: "/website?tab=online" },
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

  // Fase-balk: één rij vakken van links naar rechts, zoals de vacature door het
  // proces loopt (werving → website). Per vak het aantal groot en wat je er doet.
  return (
    <nav aria-label="Vacatures per fase" className="grid overflow-hidden rounded-lg border border-ink-200 sm:grid-cols-[2fr_3fr]">
      {GROEPEN.map((g, gi) => (
        <div key={g.titel} className={cn("flex flex-col", gi > 0 && "border-t border-ink-200 sm:border-l sm:border-t-0")}>
          <div className="border-b border-ink-200 bg-ink-50 px-3 py-1.5 text-[11px] font-medium text-ink-500">{g.titel}</div>
          <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${g.tabs.length}, minmax(0, 1fr))` }}>
            {g.tabs.map((t, ti) => {
              const aan = t.key === actief;
              return (
                <Link
                  key={t.key}
                  href={t.href}
                  aria-current={aan ? "page" : undefined}
                  className={cn(
                    "group relative flex min-w-0 flex-col gap-1 px-3 py-2.5 transition-colors",
                    ti > 0 && "border-l border-ink-200",
                    aan ? "bg-white" : "bg-white hover:bg-ink-50",
                  )}
                >
                  {/* Actief = zwarte balk onderaan (zelfde taal als de tabs elders). */}
                  {aan && <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-0.5", KLEUR[t.key].balk)} />}
                  <span className={cn("flex items-center gap-2 text-[13px] font-medium", aan ? "text-ink-900" : "text-ink-600 group-hover:text-ink-900")}>
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5", KLEUR[t.key].vlak)}>{t.icon}</span>
                    <span className="truncate">{t.label}</span>
                    {/* Pijltje: de website-fases volgen elkaar op. */}
                    {g.titel === "Website" && ti < g.tabs.length - 1 && (
                      <ChevronRight aria-hidden className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-300" />
                    )}
                  </span>
                  <span className={cn("text-xl font-semibold leading-none tabular-nums", tel[t.key] > 0 ? KLEUR[t.key].tekst : "text-ink-300")}>{tel[t.key]}</span>
                  <span className="truncate text-[11px] text-ink-400">{t.hint}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
