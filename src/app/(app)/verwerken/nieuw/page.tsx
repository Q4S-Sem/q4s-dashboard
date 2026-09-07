import Link from "next/link";
import { CalendarDays, Wallet } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { ensureAiKeysLoaded } from "@/lib/ai-keys";
import { WeekWizard } from "./WeekWizard";
import { naarWizardTimesheet, type WizardPlaatsing } from "./wizard-data";

// ---------------------------------------------------------------------------
// "Week verwerken" — de begeleide route door de facturatie, per persoon per week.
//
// Deze pagina LEEST alleen: de openstaande weekstaten uit de timesheet-inbox en
// de actieve plaatsingen met hun tarieven/toeslagen. Al het schuiven, corrigeren
// en akkoord geven gebeurt in het client-scherm (WeekWizard) en de drie
// server-actions in ./actions.ts.
//
// De oude schermen (/verwerken/week, /verwerken/controle, /ontvangen-facturen,
// …) blijven gewoon bestaan; dit is de nieuwe voordeur, niet hun vervanging.
// ---------------------------------------------------------------------------

export const metadata = { title: "Week verwerken" };
export const dynamic = "force-dynamic";

export default async function WeekVerwerkenPage() {
  // Serverless: de AI-sleutels staan in de DB — laden vóór we melden of er AI is.
  await ensureAiKeysLoaded();

  const [items, placements] = await Promise.all([
    // Wat nog écht openstaat: uitgelezen of nog te lezen, nog geen urenstaat en
    // niet geparkeerd in de wachtkamer.
    db.timesheetInbox.findMany({
      where: { status: { in: ["NEW", "EXTRACTED"] }, timesheetId: null, wachtkamerSince: null },
      include: { consultant: { select: { firstName: true, lastName: true } } },
      orderBy: [{ extractedWeekStart: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    db.placement.findMany({
      where: { status: "ACTIVE" },
      include: {
        consultant: { select: { firstName: true, lastName: true } },
        client: { select: { companyName: true } },
      },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const plaatsingen: WizardPlaatsing[] = placements.map((p) => ({
    id: p.id,
    consultantId: p.consultantId,
    consultantNaam: `${p.consultant.firstName} ${p.consultant.lastName}`,
    klantId: p.clientId,
    klantNaam: p.client?.companyName ?? null,
    functie: p.title,
    config: {
      costRate: p.costRate,
      chargeRate: p.chargeRate,
      weekendSurchargeBuy: p.weekendSurchargeBuy,
      weekendSurchargeSell: p.weekendSurchargeSell,
      overtimeSurchargeBuy: p.overtimeSurchargeBuy,
      overtimeSurchargeSell: p.overtimeSurchargeSell,
      kmRateBuy: p.kmRateBuy,
      kmRateSell: p.kmRateSell,
    },
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink href="/verwerken">Terug naar facturatie</BackLink>

      <PageHeader
        eyebrow="Facturatie"
        title="Week verwerken"
        description="Eén persoon, één week — in drie stappen door de hele facturatie. Jij hoeft alleen te controleren."
        actions={
          <>
            <Link href="/verwerken/week" className={buttonVariants({ variant: "outline" })}>
              <CalendarDays className="h-4 w-4" /> Weekoverzicht
            </Link>
            <Link href="/ontvangen-facturen" className={buttonVariants({ variant: "outline" })}>
              <Wallet className="h-4 w-4" /> Ontvangen facturen
            </Link>
          </>
        }
      />

      <WeekWizard
        items={items.map(naarWizardTimesheet)}
        plaatsingen={plaatsingen}
        aiKlaar={isAIConfigured() || isVisionConfigured()}
      />
    </div>
  );
}
