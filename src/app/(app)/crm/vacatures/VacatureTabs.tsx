import Link from "next/link";
import { db } from "@/lib/db";
import { mapTabVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Eén mappenbalk voor ALLE vacatures in Recruitment: eerst de werving
// (openstaand / in pipeline), dan de website-fase (concept / gereed / online).
// Zo zit alles van een vacature op één plek; /crm/vacatures en /website delen
// deze balk.
// ---------------------------------------------------------------------------

export type VacatureTab = "open" | "pipeline" | "concept" | "gereed" | "online";

const TABS: { key: VacatureTab; label: string; dot: string; href: string; groep: "Werving" | "Website" }[] = [
  { key: "open", label: "Openstaand", dot: "bg-brand-500", href: "/crm/vacatures?view=open", groep: "Werving" },
  { key: "pipeline", label: "In pipeline", dot: "bg-violet-500", href: "/crm/vacatures?view=pipeline", groep: "Werving" },
  { key: "concept", label: "Website · concept", dot: "bg-ink-400", href: "/website?tab=concept", groep: "Website" },
  { key: "gereed", label: "Gereed", dot: "bg-blue-500", href: "/website?tab=gereed", groep: "Website" },
  { key: "online", label: "Online", dot: "bg-emerald-500", href: "/website?tab=online", groep: "Website" },
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
    <nav aria-label="Vacatures" className="flex items-end gap-1 overflow-x-auto border-b border-ink-200">
      {TABS.map((t, i) => {
        const on = t.key === actief;
        return (
          <span key={t.key} className="flex items-end">
            {i > 0 && TABS[i - 1].groep !== t.groep && (
              <span aria-hidden className="mx-2 mb-2.5 h-5 w-px bg-ink-200" />
            )}
            <Link href={t.href} scroll={false} aria-current={on ? "page" : undefined} className={mapTabVariants(on)}>
              <span className={cn("h-2.5 w-2.5 rounded-full", t.dot)} />
              {t.label}
              <span
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  on ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500",
                )}
              >
                {tel[t.key]}
              </span>
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
