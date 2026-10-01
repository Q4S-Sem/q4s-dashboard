import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Mail,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { getWeekDossier } from "@/lib/facturatie-week";
import type { Check as Controle, CheckGroup } from "@/lib/facturatie-checks";
import { cn, formatCurrency, formatDate, formatHours } from "@/lib/utils";
import { CorrectieFormulier } from "./CorrectieFormulier";
import { DossierDocument } from "./DossierDocument";
import {
  accepteerFouten,
  akkoordControle,
  akkoordNaarVerkoopfactuur,
  naarWachtkamer,
  trekAcceptatieIn,
  uitWachtkamer,
  verwijderEnOpnieuw,
} from "./actions";

// ---------------------------------------------------------------------------
// HET DOSSIER van één persoon in één week: links het document, rechts de
// vergelijking en de controles, onderaan de knoppen.
//
// Volledige breedte en een echte twee-kolomsindeling (die op mobiel netjes
// stapelt) — het hele punt is dat het bewijsstuk NAAST de getallen staat.
//
// ALLEEN LEZEN: alles komt uit getWeekDossier, dat de pure controle-machine
// (src/lib/facturatie-checks.ts) draait. De knoppen onderaan zijn de enige
// plekken waar iets verandert, en elk daarvan is een expliciete handeling van
// een mens. Er wordt niets gemaild, niets verstuurd en niets betaald.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ placementId: string; week: string }>;
}) {
  const { placementId, week } = await params;
  const dossier = await getWeekDossier(placementId, week);
  return { title: dossier ? `${dossier.row.naam} · ${dossier.week.label}` : "Dossier" };
}

const GROEP_LABEL: Record<CheckGroup, string> = {
  timesheet: "Timesheet",
  factuur: "Factuur",
  match: "Koppeling",
  contract: "Contract",
  fraude: "Fraude-alert",
};

const GROEP_ORDE: CheckGroup[] = ["timesheet", "factuur", "match", "contract", "fraude"];

/** Het vierkante icoontje vóór een controle: groen vinkje, oranje !, rood ×. */
function ControleIcoon({ level, akkoord }: { level: Controle["level"]; akkoord: boolean }) {
  const groen = level === "ok" || (level === "warn" && akkoord);
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm text-[11px] font-bold text-white",
        groen ? "bg-emerald-600" : level === "warn" ? "bg-amber-500" : "bg-red-600",
      )}
    >
      {groen ? "✓" : level === "warn" ? "!" : "×"}
    </span>
  );
}

