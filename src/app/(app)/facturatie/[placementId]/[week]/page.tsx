import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Mail,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, ICOON_GROEP, ICOON_KNOP } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { getWeekDossier, getWeekOverview } from "@/lib/facturatie-week";
import { volgendePersoon, voortgang } from "@/lib/facturatie-volgende";
import { KlaarVak, StapUpload } from "./StapUpload";
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
    klaar?: string;
    factuur?: string;
    andereWeek?: string;
    van?: string;
  }>;
}) {
  const { placementId, week } = await params;
  const sp = await searchParams;
  const [dossier, overzicht] = await Promise.all([getWeekDossier(placementId, week), getWeekOverview(week)]);
  if (!dossier) notFound();
  const volgende = volgendePersoon(overzicht.rows, dossier.row.key);
  const stand = voortgang(overzicht.rows);

  const { row, checks, comparison, akkoorden, accepteerReden, geld } = dossier;
  const afwijkend = comparison.filter((r) => !r.ok);
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

  const totaalGoed = groepen.reduce((n, g) => n + g.goed, 0);
  const statusBadge = row.gefactureerd ? (
    <Badge color="violet">Gefactureerd</Badge>
  ) : fouten.length > 0 ? (
    <Badge color="red">{fouten.length === 1 ? "1 afwijking" : `${fouten.length} afwijkingen`}</Badge>
  ) : row.status === "WACHT" ? (
    <Badge color="amber">Wacht op factuur</Badge>
  ) : row.status === "NIET_INGELEVERD" ? (
    <Badge color="slate">Niets ingeleverd</Badge>
  ) : (
    <Badge color="green">Klaar</Badge>
  );

  return (
    <div className="space-y-6">
      {/* Kopbalk: wie, welke week, status en ALLE acties op één regel. Plakt onder
          de app-header, zodat Akkoord altijd binnen handbereik is. */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-ink-200 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={`/facturatie?week=${dossier.week.mondayParam}`}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
            aria-label="Terug naar de week"
            title="Terug naar de week"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <PersoonVierkant naam={row.naam} />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-ink-900">{row.naam}</h1>
            <p className="truncate text-xs text-ink-400">
              {[row.klantNaam ?? "geen klant", row.locatie, `${dossier.week.label} · ${dossier.week.bereik}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge color={row.isZZP ? "slate" : "blue"}>{row.isZZP ? "ZZP" : "In dienst"}</Badge>
            {statusBadge}
            {row.wachtkamerSinds && <Badge color="amber">Wachtkamer</Badge>}
          </div>

          {/* Zelfde opbouw als de contractbalk: losse iconen in één groep, één groene hoofdknop. */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-ink-100 px-2 py-1 text-xs font-semibold tabular-nums text-ink-600" title="Personen deze week klaar">
              {stand.klaar}/{stand.totaal} klaar
            </span>
            <div className={ICOON_GROEP}>
            <Link
              href={`/facturatie/${placementId}/${dossier.week.key}/mail`}
              className={ICOON_KNOP}
              title="Mail aan de freelancer"
              aria-label="Mail aan de freelancer"
            >
              <Mail />
            </Link>
            {row.inboxId && !row.vastgelegd && (
              <form action={row.wachtkamerSinds ? uitWachtkamer : naarWachtkamer}>
                <input type="hidden" name="placementId" value={placementId} />
                <input type="hidden" name="week" value={dossier.week.key} />
                <input type="hidden" name="inboxId" value={row.inboxId} />
                <input
                  type="hidden"
                  name="reden"
                  value={fouten[0]?.title ?? openWaarschuwingen[0]?.title ?? "wacht op een reactie van de freelancer"}
                />
                <button
                  type="submit"
                  className={cn(ICOON_KNOP, row.wachtkamerSinds && "text-amber-600")}
                  title={row.wachtkamerSinds ? "Uit de wachtkamer halen" : "In de wachtkamer zetten"}
                  aria-label={row.wachtkamerSinds ? "Uit wachtkamer" : "Wachtkamer"}
                >
                  {row.wachtkamerSinds ? <PlayCircle /> : <PauseCircle />}
                </button>
              </form>
            )}
            <ConfirmSubmit
              action={verwijderEnOpnieuw}
              trigger="icon"
              icon={<Trash2 />}
              iconClassName={cn(ICOON_KNOP, "hover:bg-red-50 hover:text-red-600")}
              variant="danger"
              confirmVariant="danger"
              confirmLabel="Verwijderen"
              hidden={{ placementId, week: dossier.week.key }}
              message="Deze week verwijderen en opnieuw doen?"
              description="De urenstaat, de concept-verkoopfactuur en de geregistreerde inkoopfactuur van deze week verdwijnen; de uitgelezen scan komt terug op het overzicht. Een al vrijgegeven, verstuurde of betaalde factuur blokkeert dit — die moet gecrediteerd worden."
            >
              Verwijderen &amp; opnieuw
            </ConfirmSubmit>
            </div>
            {volgende?.href && (
              <Link href={volgende.href} className={buttonVariants({ variant: "outline", size: "sm" })} title={`Volgende: ${volgende.naam}`}>
                Volgende <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
            <form action={akkoordNaarVerkoopfactuur}>
              <input type="hidden" name="placementId" value={placementId} />
              <input type="hidden" name="week" value={dossier.week.key} />
              <SubmitButton
                size="sm"
                variant="success"
                disabled={!magAkkoord}
                pendingLabel="Vastleggen…"
                title={dossier.akkoordGeblokkeerd ?? "Urenstaat vastleggen, inkoop goedkeuren en concept-verkoopfactuur maken"}
              >
                <Check className="h-3.5 w-3.5" /> Akkoord → verkoopfactuur
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>

      {/* Stap voor stap. Stap 1 en 2 hebben hun eigen sleepvak: bestand erin = meteen uitgelezen. */}
      <Stappen
        stappen={[
          {
            label: "Urenstaat",
            klaar: row.timesheetOntvangen,
            sub: row.timesheetOntvangen ? "ontvangen" : "nog uploaden",
            upload: row.timesheetOntvangen ? (
              <KlaarVak
                tekst="Urenstaat uitgelezen"
                vervang={!row.vastgelegd && <StapUpload soort="file" week={dossier.week.key} consultantId={row.consultantId} placementId={placementId} />}
              />
            ) : !row.vastgelegd && (
              <StapUpload soort="file" week={dossier.week.key} consultantId={row.consultantId} placementId={placementId} />
            ),
          },
          {
            label: "Factuur",
            klaar: row.factuurNvt || row.factuurOntvangen,
            sub: row.factuurNvt ? "n.v.t. (in dienst)" : row.factuurOntvangen ? "ontvangen" : "nog uploaden",
            upload: row.factuurOntvangen ? (
              <KlaarVak
                tekst="Factuur uitgelezen"
                vervang={!row.vastgelegd && <StapUpload soort="factuur" week={dossier.week.key} consultantId={row.consultantId} placementId={placementId} />}
              />
            ) : !row.vastgelegd && !row.factuurNvt && (
              <StapUpload soort="factuur" week={dossier.week.key} consultantId={row.consultantId} placementId={placementId} />
            ),
          },
          {
            label: "Controle",
            klaar: row.timesheetOntvangen && fouten.length === 0 && openWaarschuwingen.length === 0,
            fout: fouten.length > 0 && !accepteerReden,
            sub: !row.timesheetOntvangen
              ? "wacht op urenstaat"
              : fouten.length > 0
                ? `${fouten.length} fout${fouten.length === 1 ? "" : "en"}${accepteerReden ? " — geaccepteerd" : ""}`
                : openWaarschuwingen.length > 0
                  ? `${openWaarschuwingen.length} om na te kijken`
                  : "alles klopt",
          },
          {
            label: "Akkoord",
            klaar: row.vastgelegd || row.gefactureerd,
            sub: row.gefactureerd
              ? "gefactureerd"
              : row.vastgelegd
                ? "vastgelegd"
                : (dossier.akkoordGeblokkeerd ?? "klaar — klik Akkoord rechtsboven"),
          },
        ]}
      />

      {sp.andereWeek && (
        <Melding toon="oranje">
          Dit was een document van <strong>week {sp.andereWeek}</strong>, niet van week {sp.van}. Week {sp.andereWeek} stond
          nog open, dus je werkt nu verder in week {sp.andereWeek}.
        </Melding>
      )}

      {sp.klaar && (
        <Melding toon="groen">
          {sp.klaar} is verwerkt{sp.factuur ? " — de concept-verkoopfactuur staat klaar" : ""}. Dit is de volgende persoon.
          {sp.factuur && (
            <>
              {" "}
              <Link href={`/facturatie/verkoop/${sp.factuur}`} className="font-semibold underline underline-offset-2">
                Bekijk de factuur
              </Link>
            </>
          )}
        </Melding>
      )}


      {/* Meldingen van de vorige handeling */}
      {sp.geblokkeerd && (
        <Melding toon="rood">{sp.geblokkeerd === "1" ? "Deze week kon niet vastgelegd worden." : sp.geblokkeerd}</Melding>
      )}
      {sp.fout === "reden" && <Melding toon="rood">Vul een reden in — zonder reden worden de fouten niet geaccepteerd.</Melding>}
      {sp.fout === "reset" && <Melding toon="oranje">Er was niets te verwijderen voor deze week.</Melding>}
      {sp.vastgelegd && (
        <Melding toon="groen">
          De week is vastgelegd. Er is geen verkoopfactuur gemaakt — controleer of de plaatsing een klant heeft.
        </Melding>
      )}
      {sp.wachtkamer && (
        <Melding toon="oranje">De week staat in de wachtkamer en is van het weekoverzicht verdwenen tot je hem terugzet.</Melding>
      )}
      {row.gefactureerd && row.verkoopFactuurId && (
        <Melding toon="violet">
          Staat al op verkoopfactuur {row.verkoopFactuurNummer} — er wordt niets dubbel gefactureerd.{" "}
          <Link href={`/facturatie/verkoop/${row.verkoopFactuurId}`} className="font-semibold underline underline-offset-2">
            Open de factuur
          </Link>
        </Melding>
      )}

      {/* Pas iets te zien als er een urenstaat of factuur is — anders alleen uploaden. */}
      {(row.timesheetOntvangen || row.factuurOntvangen) && (
        <>
      {/* KPI-strook */}
      <Card className="grid grid-cols-2 divide-ink-100 sm:grid-cols-5 sm:divide-x">
        <Kpi label="Uren" waarde={geld ? formatHours(geld.uren) : "—"} />
        <Kpi label="Verkoop (klant)" waarde={geld ? formatCurrency(geld.verkoop) : "—"} />
        <Kpi label="Inkoop (freelancer)" waarde={geld ? formatCurrency(geld.inkoop) : "—"} />
        <Kpi
          label="Marge"
          waarde={geld ? formatCurrency(geld.marge) : "—"}
          kleur={geld && geld.marge > 0 ? "text-emerald-700" : geld ? "text-red-700" : undefined}
        />
        <Kpi
          label="Controles"
          waarde={`${totaalGoed} / ${checks.length}`}
          kleur={fouten.length > 0 ? "text-red-700" : openWaarschuwingen.length > 0 ? "text-amber-600" : "text-emerald-700"}
        />
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {/* LINKS: het bewijs + wat de AI las */}
        <div className="space-y-4">
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
                      receivedAtLabel: dossier.mail.receivedAt ? formatDate(dossier.mail.receivedAt) : null,
                      notes: dossier.mail.notes,
                    }
                  : null
              }
            />
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Uitgelezen waarden</CardTitle>
              <span className="text-xs text-ink-400">
                {row.vastgelegd ? "vastgelegd — niet meer te wijzigen" : "corrigeer wat de AI verkeerd las"}
              </span>
            </CardHeader>
            <CardContent className="p-4">
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
        </div>

        {/* RECHTS: vergelijking + controles */}
        <div className="space-y-4">
          {/* Alleen tonen wat AFWIJKT — klopt alles, dan is deze tabel ruis. */}
          {afwijkend.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Wat wijkt af</CardTitle>
              <span className="text-xs text-ink-400">urenstaat ↔ factuur ↔ contract</span>
            </CardHeader>
            <table className="w-full border-collapse text-[13px]">
              <thead className="border-b border-ink-100 bg-ink-50/50 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">
                <tr>
                  <th className="px-4 py-1.5 font-semibold">Onderdeel</th>
                  <th className="px-4 py-1.5 text-right font-semibold">Urenstaat</th>
                  <th className="px-4 py-1.5 text-right font-semibold">Factuur</th>
                  <th className="px-4 py-1.5 text-right font-semibold">Contract</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {afwijkend.map((rij) => (
                  <tr key={rij.key}>
                    <td className="px-4 py-1.5 text-ink-700">{rij.label}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-ink-700">
                      {rij.timesheet ?? <span className="text-ink-300">—</span>}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-1.5 text-right tabular-nums",
                        rij.ok ? "text-ink-700" : "bg-red-50 font-semibold text-red-700",
                      )}
                    >
                      {rij.invoice ?? <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-ink-500">
                      {rij.contract ?? <span className="text-ink-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Controles</CardTitle>
              <span className="text-xs text-ink-400">
                {fouten.length > 0
                  ? `${fouten.length} fout${fouten.length === 1 ? "" : "en"}`
                  : openWaarschuwingen.length > 0
                    ? `${openWaarschuwingen.length} om na te kijken`
                    : "alles in orde"}
              </span>
            </CardHeader>
            {groepen.map(({ groep, checks: eigen, goed }) => {
              const allesGoed = goed === eigen.length;
              return (
                <details key={groep} open={!allesGoed} className="group border-b border-ink-100 last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-[13px] font-semibold text-ink-900 hover:bg-ink-50/60 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-ink-400 transition-transform group-open:rotate-90" />
                      {GROEP_LABEL[groep]}
                    </span>
                    <span className={cn("text-xs font-bold tabular-nums", allesGoed ? "text-emerald-600" : "text-ink-400")}>
                      {goed}/{eigen.length}
                    </span>
                  </summary>
                  <ul className="space-y-1.5 px-4 pb-3 pl-10">
                    {eigen.map((c) => {
                      const akkoord = akkoordSet.has(c.id);
                      return (
                        <li key={c.id} className="flex items-start gap-2.5">
                          <ControleIcoon level={c.level} akkoord={akkoord} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium text-ink-800">{c.title}</span>
                            <span className="block text-xs leading-snug text-ink-500">{c.detail}</span>
                            {akkoord && (
                              <span className="mt-0.5 block text-xs font-semibold text-emerald-700">Akkoord gegeven</span>
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
                </details>
              );
            })}
          </Card>

          {/* Fouten bewust accepteren */}
          {(fouten.length > 0 || accepteerReden) && (
            <Card className={cn(accepteerReden ? "border-amber-200 bg-amber-50/40" : "border-red-200 bg-red-50/30")}>
              <CardContent className="space-y-2 p-4">
                {accepteerReden ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-start gap-2 text-[13px] text-amber-900">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Bewust geaccepteerd: <em className="not-italic font-semibold">“{accepteerReden}”</em>
                      </span>
                    </p>
                    <form action={trekAcceptatieIn}>
                      <input type="hidden" name="placementId" value={placementId} />
                      <input type="hidden" name="week" value={dossier.week.key} />
                      <SubmitButton variant="outline" size="sm" pendingLabel="…">
                        Intrekken
                      </SubmitButton>
                    </form>
                  </div>
                ) : (
                  <form action={accepteerFouten} className="space-y-2">
                    <input type="hidden" name="placementId" value={placementId} />
                    <input type="hidden" name="week" value={dossier.week.key} />
                    <label className="block">
                      <span className="mb-1 block text-[13px] font-semibold text-ink-900">Toch accepteren — reden</span>
                      <Textarea
                        name="reden"
                        required
                        maxLength={2000}
                        rows={2}
                        placeholder="Bijv.: offshore-dag telefonisch afgestemd met de planner."
                      />
                    </label>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-ink-500">Fouten blijven zichtbaar, maar blokkeren Akkoord niet meer.</span>
                      <SubmitButton variant="outline" size="sm" pendingLabel="Vastleggen…">
                        Fouten accepteren
                      </SubmitButton>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

/** De vier stappen als één kaart: groen = klaar, rood = fout, grijs = te doen. Stap 1/2 kunnen een sleepvak bevatten. */
function Stappen({
  stappen,
}: {
  stappen: { label: string; sub: string; klaar: boolean; fout?: boolean; upload?: React.ReactNode }[];
}) {
  const huidig = stappen.findIndex((s) => !s.klaar);
  return (
    <ol className="grid overflow-hidden rounded-lg border border-ink-200 bg-white sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-ink-100">
      {stappen.map((s, i) => (
        <li
          key={s.label}
          className={cn(
            "border-b border-ink-100 p-4 xl:border-b-0",
            i === huidig && !s.fout && "bg-brand-50/40",
            s.fout && "bg-red-50/50",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                s.klaar ? "bg-emerald-600 text-white" : s.fout ? "bg-red-600 text-white" : i === huidig ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-500",
              )}
            >
              {s.klaar ? <Check className="h-3.5 w-3.5" /> : s.fout ? "!" : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink-900">{s.label}</span>
              <span className={cn("block text-xs", s.fout ? "text-red-600" : s.klaar ? "text-emerald-700" : "text-ink-400")}>{s.sub}</span>
            </span>
          </div>
          {s.upload}
        </li>
      ))}
    </ol>
  );
}

function Melding({ toon, children }: { toon: "rood" | "oranje" | "groen" | "violet"; children: React.ReactNode }) {
  const kleur = {
    rood: "border-red-200 bg-red-50 text-red-700",
    oranje: "border-amber-200 bg-amber-50 text-amber-900",
    groen: "border-emerald-200 bg-emerald-50 text-emerald-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  }[toon];
  return <p className={cn("rounded-md border px-3 py-2 text-[13px]", kleur)}>{children}</p>;
}

function Kpi({ label, waarde, kleur }: { label: string; waarde: string; kleur?: string }) {
  return (
    <div className="px-4 py-3">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</span>
      <span className={cn("mt-0.5 block text-lg font-semibold tabular-nums text-ink-900", kleur)}>{waarde}</span>
    </div>
  );
}
