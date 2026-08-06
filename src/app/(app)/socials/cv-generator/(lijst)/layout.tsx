import Link from "next/link";
import { Upload, Users } from "lucide-react";
import { db } from "@/lib/db";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { DossierTabs } from "@/components/dossier-tabs";
import { isVisionConfigured, readyPersonalDataTextProvider } from "@/lib/ai";

/**
 * De twee manieren om aan een Q4S-CV te komen, als mapjes boven de generator.
 *
 * Ze staan hier en niet in de pagina's zelf omdat de kop, de mapjes en de
 * AI-waarschuwing voor allebei gelden — en omdat het review-scherm
 * (`/socials/cv-generator/[id]`) ze juist NIET moet krijgen. Dat scherm valt
 * buiten deze routegroep.
 */

export const dynamic = "force-dynamic";

export default async function CvGeneratorLayout({ children }: { children: React.ReactNode }) {
  // Alleen kandidaten met een CV in hun dossier zijn hier bruikbaar; dat aantal
  // op het mapje zetten scheelt een klik om te zien of er iets te halen valt.
  const metCv = await db.candidate.count({ where: { cvFileName: { not: null } } });

  const visionOk = isVisionConfigured();
  // Word-CV's mogen alleen naar een AVG-veilige provider (Anthropic/Ollama), nooit
  // DeepSeek — dus die check bepaalt of tekst-CV's uitgelezen kunnen worden.
  const textOk = readyPersonalDataTextProvider() !== null;

  return (
    <div className="space-y-6">
      <BackLink href="/cv">Terug naar CV&apos;s</BackLink>

      <PageHeader
        title="CV-generator"
        description="Zet een oud CV om naar een Q4S-CV met ons logo — klaar om naar een opdrachtgever te sturen."
      />

      {!visionOk && !textOk && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Er is nog geen AI-sleutel ingesteld, dus CV&apos;s kunnen niet uitgelezen worden. Zet er
          een in bij{" "}
          <Link href="/instellingen" className="font-medium underline">
            Instellingen
          </Link>
          .
        </p>
      )}
      {!visionOk && textOk && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Zonder Gemini- of Anthropic-sleutel kunnen alleen Word-bestanden (.docx) uitgelezen
          worden — PDF&apos;s hebben vision nodig. Stel er een in bij{" "}
          <Link href="/instellingen" className="font-medium underline">
            Instellingen
          </Link>
          .
        </p>
      )}

      <DossierTabs
        base="/socials/cv-generator"
        label="CV-generator"
        tabs={[
          { seg: "", label: "Uit een bestand", icon: <Upload className="h-4 w-4" /> },
          {
            seg: "kandidaten",
            label: "Kandidaten",
            icon: <Users className="h-4 w-4" />,
            count: metCv,
          },
        ]}
      />

      {children}
    </div>
  );
}
