import Link from "next/link";
import { CalendarDays, Wallet } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { ensureAiKeysLoaded } from "@/lib/ai-keys";
import { parseWeekNumber } from "@/lib/invoice-extract";
import {
  bouwGereedPerPlaatsing,
  verwerkteWekenPerPlaatsing,
} from "@/lib/urenstaat-gereed";
import {
  recenteWeken,
  weekNummerUitTekst,
  STROOK_WEKEN,
} from "@/lib/week-koppeling";
import { dedupeTimesheetsPerPersonWeek } from "@/lib/wizard-dubbelen";
import { bouwWeekKeuzes, standaardWeek } from "@/lib/wizard-weekfilter";
import { WeekWizard } from "./WeekWizard";
import {
  getypteWeekVeld,
  naarWizardTimesheet,
  type WizardPlaatsing,
  type WizardWeekkeuze,
  type WizardWeekstrook,
} from "./wizard-data";

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

  // De weekstrook kijkt tien weken terug t/m de lopende week. "Nu" wordt hier
  // (server) bepaald en als platte weeksleutels doorgegeven, zodat het scherm er
  // geen eigen datum voor nodig heeft.
  const weken = recenteWeken(new Date(), STROOK_WEKEN);
  const eersteMaandag = new Date(`${weken[0].monday}T00:00:00`);

  const [items, placements, verwerkteStaten] = await Promise.all([
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
    // Wat er per plaatsing al VERWERKT is: een goedgekeurde urenstaat. INVOICED
    // telt mee — dat is een goedgekeurde staat waar de verkoopfactuur al uit
    // gemaakt is, dus zeker niet "ontbreekt". Het id komt mee: daarmee kan het
    // scherm vóór het akkoord naar de urenstaat linken die er al gereed staat.
    db.timesheet.findMany({
      where: { status: { in: ["APPROVED", "INVOICED"] }, weekStart: { gte: eersteMaandag } },
      select: { id: true, placementId: true, weekStart: true },
    }),
  ]);

  // Eén opzoeklijst voor allebei: de weekstrook wil alleen wéten welke weken
  // verwerkt zijn, de melding "er staat al een urenstaat gereed" wil er ook
  // naartoe kunnen linken. Puur en getest — src/lib/urenstaat-gereed.ts.
  const gereedPerPlaatsing = bouwGereedPerPlaatsing(verwerkteStaten);
  const weekstrook: WizardWeekstrook = {
    weken,
    verwerktPerPlaatsing: verwerkteWekenPerPlaatsing(gereedPerPlaatsing),
    gereedPerPlaatsing,
  };

  // De openstaande weekstaten in de vorm die het scherm toont. Ook de weekfilter
  // hieronder telt hierop door, zodat "3 open in week 35" precies over dezelfde
  // staten gaat als de lijst zelf.
  const alleItems = items.map((item) =>
    naarWizardTimesheet(
      item,
      // Wat er op de stukken getypt staat — puur om een afwijking te kunnen
      // melden; de week zelf volgt uit de gewerkte dagen.
      parseWeekNumber(getypteWeekVeld(item)) ?? weekNummerUitTekst(item.originalName),
    ),
  );

  // Dezelfde persoon-week hoort ÉÉN keer in de wizard te staan; is een urenstaat
  // twee keer aangeleverd, dan blijft de uitgelezen/nieuwste staan en gaat de
  // rest als "verborgen dubbele" mee naar het scherm. HIER, op de server, zodat
  // de personenkaarten, de weekfilter én stap 1 allemaal dezelfde (ontdubbelde)
  // lijst tellen — een dubbele upload maakt "2 weken te verwerken" dus niet meer
  // van één week. Verwijderen doet de mens zelf; zie de melding in stap 1.
  const ontdubbeld = dedupeTimesheetsPerPersonWeek(alleItems);
  const wizardItems = ontdubbeld.items;

  // De weekfilter boven de personenlijst: dezelfde weken als de strook (plus een
  // oudere week waar nog iets van openstaat), en de week waar de eigenaar
  // standaard begint. Server-side bepaald, net als de strook — het scherm heeft
  // dus geen eigen datum nodig.
  const keuzeWeken = bouwWeekKeuzes({ weken, weekstaten: wizardItems });
  const weekkeuze: WizardWeekkeuze = {
    weken: keuzeWeken,
    huidig: weken[weken.length - 1]?.key ?? "",
    standaard: standaardWeek(keuzeWeken),
  };

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
      overtimeCostRate: p.overtimeCostRate,
      overtimeChargeRate: p.overtimeChargeRate,
      kmRateBuy: p.kmRateBuy,
      kmRateSell: p.kmRateSell,
    },
  }));

  return (
    // Volle werkbreedte — zoals /verwerken en de andere overzichtsschermen: geen
    // eigen max-w, de AppShell levert de paginamarge (px-4 sm:px-6 lg:px-8) al.
    // De wizard zet het document náást de uitgelezen velden; in de smalle kolom
    // van een formulierpagina (max-w-4xl) hield geen van beide genoeg ruimte over.
    <div className="space-y-6">
      <BackLink href="/verwerken">Terug naar facturatie</BackLink>

      <PageHeader
        eyebrow="Facturatie"
        title="Week verwerken"
        description="Kies eerst de persoon, dan zijn week — daarna in drie stappen door de hele facturatie. Jij hoeft alleen te controleren."
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
        items={wizardItems}
        dubbelen={ontdubbeld.dubbelen}
        plaatsingen={plaatsingen}
        weekstrook={weekstrook}
        weekkeuze={weekkeuze}
        aiKlaar={isAIConfigured() || isVisionConfigured()}
      />
    </div>
  );
}
