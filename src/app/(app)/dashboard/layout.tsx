import { PageHeader } from "@/components/ui/page-header";

/** De Analytics-hub: één vaste kop; de deelrapportages staan in het zijmenu. */
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

      {children}
    </div>
  );
}
