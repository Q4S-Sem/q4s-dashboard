import { UserCog, Workflow } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { DossierTabs } from "@/components/dossier-tabs";
import { currentRecruiter } from "@/lib/crm";

export const metadata = { title: "CRM-instellingen" };

/**
 * De CRM-instellingen in twee mapjes: wat alléén voor jou geldt, en wat het
 * hele team deelt. Dat onderscheid stond er eerder als twee losse blokken
 * onder elkaar; als mapjes is meteen duidelijk waar je iets verandert.
 */
export default async function CrmInstellingenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const recruiter = await currentRecruiter();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackLink href="/crm">Terug naar CRM</BackLink>

      <PageHeader
        title="CRM-instellingen"
        description="Stel de CRM naar jouw hand — persoonlijke voorkeuren per recruiter, plus de pipeline-fases die het hele team deelt."
      />

      <DossierTabs
        base="/crm/instellingen"
        label="CRM-instellingen"
        tabs={[
          {
            seg: "",
            label: recruiter ? `Persoonlijk — ${recruiter.name}` : "Persoonlijk",
            icon: <UserCog className="h-4 w-4" />,
          },
          {
            seg: "fases",
            label: "Pipeline-fases",
            icon: <Workflow className="h-4 w-4" />,
          },
        ]}
      />

      {children}
    </div>
  );
}
