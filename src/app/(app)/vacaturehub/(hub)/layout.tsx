import { LayoutGrid, Plug, Filter, Sparkles, XCircle, Plug2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { DossierTabs } from "@/components/dossier-tabs";
import { isAIConfigured } from "@/lib/ai";
import { Upload } from "lucide-react";
import { getHubCounts } from "./data";

export const metadata = { title: "Vacaturehub" };
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
        title="Vacaturehub"
        description="Alle vacatures die binnenkomen bij de grote opdrachtgevers, door de AI-filter langs de Q4S-niche gelegd. Wat past stuur je door naar Maken — publiceren doe je daar."
        actions={
          <Link href="/vacatures/importeren" className={buttonVariants({ variant: "outline" })}>
            <Upload className="h-4 w-4" /> Bulk-import
          </Link>
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
        label="Vacaturehub"
        tabs={[
          { seg: "", label: "Overzicht", icon: <LayoutGrid className="h-4 w-4" /> },
          {
            seg: "instroom",
            label: "Opdrachtgevers",
            icon: <Plug className="h-4 w-4" />,
            count: c.total,
          },
          {
            seg: "beoordelen",
            label: "Te beoordelen",
            icon: <Filter className="h-4 w-4" />,
            count: c.unknown,
          },
          {
            seg: "relevant",
            label: "Relevant",
            icon: <Sparkles className="h-4 w-4" />,
            count: c.relevant,
          },
          {
            seg: "afgewezen",
            label: "Afgewezen",
            icon: <XCircle className="h-4 w-4" />,
            count: c.irrelevant,
          },
          { seg: "koppelingen", label: "Koppelingen", icon: <Plug2 className="h-4 w-4" /> },
        ]}
      />

      {children}
    </div>
  );
}
