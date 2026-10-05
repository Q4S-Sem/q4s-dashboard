import Link from "next/link";
import { CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoicePreview } from "@/components/invoice-preview";
import { getCompanySettings } from "@/lib/settings";
import { ZZP_PAYMENT_TERM_DAYS } from "@/lib/betalingen";
import {
  DAG_UREN_NORM,
  DEADLINE_LABEL,
  STANDAARD_BTW_PCT,
  TOLERANTIE_AANTAL,
  TOLERANTIE_EUR,
  WEEK_UREN_NORM,
} from "@/lib/facturatie-checks";
import { formatCurrency, formatHours } from "@/lib/utils";
import { SettingsForm } from "./SettingsForm";
import { updateSettings, wisTestdata } from "./actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { isAdminSession } from "@/lib/session";
import { facturatieTellingen } from "@/lib/facturatie-wissen";

// ---------------------------------------------------------------------------
// INSTELLINGEN & REGELS — twee dingen bij elkaar:
//   1. de bedrijfsgegevens die LETTERLIJK op elke verkoopfactuur komen (staan
//      standaard op slot; het voorbeeld ernaast toont meteen het resultaat);
//   2. de controleregels waarop Week verwerken een week groen of rood zet, zodat
//      niemand hoeft te raden wát er precies gecontroleerd wordt.
//
// De controleregels staan hier ALLEEN-LEZEN. Ze zitten als vaste waarden in de
// pure controle-machine (src/lib/facturatie-checks.ts) — dat is bewust: ze
// worden door de hele keten gebruikt (overzicht, dossier, akkoord) en een
// verstelbare drempel zou dezelfde week vandaag groen en morgen rood maken
// zonder dat er iets aan die week veranderde. Wil je ze wijzigen, dan is dat één
// aanpassing in die machine, met de tests ernaast.
// ---------------------------------------------------------------------------

export const metadata = { title: "Instellingen & regels" };
export const dynamic = "force-dynamic";

function Regel({ label, value, uitleg }: { label: string; value: string; uitleg: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink-100 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink-900">{label}</p>
        <p className="text-xs text-ink-500">{uitleg}</p>
      </div>
      <p className="shrink-0 text-[13px] font-semibold tabular-nums text-ink-900">{value}</p>
    </div>
  );
}

export default async function FacturatieInstellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ opgeslagen?: string; gewist?: string }>;
}) {
  const { opgeslagen, gewist } = await searchParams;
  const settings = await getCompanySettings();
  const admin = await isAdminSession();
  const tel = admin ? await facturatieTellingen() : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facturatie"
        title="Instellingen & regels"
        description="De gegevens die op elke factuur komen, en de controles waarop een week groen of rood wordt."
      />

      {opgeslagen === "1" && (
        <p className="flex items-start gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> De instellingen zijn opgeslagen en
          gelden meteen voor nieuwe facturen.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <SettingsForm settings={settings} action={updateSettings} />
        <InvoicePreview className="lg:sticky lg:top-24" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-ink-400" /> Controleregels
          </CardTitle>
          <span className="text-xs text-ink-400">
            waar Week verwerken een week op afrekent — alleen-lezen
          </span>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-10 sm:grid-cols-2">
            <Regel
              label="Inleverdeadline"
              value={DEADLINE_LABEL}
              uitleg="Urenstaat + factuur binnen vóór dit moment, de maandag ná de gewerkte week. Daarna telt de week als 'niet ingeleverd'."
            />
            <Regel
              label="Bedrag-tolerantie"
              value={formatCurrency(TOLERANTIE_EUR)}
              uitleg="Afrondingsverschillen mogen door; een heel uur (minstens ± €30) valt er altijd buiten en wordt als fout gemeld."
            />
            <Regel
              label="Uren-/aantallen-tolerantie"
              value={formatHours(TOLERANTIE_AANTAL)}
              uitleg="Uren, overuren en kilometers worden op honderdsten vergeleken tussen urenstaat en factuur."
            />
            <Regel
              label="Normale dag"
              value={`${formatHours(DAG_UREN_NORM)} uur`}
              uitleg="Staat er meer op één dag, dan hoort er overwerk opgegeven te zijn."
            />
            <Regel
              label="Normale week"
              value={`${formatHours(WEEK_UREN_NORM)} uur`}
              uitleg="Idem voor de hele week — meer uren zonder overuren is een signaal, geen blokkade."
            />
            <Regel
              label="Standaard btw op een ZZP-factuur"
              value={`${STANDAARD_BTW_PCT}%`}
              uitleg="Wijkt het percentage af zonder dat 'btw verlegd' is afgesproken, dan komt er een melding."
            />
            <Regel
              label="Betaaltermijn naar freelancers"
              value={`${ZZP_PAYMENT_TERM_DAYS} dagen`}
              uitleg="De uitvoerdatum in het SEPA-bestand = factuurdatum + dit aantal dagen."
            />
            <Regel
              label="Ander IBAN dan geregistreerd"
              value="altijd een fout"
              uitleg="Staat er een afwijkend rekeningnummer op de factuur, dan blokkeert dat de week — eerst telefonisch verifiëren."
            />
          </dl>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-sm border border-ink-200 bg-ink-50 px-4 py-3 text-[13px] text-ink-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <p>
          De volledige uitslag per week — welke van de controles slaagden en welke niet — staat in
          het dossier van die persoon, bereikbaar vanaf{" "}
          <Link href="/facturatie" className="font-semibold underline underline-offset-2">
            Week verwerken
          </Link>
          . Toegang, gebruikers en AI-sleutels staan onder{" "}
          <Link href="/gebruikers" className="font-semibold underline underline-offset-2">
            Instellingen
          </Link>
          .
        </p>
      </div>
      {tel && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Testdata wissen</CardTitle>
            <span className="text-xs text-ink-400">alleen beheerder</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {gewist && (
              <p className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                Alles is gewist. Je kunt opnieuw beginnen.
              </p>
            )}
            <p className="text-[13px] text-ink-600">
              Wist alle facturen en urenstaten, zodat je opnieuw kunt testen. Klanten, personen, plaatsingen en contracten
              blijven staan. De factuurnummering begint opnieuw. Niet terug te draaien.
            </p>
            <div className="grid grid-cols-2 gap-x-6 text-[13px] sm:grid-cols-3">
              {[
                ["Verkoopfacturen", tel.verkoop],
                ["… waarvan verstuurd/betaald", tel.verstuurd],
                ["Ontvangen ZZP-facturen", tel.ontvangen],
                ["Oude inkoopfacturen", tel.inkoop],
                ["Urenstaten", tel.urenstaten],
                ["Scans", tel.scans],
                ["Losse uploads", tel.los],
                ["Herinneringen", tel.herinneringen],
                ["Akkoorden/notities", tel.akkoorden],
              ].map(([l, n]) => (
                <div key={l as string} className="flex justify-between border-b border-ink-100 py-1.5">
                  <span className="text-ink-500">{l}</span>
                  <span className="font-semibold tabular-nums text-ink-900">{n}</span>
                </div>
              ))}
            </div>
            <ConfirmSubmit
              action={wisTestdata}
              trigger="button"
              variant="outline"
              size="sm"
              confirmVariant="danger"
              confirmLabel="Alles wissen"
              message="Alle facturen en urenstaten wissen?"
              description={`${tel.verkoop} verkoopfacturen (${tel.verstuurd} verstuurd/betaald), ${tel.ontvangen} ZZP-facturen, ${tel.urenstaten} urenstaten en ${tel.scans} scans verdwijnen definitief.`}
            >
              Alles wissen…
            </ConfirmSubmit>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
