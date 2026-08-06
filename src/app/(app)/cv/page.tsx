import { Inbox, Target, FileUser, FileText, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { HubCard } from "@/components/ui/hub-card";

export const metadata = { title: "CV's" };
export const dynamic = "force-dynamic";

/**
 * De CV-werkplek: alles rond binnengekomen CV's op één plek, net als de
 * Vacatures-hub. De onderliggende pagina's blijven op hun eigen route staan —
 * dit is de ingang die ze bij elkaar brengt.
 */
export default async function CvHubPage() {
  const weekGeleden = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [metCv, nieuw, matches, gegenereerd] = await Promise.all([
    db.candidate.count({ where: { cvFileName: { not: null } } }),
    db.candidate.count({
      where: { cvFileName: { not: null }, createdAt: { gte: weekGeleden } },
    }),
    db.vacancyMatch.count(),
    db.cvProfile.count(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CV's"
        description="Alles rond binnengekomen CV's: van de inbox naar een match, en van een ruw CV naar een opgemaakt Q4S-CV."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="CV's in de database"
          value={metCv}
          icon={<FileText className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Nieuw deze week"
          value={nieuw}
          sub="laatste 7 dagen"
          icon={<Inbox className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Match-voorstellen"
          value={matches}
          sub="CV gekoppeld aan een vacature"
          icon={<Target className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="Q4S-CV's gemaakt"
          value={gegenereerd}
          sub="via de generator"
          icon={<Sparkles className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <HubCard
          icon={<Inbox className="h-6 w-6" />}
          title="Binnengekomen CV's"
          description="Elk CV vanaf de website en uit de cv@q4s.nl-mailbox. Filter op discipline of beschikbaarheid en zet een interessante kandidaat met één klik als lead in de CRM-pijplijn."
          href="/website/cv-inbox"
          cta="Naar de inbox"
          newHref="/website/cv-inbox/importeren"
        />
        <HubCard
          icon={<Target className="h-6 w-6" />}
          title="CV-matches"
          description="Welke binnengekomen CV's passen bij welke openstaande vacature — met de reden erbij, zodat je meteen weet wie je belt."
          href="/website/cv-inbox/matches"
          cta="Naar de matches"
        />
        <HubCard
          icon={<FileUser className="h-6 w-6" />}
          title="CV-generator"
          description="Zet een aangeleverd CV om naar het Q4S-format, standaard geanonimiseerd, klaar om als PDF of Word naar een opdrachtgever te sturen."
          href="/socials/cv-generator"
          cta="Naar de generator"
        />
      </div>
    </div>
  );
}
