import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Vacaturehub" };
export const dynamic = "force-dynamic";

/**
 * De Vacaturehub (MSP/VMS-instroom van de grote opdrachtgevers) staat bewust
 * ONDER ONDERHOUD. Dit is een later, complex traject: er moet een MSP gebouwd
 * worden en de grootste opdrachtgevers moeten eraan gekoppeld worden. Tot die
 * tijd toont deze hub — inclusief alle subpagina's — één maintenance-scherm.
 *
 * De echte pagina's (Overzicht/Opdrachtgevers/Beoordelen/Relevant/Afgewezen/
 * Koppelingen) blijven op schijf staan; deze layout rendert `children` bewust
 * NIET, zodat de hele hub in onderhoud is zonder iets te verwijderen. Zodra we
 * dit oppakken: herstel de oude layout (DossierTabs + {children}).
 */
export default function VacaturehubLayout() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacaturehub"
        description="Instroom van vacatures bij de grote opdrachtgevers (MSP/VMS)."
      />

      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Wrench className="h-7 w-7" />
            </span>
            <div className="max-w-md space-y-2">
              <h2 className="text-lg font-semibold text-ink-900">In ontwikkeling</h2>
              <p className="text-sm leading-relaxed text-ink-500">
                De Vacaturehub is nog niet beschikbaar. Dit onderdeel koppelt straks de
                instroom van de grote opdrachtgevers via een eigen MSP — een uitgebreid
                traject dat we later oppakken.
              </p>
              <p className="text-sm leading-relaxed text-ink-500">
                Plaats je vacatures voorlopig in de{" "}
                <span className="font-medium text-ink-700">recruitment-hub</span>; die is
                leidend en stuurt ze door naar de website.
              </p>
            </div>
            <span className="mt-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              🚧 Onder onderhoud
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