export default async function DossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ placementId: string; week: string }>;
  searchParams: Promise<{
    geblokkeerd?: string;
    geaccepteerd?: string;
    wachtkamer?: string;
    vastgelegd?: string;
    fout?: string;
  }>;
}) {
  const { placementId, week } = await params;
  const sp = await searchParams;
  const dossier = await getWeekDossier(placementId, week);
  if (!dossier) notFound();

  const { row, checks, comparison, akkoorden, accepteerReden, geld } = dossier;
  const akkoordSet = new Set(akkoorden);
  const fouten = checks.filter((c) => c.level === "error");
  const openWaarschuwingen = checks.filter(
    (c) => c.level === "warn" && !akkoordSet.has(c.id),
  );
  const magAkkoord = dossier.akkoordGeblokkeerd === null;

  const groepen = GROEP_ORDE.map((groep) => {
    const eigen = checks.filter((c) => c.group === groep);
    return {
      groep,
      checks: eigen,
      goed: eigen.filter((c) => c.level === "ok" || (c.level === "warn" && akkoordSet.has(c.id)))
        .length,
    };
  }).filter((g) => g.checks.length > 0);

  return (
    <div className="space-y-5">
      <BackLink href={`/facturatie?week=${dossier.week.mondayParam}`}>Terug naar de week</BackLink>

      <PageHeader
        eyebrow={`${dossier.week.label} · ${dossier.week.bereik}`}
        title={row.naam}
        description={
          [row.klantNaam, row.locatie].filter(Boolean).join(" · ") || "geen klant gekoppeld"
        }
        leading={<PersoonVierkant naam={row.naam} className="h-11 w-11 text-sm" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={row.isZZP ? "slate" : "blue"}>{row.isZZP ? "ZZP" : "In dienst"}</Badge>
            {row.gefactureerd ? (
              <Badge color="violet">Gefactureerd</Badge>
            ) : fouten.length > 0 ? (
              <Badge color="red">
                {fouten.length === 1 ? "1 afwijking" : `${fouten.length} afwijkingen`}
              </Badge>
            ) : row.status === "WACHT" ? (
              <Badge color="amber">Wacht op factuur</Badge>
            ) : row.status === "NIET_INGELEVERD" ? (
              <Badge color="slate">Niets ingeleverd</Badge>
            ) : (
              <Badge color="green">Klaar</Badge>
            )}
            {row.wachtkamerSinds && (
              <Badge color="amber">Wachtkamer sinds {formatDate(row.wachtkamerSinds)}</Badge>
            )}
          </div>
        }
      />

      {/* Meldingen van de vorige handeling — feitelijk, nooit geraden. */}
      {sp.geblokkeerd && (
        <p className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {sp.geblokkeerd === "1" ? "Deze week kon niet vastgelegd worden." : sp.geblokkeerd}
        </p>
      )}
      {sp.fout === "reden" && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          Vul een reden in — zonder reden worden de fouten niet geaccepteerd.
        </p>
      )}
      {sp.fout === "reset" && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Er was niets te verwijderen voor deze week.
        </p>
      )}
      {sp.vastgelegd && (
        <p className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          De week is vastgelegd. Er is geen verkoopfactuur gemaakt — controleer of de plaatsing een
          klant heeft.
        </p>
      )}
      {sp.wachtkamer && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          De week staat in de wachtkamer en is van het weekoverzicht verdwenen tot je hem terugzet.
        </p>
      )}
      {row.gefactureerd && row.verkoopFactuurId && (
        <p className="flex flex-wrap items-center gap-2 rounded-sm border border-violet-200 bg-violet-50 px-3 py-2 text-[13px] text-violet-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Deze week staat al op verkoopfactuur {row.verkoopFactuurNummer} — er wordt niets dubbel
          gefactureerd.
          <Link
            href={`/facturatie/verkoop/${row.verkoopFactuurId}`}
            className="font-semibold underline underline-offset-2"
          >
            Open de factuur
          </Link>
        </p>
      )}

      {/* document | controles — twee kolommen, stapelt op smalle schermen */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <DossierDocument
            weekLabel={`wk ${dossier.week.isoWeek}`}
            factuurNummer={dossier.invoer.factuurNummer || null}
            timesheet={dossier.timesheetDoc}
            factuur={dossier.factuurDoc}
            mail={
              dossier.mail
                ? {
                    sender: dossier.mail.sender,
                    subject: dossier.mail.subject,
                    receivedAtLabel: dossier.mail.receivedAt
                      ? formatDate(dossier.mail.receivedAt)
                      : null,
                    notes: dossier.mail.notes,
                  }
                : null
            }
          />
        </Card>

        <div className="space-y-4">
          {/* De vergelijkingstabel: staat ↔ factuur ↔ contract */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Urenstaat tegenover factuur</CardTitle>
              <span className="text-xs text-ink-400">rode cel = wijkt af</span>
            </CardHeader>
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="border-b border-ink-200 bg-ink-50/50 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Onderdeel</th>
                    <th className="px-4 py-2 text-right font-semibold">Urenstaat</th>
                    <th className="px-4 py-2 text-right font-semibold">Factuur</th>
                    <th className="px-4 py-2 text-right font-semibold">Contract</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {comparison.map((rij) => (
                    <tr key={rij.key}>
                      <td className="px-4 py-2 text-ink-700">{rij.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-ink-700">
                        {rij.timesheet ?? <span className="text-ink-300">—</span>}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right tabular-nums",
                          rij.ok ? "text-ink-700" : "bg-red-50 font-semibold text-red-700",
                        )}
                      >
                        {rij.invoice ?? <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-ink-500">
                        {rij.contract ?? <span className="text-ink-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {geld && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-ink-100 bg-ink-50/60 px-4 py-3 text-[13px] sm:grid-cols-4">
                <Cijfer label="Uren" waarde={formatHours(geld.uren)} />
                <Cijfer label="Verkoop (klant)" waarde={formatCurrency(geld.verkoop)} />
                <Cijfer label="Inkoop (freelancer)" waarde={formatCurrency(geld.inkoop)} />
                <Cijfer
                  label="Marge"
                  waarde={formatCurrency(geld.marge)}
                  kleur={geld.marge > 0 ? "text-emerald-700" : "text-red-700"}
                />
              </div>
            )}
          </Card>

          {/* De controles, per groep */}
          <Card className="overflow-hidden">
            {groepen.map(({ groep, checks: eigen, goed }) => (
              <div key={groep} className="border-b border-ink-100 px-4 py-3 last:border-b-0">
                <h4 className="mb-2 flex items-center justify-between gap-3 text-[13px] font-semibold text-ink-900">
                  {GROEP_LABEL[groep]}
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums",
                      goed === eigen.length ? "text-emerald-600" : "text-ink-400",
                    )}
                  >
                    {goed}/{eigen.length}
                  </span>
                </h4>
                <ul className="space-y-1.5">
                  {eigen.map((c) => {
                    const akkoord = akkoordSet.has(c.id);
                    return (
                      <li key={c.id} className="flex items-start gap-2.5">
                        <ControleIcoon level={c.level} akkoord={akkoord} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-ink-800">
                            {c.title}
                          </span>
                          <span className="block text-xs leading-snug text-ink-500">
                            {c.detail}
                          </span>
                          {akkoord && (
                            <span className="mt-0.5 block text-xs font-semibold text-emerald-700">
                              Akkoord gegeven
                            </span>
                          )}
                        </span>
                        {c.level === "warn" && !akkoord && (
                          <form action={akkoordControle} className="shrink-0">
                            <input type="hidden" name="placementId" value={placementId} />
                            <input type="hidden" name="week" value={dossier.week.key} />
                            <input type="hidden" name="checkId" value={c.id} />
                            <input type="hidden" name="titel" value={c.title} />
                            <SubmitButton variant="outline" size="sm" pendingLabel="…">
                              <Check className="h-3.5 w-3.5" /> Akkoord
                            </SubmitButton>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* Corrigeren wat de AI las */}
      <Card>
        <CardHeader>
          <CardTitle>Uitgelezen waarden</CardTitle>
          <span className="text-xs text-ink-400">
            {row.vastgelegd
              ? "deze week is al vastgelegd — niet meer te wijzigen"
              : "pas aan wat de AI verkeerd las; de controles draaien daarna opnieuw"}
          </span>
        </CardHeader>
        <CardContent>
          <CorrectieFormulier
            placementId={placementId}
            week={dossier.week.key}
            invoer={dossier.invoer}
            dagen={dossier.dagen}
            isZZP={row.isZZP}
            heeftFactuur={Boolean(row.receivedInvoiceId)}
            vergrendeld={row.vastgelegd}
          />
        </CardContent>
      </Card>

      {/* Fouten bewust accepteren */}
      {(fouten.length > 0 || accepteerReden) && (
        <Card
          className={cn(
            accepteerReden ? "border-amber-200 bg-amber-50/40" : "border-red-200 bg-red-50/30",
          )}
        >
          <CardContent className="space-y-3">
            {accepteerReden ? (
              <>
                <p className="flex items-start gap-2 text-[13px] text-amber-900">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    De fouten van deze week zijn bewust geaccepteerd:{" "}
                    <em className="not-italic font-semibold">“{accepteerReden}”</em>
                  </span>
                </p>
                <form action={trekAcceptatieIn}>
                  <input type="hidden" name="placementId" value={placementId} />
                  <input type="hidden" name="week" value={dossier.week.key} />
                  <SubmitButton variant="outline" size="sm" pendingLabel="…">
                    Acceptatie intrekken
                  </SubmitButton>
                </form>
              </>
            ) : (
              <form action={accepteerFouten} className="space-y-2">
                <input type="hidden" name="placementId" value={placementId} />
                <input type="hidden" name="week" value={dossier.week.key} />
                <label className="block">
                  <span className="mb-1 block text-[13px] font-semibold text-ink-900">
                    Toch accepteren — waarom mag deze week door?
                  </span>
                  <Textarea
                    name="reden"
                    required
                    maxLength={2000}
                    rows={2}
                    placeholder="Bijv.: offshore-dag telefonisch afgestemd met de planner, factuur mag zo door."
                  />
                </label>
                <p className="text-xs text-ink-500">
                  De reden wordt bij deze week vastgelegd. De fouten blijven zichtbaar, maar
                  blokkeren het akkoord daarna niet meer.
                </p>
                <SubmitButton variant="outline" size="sm" pendingLabel="Vastleggen…">
                  Fouten accepteren
                </SubmitButton>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* De voet met alle acties */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-ink-50/60 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/facturatie/${placementId}/${dossier.week.key}/mail`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Mail className="h-3.5 w-3.5" /> Concept-mail naar {row.naam.split(" ")[0]}
            </Link>

            {row.inboxId && !row.vastgelegd && (
              <form action={row.wachtkamerSinds ? uitWachtkamer : naarWachtkamer}>
                <input type="hidden" name="placementId" value={placementId} />
                <input type="hidden" name="week" value={dossier.week.key} />
                <input type="hidden" name="inboxId" value={row.inboxId} />
                <input
                  type="hidden"
                  name="reden"
                  value={
                    fouten[0]?.title ??
                    openWaarschuwingen[0]?.title ??
                    "wacht op een reactie van de freelancer"
                  }
                />
                <SubmitButton variant="outline" size="sm" pendingLabel="…">
                  {row.wachtkamerSinds ? (
                    <>
                      <PlayCircle className="h-3.5 w-3.5" /> Uit de wachtkamer
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-3.5 w-3.5" /> Wachtkamer
                    </>
                  )}
                </SubmitButton>
              </form>
            )}

            <ConfirmSubmit
              action={verwijderEnOpnieuw}
              trigger="button"
              variant="outline"
              size="sm"
              confirmVariant="danger"
              confirmLabel="Verwijderen"
              hidden={{ placementId, week: dossier.week.key }}
              message="Deze week verwijderen en opnieuw doen?"
              description="De urenstaat, de concept-verkoopfactuur en de geregistreerde inkoopfactuur van deze week verdwijnen; de uitgelezen scan komt terug op het overzicht. Een al vrijgegeven, verstuurde of betaalde factuur blokkeert dit — die moet gecrediteerd worden."
            >
              <span className="inline-flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Verwijderen &amp; opnieuw
              </span>
            </ConfirmSubmit>
          </div>

          <form action={akkoordNaarVerkoopfactuur} className="flex items-center gap-3">
            <input type="hidden" name="placementId" value={placementId} />
            <input type="hidden" name="week" value={dossier.week.key} />
            {dossier.akkoordGeblokkeerd && (
              <span className="max-w-xs text-right text-xs text-ink-400">
                {dossier.akkoordGeblokkeerd}
              </span>
            )}
            <SubmitButton
              variant="secondary"
              disabled={!magAkkoord}
              pendingLabel="Bezig met vastleggen…"
            >
              Akkoord → verkoopfactuur <ArrowRight className="h-4 w-4" />
            </SubmitButton>
          </form>
        </div>
      </Card>

      <p className="text-xs text-ink-400">
        Akkoord legt de urenstaat vast, keurt zijn eigen factuur als inkoop goed (die factuur ís de
        inkoop — Q4S maakt nooit een eigen inkoopfactuur) en zet de verkoopfactuur als{" "}
        <em>concept</em> klaar bij Verkoopfacturen. Versturen naar de klant blijft een losse, bewuste stap.
      </p>
    </div>
  );
}

function Cijfer({
  label,
  waarde,
  kleur,
}: {
  label: string;
  waarde: string;
  kleur?: string;
}) {
  return (
    <div>
      <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      <span className={cn("mt-0.5 block font-semibold tabular-nums text-ink-900", kleur)}>
        {waarde}
      </span>
    </div>
  );
}
