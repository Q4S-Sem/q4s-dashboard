import { cn } from "@/lib/utils";

/**
 * Wat je ziet in de fractie van een seconde tussen klikken en de pagina.
 *
 * Zonder dit staat de browser stil op de vorige pagina tot de server klaar is —
 * dat voelt alsof je klik niet aankwam. Met een skelet reageert het scherm
 * meteen en zie je de vorm van wat er komt. Next.js laadt dit bovendien alvast
 * vooruit zodra een link in beeld staat, dus het verschijnt direct.
 */

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-ink-100", className)} />;
}

export function PageSkeleton({
  /** Toon een ronde plek voor een profielfoto naast de titel. */
  avatar = false,
  /** Aantal blokken onder de kop. */
  blocks = 2,
}: {
  avatar?: boolean;
  blocks?: number;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Bezig met laden">
      <Bar className="h-4 w-20" />

      <div className="flex items-center gap-4">
        {avatar && <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-ink-100" />}
        <div className="flex-1 space-y-2">
          <Bar className="h-7 w-64" />
          <Bar className="h-4 w-40" />
        </div>
        <Bar className="h-10 w-28" />
      </div>

      {Array.from({ length: blocks }).map((_, i) => (
        <div key={i} className="rounded-md border border-ink-100 bg-white p-5">
          <Bar className="h-4 w-32" />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="space-y-2">
                <Bar className="h-3 w-20" />
                <Bar className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
