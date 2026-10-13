import { Inbox, Plug, Sparkles, XCircle, Upload } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { DossierTabs } from "@/components/dossier-tabs";
import { isAIConfigured } from "@/lib/ai";
import { getHubCounts } from "./data";

export const metadata = { title: "MSP" };
// De Web-speurder zoekt meerdere vakgebieden op het web; dat duurt even.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * De vacaturehub: instroom uit alle MSP/VMS-platformen, de AI-filter die bepaalt
 * wat bij Q4S past, en wat er uiteindelijk live gaat. Opgedeeld in mapjes omdat
 * het anders één eindeloze pagina wordt.
 */
export default async function VacaturehubLayout({ children }: { children: React.ReactNode }) {
  const c = await getHubCounts();

  return (
    <div className="space-y-6">
      <PageHeader
        title="MSP"
        description="Elke ochtend zoeken de agents nieuwe vacatures op het web en in de MSP-portalen, en zet de AI wat bij Q4S past klaar. Jij beoordeelt: oppakken, lead of wegleggen."
        actions={
          <div className="flex gap-2">
            <Link href="/vacatures/importeren" className={buttonVariants({ variant: "outline" })}>
              <Upload className="h-4 w-4" /> Bulk-import
            </Link>
          </div>
        }
      />

      {!isAIConfigured() && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>De AI-filter staat uit.</strong> Zet een sleutel klaar bij{" "}
          <Link href="/gebruikers/api-sleutels" className="font-medium underline">
            Instellingen › API-sleutels
          </Link>{" "}
          om vacatures automatisch te laten beoordelen. Handmatig beoordelen kan wel gewoon.
        </p>
      )}

      <DossierTabs
        base="/vacaturehub"
        label="MSP"
        tabs={[
          { seg: "", label: "Te beoordelen", icon: <Inbox className="h-4 w-4" />, count: c.inbox },
          { seg: "relevant", label: "Opgepakt", icon: <Sparkles className="h-4 w-4" />, count: c.opgepakt },
          { seg: "afgewezen", label: "Weggelegd", icon: <XCircle className="h-4 w-4" />, count: c.irrelevant },
          { seg: "koppelingen", label: "Bronnen", icon: <Plug className="h-4 w-4" /> },
        ]}
      />

      {children}
    </div>
  );
}
