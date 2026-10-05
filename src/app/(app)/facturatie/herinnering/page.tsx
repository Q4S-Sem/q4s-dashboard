import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { emailLogoDataUri, renderQ4sEmail } from "@/lib/email";
import { resolveWeek } from "@/lib/facturatie-week";
import { getCompanySettings } from "@/lib/settings";
import { HERINNERING_AFZENDER, herinneringMail } from "@/lib/timesheet-herinnering";

export const metadata = { title: "Voorbeeld herinnering" };
export const dynamic = "force-dynamic";

/** Precies de mail die een freelancer krijgt als hij na de deadline niets stuurde. */
export default async function HerinneringVoorbeeld() {
  const now = new Date();
  const vorige = new Date(now);
  vorige.setDate(vorige.getDate() - 7);
  const week = resolveWeek(null, vorige);
  const { subject, content } = herinneringMail(
    { voornaam: "Jordy", isoWeek: week.isoWeek, bereik: week.bereik, isZZP: true },
    await getCompanySettings(),
  );
  const html = renderQ4sEmail(content, { logoSrc: emailLogoDataUri() ?? undefined });

  return (
    <div className="space-y-6">
      <BackLink href="/facturatie">Terug naar week verwerken</BackLink>
      <PageHeader title="Voorbeeld herinnering" description="Zo ziet de automatische mail eruit (voorbeeldnaam Jordy, ZZP)." />
      <Card className="overflow-hidden">
        <dl className="grid gap-x-6 gap-y-1 border-b border-ink-100 px-5 py-3 text-[13px] sm:grid-cols-[6rem_1fr]">
          <dt className="text-ink-400">Van</dt>
          <dd className="text-ink-900">{HERINNERING_AFZENDER}</dd>
          <dt className="text-ink-400">Onderwerp</dt>
          <dd className="font-medium text-ink-900">{subject}</dd>
        </dl>
        <iframe title="Voorbeeld" srcDoc={html} className="h-[720px] w-full bg-white" />
      </Card>
    </div>
  );
}
