import Link from "next/link";
import { ArrowLeft, Archive } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { archivedBillingByWeek } from "@/lib/facturatie";
import { ArchiveBrowser } from "./ArchiveBrowser";

export const metadata = { title: "Facturatie-archief" };
export const dynamic = "force-dynamic";

export default async function FacturatieArchiefPage() {
  const weeks = await archivedBillingByWeek();
  const data = weeks.map((w) => ({ key: w.key, weekLabel: w.weekLabel, hours: w.hours, rows: w.rows }));

  return (
    <div className="space-y-6">
      <Link href="/verwerken" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar verwerken
      </Link>

      <PageHeader
        title="Facturatie-archief"
        description="Volledig verwerkte medewerker-weken (inkoop- én verkoopfactuur klaar), per week gesorteerd. Zo blijven de vorige flows schoon. Klopt er iets niet? Open de factuur en pas hem aan — het factuurnummer blijft behouden."
      />

      {data.length === 0 ? (
        <EmptyState
          icon={<Archive className="h-6 w-6" />}
          title="Nog niets gearchiveerd"
          description="Zodra een medewerker-week volledig is verwerkt (inkoop- én verkoopfactuur), verschijnt hij hier — per week."
        />
      ) : (
        <ArchiveBrowser weeks={data} />
      )}
    </div>
  );
}
