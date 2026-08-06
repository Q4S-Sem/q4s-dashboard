import {
  LayoutDashboard,
  ListTodo,
  PieChart,
  Sparkles,
  Briefcase,
  ClipboardCheck,
  BarChart3,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DossierTabs } from "@/components/dossier-tabs";

/**
 * De Analytics-hub: één vaste kop met daaronder de mappen-tabs, precies zoals
 * het klant- en kandidaatdossier. De acht deelrapportages stonden alleen in het
 * zijmenu; als mapjes zie je in één blik wat er is en waar je bent.
 *
 * De sub-pagina's dragen zelf geen eigen PageHeader meer — hun titel staat op
 * het mapje.
 */
export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Hoe staat Q4S ervoor — omzet, marge, recruitment en dossiers, uitgesplitst per onderwerp."
      />

      <DossierTabs
        base="/dashboard"
        label="Analytics"
        tabs={[
          { seg: "", label: "Overzicht", icon: <LayoutDashboard className="h-4 w-4" /> },
          { seg: "te-doen", label: "Te doen", icon: <ListTodo className="h-4 w-4" /> },
          { seg: "facturatie", label: "Facturatie", icon: <PieChart className="h-4 w-4" /> },
          { seg: "recruitment", label: "Recruitment", icon: <Sparkles className="h-4 w-4" /> },
          { seg: "plaatsingen", label: "Plaatsingen & marges", icon: <Briefcase className="h-4 w-4" /> },
          { seg: "evaluaties", label: "Evaluaties", icon: <ClipboardCheck className="h-4 w-4" /> },
          { seg: "rapportage", label: "Rapportage", icon: <BarChart3 className="h-4 w-4" /> },
          { seg: "automatisering", label: "Automatisering", icon: <Zap className="h-4 w-4" /> },
        ]}
      />

      {children}
    </div>
  );
}
