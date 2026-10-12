import { LayoutGrid, Plug, Filter, Sparkles, XCircle, Plug2, Radar } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { DossierTabs } from "@/components/dossier-tabs";
import { isAIConfigured } from "@/lib/ai";
import { Upload } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { runSyncNow } from "../../sourcing/actions";
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
        description="Vacatures uit de MSP-portalen én van de Web-speurder (dagelijks, openbare vacatures op het web). De AI screent alles op de Q4S-niche; jij beslist wat we uitschrijven en posten."
        actions={
          <div className="flex gap-2">
          <form action={runSyncNow}>
            <input type="hidden" name="back" value="/vacaturehub" />
            <SubmitButton variant="outline" pendingLabel="Agent zoekt… (±1 min)" title="Web-speurder nu laten zoeken, daarna AI-filter en matching">
              <Radar className="h-4 w-4" /> Nu zoeken
            </SubmitButton>
          </form>
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
