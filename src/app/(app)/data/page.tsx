import {
  HardHat,
  FolderOpen,
  HardDrive,
  BarChart3,
  Target,
} from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { HubCard } from "@/components/ui/hub-card";

export const metadata = { title: "Data & Mappen" };

/** Human-readable file size. */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default async function DataPage() {
  const [consultants, docAgg, certCount, opportunities] = await Promise.all([
    db.consultant.count(),
    db.document.aggregate({ _count: true, _sum: { size: true } }),
    db.certificate.count(),
    db.opportunity.count(),
  ]);

  const docCount = docAgg._count;
  const docBytes = docAgg._sum.size ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data & Mappen"
        description="Alle dossiers, documenten en analyses op één plek: personeelsdossiers, bestanden, certificaten en marktdata."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Werknemers" value={consultants} icon={<HardHat className="h-5 w-5" />} accent="brand" />
        <StatCard label="Documenten" value={docCount} sub={`${certCount} certificaten`} icon={<FolderOpen className="h-5 w-5" />} accent="violet" />
        <StatCard label="Opslag in gebruik" value={fileSize(docBytes)} icon={<HardDrive className="h-5 w-5" />} accent="slate" />
        <StatCard label="Marktkansen" value={opportunities} icon={<Target className="h-5 w-5" />} accent="green" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <HubCard
          icon={<HardHat className="h-6 w-6" />}
          title="Werknemers"
          description="De volledige personeelsdossiers van de gedetacheerde specialisten: gegevens, contracten, certificaten en documenten."
          href="/werknemers"
          cta="Naar werknemers"
          newHref="/werknemers/nieuw"
        />
        <HubCard
          icon={<FolderOpen className="h-6 w-6" />}
          title="Documenten"
          description="Alle geüploade bestanden over alle dossiers heen, geordend in mappen per soort: contracten, ID's, certificaten en CV's."
          href="/documenten"
          cta="Naar documenten"
        />
        <HubCard
          icon={<BarChart3 className="h-6 w-6" />}
          title="Analyses"
          description="Inzichten en cijfers over omzet, marges en de pijplijn — de data achter de business."
          href="/analyses"
          cta="Naar analyses"
        />
        <HubCard
          icon={<Target className="h-6 w-6" />}
          title="Marktkansen"
          description="Sector- en marktkansen voor Q4S, als pijplijn bijgehouden van verkennen tot gewonnen."
          href="/marktkansen"
          cta="Naar marktkansen"
          newHref="/marktkansen/nieuw"
        />
      </div>
    </div>
  );
}
