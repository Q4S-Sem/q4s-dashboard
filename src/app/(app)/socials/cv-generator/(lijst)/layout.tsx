import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { isVisionConfigured, readyPersonalDataTextProvider } from "@/lib/ai";

/**
 * Kop + AI-waarschuwing van de generator. Het review-scherm
 * (`/socials/cv-generator/[id]`) krijgt ze juist NIET: dat scherm valt
 * buiten deze routegroep.
 */

export const dynamic = "force-dynamic";

export default async function CvGeneratorLayout({ children }: { children: React.ReactNode }) {
  const visionOk = isVisionConfigured();
  // Word-CV's mogen alleen naar een AVG-veilige provider (Anthropic/Ollama), nooit
  // DeepSeek — dus die check bepaalt of tekst-CV's uitgelezen kunnen worden.
  const textOk = readyPersonalDataTextProvider() !== null;

  return (
    <div className="space-y-6">
      <BackLink href="/cv">Terug naar CV&apos;s</BackLink>

      <PageHeader
        title="CV-generator"
        description="Kies een kandidaat of zet zelf een CV erin. Daarna kom je op het bewerkscherm om alles na te lopen en aan te vullen."
      />

      {!visionOk && !textOk && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Er is nog geen AI-sleutel ingesteld, dus CV&apos;s kunnen niet uitgelezen worden. Zet er
          een in bij{" "}
          <Link href="/facturatie/instellingen" className="font-medium underline">
            Instellingen
          </Link>
          .
        </p>
      )}
      {!visionOk && textOk && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Zonder Gemini- of Anthropic-sleutel kunnen alleen Word-bestanden (.docx) uitgelezen
          worden — PDF&apos;s hebben vision nodig. Stel er een in bij{" "}
          <Link href="/facturatie/instellingen" className="font-medium underline">
            Instellingen
          </Link>
          .
        </p>
      )}

      {children}
    </div>
  );
}
