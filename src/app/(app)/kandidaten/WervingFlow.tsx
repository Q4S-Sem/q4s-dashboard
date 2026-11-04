import Link from "next/link";
import { ChevronRight, ClipboardCheck, Inbox, Kanban, Users } from "lucide-react";
import { db } from "@/lib/db";
import { afgelopen24Uur } from "@/lib/vandaag";
import { herkomst } from "@/lib/eu-herkomst";
import { SPOOR, type Spoor } from "@/lib/spoor";
import { cn } from "@/lib/utils";

export type WervingStap = "binnen" | "beoordelen" | "pool" | "pipeline";

/**
 * De werving als één doorlopende flow (zelfde balk als bij Vacatures):
 * 1. Binnen → 2. Beoordelen → 3. Talentpool → 4. Pipeline.
 * Staat bovenaan Afgelopen 24 uur, Alle kandidaten en Pipeline, zodat je altijd
 * ziet waar je bent en hoeveel er per stap wacht. Tellingen = die van de pagina's
 * zelf (buiten de EU telt niet mee in Beoordelen/Talentpool).
 */
export async function WervingFlow({ spoor, actief }: { spoor: Spoor; actief: WervingStap }) {
  const sp = SPOOR[spoor];
  const kandidaten = await db.candidate.findMany({
    where: { spoor },
    select: { id: true, createdAt: true, rating: true, location: true, phone: true },
  });
  const sinds = afgelopen24Uur();
  const eu = kandidaten.filter((c) => herkomst(c) !== "BUITEN_EU");
  const inPipeline = await db.deal.count({ where: { status: "OPEN", candidateId: { in: kandidaten.map((c) => c.id) } } });

  const stappen: { key: WervingStap; label: string; hint: string; n: number; href: string; icon: React.ReactNode; kleur: string; balk: string }[] = [
    { key: "binnen", label: "1. Binnen", hint: "afgelopen 24 uur", n: kandidaten.filter((c) => c.createdAt >= sinds).length, href: sp.basis, icon: <Inbox />, kleur: "bg-blue-50 text-blue-600", balk: "bg-blue-500" },
    { key: "beoordelen", label: "2. Beoordelen", hint: "nog geen oordeel", n: eu.filter((c) => c.rating === "ONBEKEND").length, href: `${sp.alle}?map=beoordelen`, icon: <ClipboardCheck />, kleur: "bg-amber-50 text-amber-600", balk: "bg-amber-500" },
    { key: "pool", label: "3. Talentpool", hint: "alle kandidaten (EU)", n: eu.length, href: sp.alle, icon: <Users />, kleur: "bg-ink-100 text-ink-600", balk: "bg-ink-700" },
    { key: "pipeline", label: "4. Pipeline", hint: "lead → geplaatst", n: inPipeline, href: sp.pipeline, icon: <Kanban />, kleur: "bg-violet-50 text-violet-600", balk: "bg-violet-500" },
  ];

  return (
    <nav aria-label={`${sp.label}: stappen`} className="grid grid-cols-2 overflow-hidden rounded-lg border border-ink-200 bg-white lg:grid-cols-4">
      {stappen.map((s, i) => {
        const aan = s.key === actief;
        return (
          <Link
            key={s.key}
            href={s.href}
            aria-current={aan ? "page" : undefined}
            className={cn(
              "group relative flex min-w-0 flex-col gap-1 px-4 py-3 transition-colors hover:bg-ink-50",
              i % 2 === 1 && "border-l border-ink-200",
              i >= 2 && "border-t border-ink-200 lg:border-t-0",
              i === 2 && "lg:border-l",
            )}
          >
            {aan && <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-0.5", s.balk)} />}
            <span className={cn("flex items-center gap-2 text-[13px] font-medium", aan ? "text-ink-900" : "text-ink-600 group-hover:text-ink-900")}>
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5", s.kleur)}>{s.icon}</span>
              <span className="truncate">{s.label}</span>
              {i < stappen.length - 1 && <ChevronRight aria-hidden className="ml-auto hidden h-3.5 w-3.5 shrink-0 text-ink-300 lg:block" />}
            </span>
            <span className={cn("text-xl font-semibold leading-none tabular-nums", s.n > 0 ? "text-ink-900" : "text-ink-300")}>{s.n}</span>
            <span className="truncate text-[11px] text-ink-400">{s.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
