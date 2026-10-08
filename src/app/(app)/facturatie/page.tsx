import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock,
  Receipt,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD, RowLink } from "@/components/ui/table";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { getWeekOverview, type WeekRow, type WeekStats } from "@/lib/facturatie-week";
import { DEADLINE_LABEL } from "@/lib/facturatie-checks";
import { cn, formatDate, formatHours } from "@/lib/utils";
import { ymd } from "@/lib/week-nav";
import { WeekStrip } from "./WeekStrip";
import { verwerkGroeneWeken } from "./actions";
import { verwijderStuk } from "./[placementId]/[week]/actions";
import { volgendePersoon, voortgang } from "@/lib/facturatie-volgende";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// "WEEK VERWERKEN" — het enige werkscherm van de facturatie.
//
// Eén regel per persoon met een actieve plaatsing in de gekozen week: wat kwam
// binnen, wat klopt er niet, en wat is de stand. Klikken op een regel opent het
// dossier (document naast de controles). De knop "N groene weken verwerken"
// draait de controle SERVER-SIDE opnieuw en legt alleen vast wat dan nog groen
// is — de browser bepaalt dat nooit.
//
// ALLEEN LEZEN: alles hier komt uit getWeekOverview (src/lib/facturatie-week.ts),
// dat op zijn beurt de pure controle-machine (src/lib/facturatie-checks.ts) en
// `computeTimesheetMoney` gebruikt. Er wordt op deze pagina geen enkel bedrag
// zelf uitgerekend en er gaat niets de deur uit.
// ---------------------------------------------------------------------------

export const metadata = { title: "Week verwerken" };
export const dynamic = "force-dynamic";

type Filter = "alles" | "fout" | "wacht" | "niet" | "klaar" | "verwerkt";

const FILTERS: {
  key: Filter;
  label: string;
  veld: keyof WeekStats | null;
  tone: "slate" | "blue" | "green" | "amber" | "red" | "violet";
  icon: React.ReactNode;
}[] = [
  { key: "alles", label: "Alles", veld: null, tone: "slate", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "niet", label: "Niet ingeleverd", veld: "nietIngeleverd", tone: "slate", icon: <CircleSlash className="h-3.5 w-3.5" /> },
  { key: "wacht", label: "Wacht op factuur", veld: "wacht", tone: "amber", icon: <Clock className="h-3.5 w-3.5" /> },
  { key: "fout", label: "Fout", veld: "fout", tone: "red", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { key: "klaar", label: "Klaar", veld: "klaar", tone: "green", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { key: "verwerkt", label: "Gefactureerd", veld: null, tone: "violet", icon: <Receipt className="h-3.5 w-3.5" /> },
];

const TOON: Record<(typeof FILTERS)[number]["tone"], string> = {
  slate: "bg-ink-100 text-ink-600",
  blue: "bg-blue-100 text-blue-600",
  green: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  red: "bg-red-100 text-red-600",
  violet: "bg-violet-100 text-violet-600",
};

function hoortBijFilter(row: WeekRow, filter: Filter): boolean {
  if (filter === "alles") return true;
  if (filter === "fout") return row.status === "FOUT";
  if (filter === "wacht") return row.status === "WACHT";
  if (filter === "niet") return row.status === "NIET_INGELEVERD";
  if (filter === "verwerkt") return row.gefactureerd;
  return row.status === "KLAAR";
}

/** Het bolletje + woord in de kolommen Timesheet / Factuur; ontvangen = met prullenbak. */
function DocCel({
  status,
  verwijder,
}: {
  status: "ontvangen" | "ontbreekt" | "nvt";
  /** Is het ontvangen stuk fout? Dan eruit halen (bevestiging + server-guards). */
  verwijder?: { stuk: "urenstaat" | "factuur"; placementId: string; week: string; naam: string };
}) {
  if (status === "nvt") {
    return <span className="text-[13px] text-ink-300">— n.v.t.</span>;
  }
  const ok = status === "ontvangen";
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-600">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", ok ? "bg-emerald-600" : "bg-red-600")} />
      {ok ? "ontvangen" : "ontbreekt"}
      {ok && verwijder && (
        // relative z-10: boven de rij-link (RowLink dekt de hele rij af).
        <span className="relative z-10">
          <ConfirmSubmit
            action={verwijderStuk}
            trigger="icon"
            variant="ghost"
            confirmVariant="danger"
            hidden={{ stuk: verwijder.stuk, placementId: verwijder.placementId, week: verwijder.week }}
            message={`${verwijder.stuk === "urenstaat" ? "Urenstaat" : "Factuur"} van ${verwijder.naam} verwijderen?`}
            description={
              verwijder.stuk === "urenstaat"
                ? "De urenstaat van deze week verdwijnt; de freelancer kan een nieuwe sturen. Was de week al vastgelegd, dan gaan ook de concept-verkoopfactuur en de inkoopfactuur van deze week terug. Een verstuurde of betaalde factuur blokkeert dit."
                : "De factuur van deze week verdwijnt; de freelancer kan een nieuwe sturen. Was de week al vastgelegd, dan gaat de week terug naar 'nog verwerken'. Een betaalde factuur blijft altijd staan."
            }
          >
            Verwijderen
          </ConfirmSubmit>
        </span>
      )}
    </span>
  );
}

/** De statusbadge van een regel, met het aantal fouten erin. */
function StatusCel({ row, teLaat }: { row: WeekRow; teLaat: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {row.gefactureerd ? (
        <Badge color="violet">Gefactureerd</Badge>
      ) : row.status === "FOUT" ? (
        <Badge color="red">
          {row.aantalFouten === 1 ? "1 fout" : `${row.aantalFouten} fouten`}
        </Badge>
      ) : row.status === "WACHT" ? (
        <Badge color="amber">Wacht op factuur</Badge>
      ) : row.status === "NIET_INGELEVERD" ? (
        <Badge color={teLaat ? "red" : "slate"}>{teLaat ? "Te laat — niets ontvangen" : "Niet ingeleverd"}</Badge>
      ) : (
        <Badge color="green">{row.vastgelegd ? "Verwerkt" : "Klaar"}</Badge>
      )}
      {/* Geparkeerd: de week wacht op een reactie en hoort niet opgepakt te worden. */}
      {row.wachtkamerSinds && <Badge color="amber">Wachtkamer</Badge>}
      {row.geaccepteerd && <Badge color="slate">Geaccepteerd</Badge>}
    </span>
  );
}

export default async function FacturatiePage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    filter?: string;
    q?: string;
    verwerkt?: string;
    facturen?: string;
    overgeslagen?: string;
    gekoppeld?: string;
    verwijderd?: string;
    weg?: string;
    fout?: string;
    allesklaar?: string;
    klaar?: string;
    factuur?: string;
    verzameld?: string;
    tab?: string;
  }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const overzicht = await getWeekOverview(sp.week, now);
  const { week, rows, stats } = overzicht;
  // Te laat-markering staat voorlopig uit (verzoek gebruiker).
  const deadlineVerstreken = false;

  const filter = (FILTERS.find((f) => f.key === sp.filter)?.key ?? "alles") as Filter;
  const zichtbaar = rows.filter(
    (r) => hoortBijFilter(r, filter) && matchtZoek(sp.q, r.naam, r.klantNaam, r.locatie, ...r.problemen),
  );
  const ingeleverd = stats.actief - stats.nietIngeleverd;
  const verwerktAantal = rows.filter((r) => r.gefactureerd).length;
  // Dezelfde selectie als de bulkactie server-side maakt (zie akkoordWeken):
  // groen, niet geparkeerd en nog niet gefactureerd.
  const groen = rows.filter(
    (r) => r.placementId && r.status === "KLAAR" && !r.gefactureerd && !r.wachtkamerSinds,
  );

  const chipHref = (key: Filter) => {
    const q = new URLSearchParams({ week: week.mondayParam });
    if (key !== "alles") q.set("filter", key);
    if (sp.q) q.set("q", sp.q);
    return `/facturatie?${q.toString()}`;
  };

  const verwerkt = Number(sp.verwerkt ?? "");
  const eerste = volgendePersoon(rows);
  const stand = voortgang(rows);

  return (
    <div className="space-y-6">
      {/* Kop: titel links, weekkiezer rechts — één regel, geen lucht. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="q4s-display text-[26px]">Week verwerken</h1>
          <p className="text-[13px] text-ink-400">
            Week {week.isoWeek} · {week.bereik} · deadline {DEADLINE_LABEL} {formatDate(week.deadline)}
          </p>
        </div>
        <WeekStrip huidig={week.key} vandaag={ymd(now)} extra={{ filter: filter === "alles" ? undefined : filter, q: sp.q }} />
      </div>

      {/* Melding na een actie — kort en feitelijk, nooit geraden. */}
      {Number.isFinite(verwerkt) && sp.verwerkt !== undefined && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-sm border px-3 py-2 text-[13px]",
            verwerkt > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {verwerkt > 0
              ? `${verwerkt} ${verwerkt === 1 ? "week" : "weken"} vastgelegd${
                  sp.facturen ? `, ${sp.facturen} concept-verkoopfactuur${Number(sp.facturen) === 1 ? "" : "en"} klaargezet bij Verkoopfacturen` : ""
                }.`
              : "Er is niets vastgelegd."}
            {sp.overgeslagen
              ? ` ${sp.overgeslagen} ${Number(sp.overgeslagen) === 1 ? "week is" : "weken zijn"} overgeslagen — open het dossier om te zien waarom.`
              : ""}
          </span>
        </p>
      )}
      {sp.gekoppeld && (
        <p className="rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          Het bestand is aan de persoon gekoppeld.
        </p>
      )}
      {(sp.weg === "urenstaat" || sp.weg === "factuur") && (
        <p className="rounded-sm border border-ink-200 bg-ink-50 px-3 py-2 text-[13px] text-ink-600">
          De {sp.weg} is verwijderd — de freelancer kan een nieuwe sturen.
        </p>
      )}
      {sp.verwijderd && (
        <p className="rounded-sm border border-ink-200 bg-ink-50 px-3 py-2 text-[13px] text-ink-600">
          De losse upload is verwijderd.
        </p>
      )}
      {sp.fout === "dubbel" && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Niet gekoppeld: voor die week staat al een goedgekeurde factuur van deze persoon. De dubbele upload is verwijderd.
        </p>
      )}
      {sp.fout === "koppelen" && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          Kies eerst een persoon om het bestand aan te koppelen.
        </p>
      )}

      {sp.klaar && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            <strong>{sp.klaar}</strong> is verwerkt: inkoopfactuur goedgekeurd bij{" "}
            <Link href="/facturatie/inkoop" className="font-semibold underline underline-offset-2">Inkoop</Link>
            {sp.factuur ? (
              <>
                {" "}en verkoopfactuur aangemaakt bij{" "}
                <Link href={`/facturatie/verkoop/${sp.factuur}`} className="font-semibold underline underline-offset-2">Verkoopfacturen</Link>.
              </>
            ) : (
              <>. Uren verzameld voor de verkoopfactuur{sp.verzameld ? ` — ${sp.verzameld}` : ""}.</>
            )}
          </span>
        </p>
      )}

      {sp.allesklaar && (
        <p className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Iedereen van deze week is verwerkt.{" "}
          <Link href={`/facturatie/verkoop/${sp.allesklaar}`} className="font-semibold underline underline-offset-2">
            Bekijk de laatste factuur
          </Link>
        </p>
      )}

      {/* Voortgang + de knop voor de volgende persoon van de gekozen week. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-[13px] tabular-nums text-ink-500">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100" aria-hidden>
              <span
                className="block h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${stand.totaal ? Math.round((stand.klaar / stand.totaal) * 100) : 0}%` }}
              />
            </span>
            {stand.klaar}/{stand.totaal} klaar
          </span>
          {eerste?.href ? (
            <Link href={eerste.href} className={buttonVariants({ size: "sm" })}>
              Start verwerken W{week.isoWeek} — {eerste.naam} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Niemand meer te verwerken in week {week.isoWeek}
            </span>
          )}
        </div>
      </div>

      {/* Eén smalle balk: elke tegel is tegelijk teller én filter. */}
      <nav aria-label="Filter op status" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {FILTERS.map((f) => {
          const aantal = f.key === "verwerkt" ? verwerktAantal : f.veld ? stats[f.veld] : rows.length;
          const rood = f.key === "niet" && deadlineVerstreken && aantal > 0;
          const actief = filter === f.key;
          return (
            <Link
              key={f.key}
              href={chipHref(f.key)}
              scroll={false}
              aria-current={actief ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border bg-white px-3 py-2 transition-colors hover:border-ink-300",
                actief ? "border-ink-900 ring-1 ring-ink-900" : "border-ink-200",
              )}
            >
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", rood ? TOON.red : TOON[f.tone])}>
                {f.icon}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-base font-semibold leading-tight tabular-nums", rood ? "text-red-700" : "text-ink-900")}>
                  {f.key === "alles" ? `${ingeleverd}/${aantal}` : aantal}
                </span>
                <span className="block truncate text-[11px] text-ink-500">
                  {f.key === "alles" ? "ingeleverd" : f.label}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <div className="min-w-0 flex-1">
            <TabelZoek
              basePath="/facturatie"
              q={sp.q}
              placeholder="Zoek op naam, klant, locatie of fout…"
              behoud={{ week: week.mondayParam, filter: filter === "alles" ? undefined : filter }}
            />
          </div>
          {groen.length > 0 && (
            <form action={verwerkGroeneWeken}>
              <input type="hidden" name="week" value={week.key} />
              <SubmitButton size="sm" pendingLabel="Bezig met vastleggen…">
                {groen.length === 1 ? "1 groene week verwerken" : `${groen.length} groene weken verwerken`} →
              </SubmitButton>
            </form>
          )}
        </div>
        {zichtbaar.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={<CheckCircle2 className="h-6 w-6" />}
            title={
              rows.length === 0
                ? "Geen actieve plaatsingen in deze week"
                : "Geen regels gevonden"
            }
            description={
              rows.length === 0
                ? "Er is in deze week niemand geplaatst en er kwam niets binnen."
                : "Kies een ander filter, pas de zoekterm aan of blader naar een andere week."
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Persoon</TH>
                <TH>Type</TH>
                <TH>Timesheet</TH>
                <TH>Factuur</TH>
                <TH className="text-right">Uren</TH>
                <TH>Status</TH>
                <TH>Wat is er mis</TH>
              </TR>
            </THead>
            <TBody>
              {zichtbaar.map((row) => (
                <TR key={row.key} className={row.href ? "cursor-pointer" : undefined}>
                  <TD>
                    <span className="flex items-center gap-3">
                      <PersoonVierkant naam={row.naam} />
                      <span className="min-w-0">
                        {row.href ? (
                          <RowLink href={row.href}>{row.naam}</RowLink>
                        ) : (
                          <span className="font-medium text-ink-900">{row.naam}</span>
                        )}
                        <span className="block truncate text-xs text-ink-400">
                          {[row.klantNaam, row.locatie].filter(Boolean).join(" · ") ||
                            "geen klant gekoppeld"}
                        </span>
                      </span>
                    </span>
                  </TD>
                  <TD>
                    <Badge color={row.isZZP ? "slate" : "blue"}>
                      {row.isZZP ? "ZZP" : "In dienst"}
                    </Badge>
                  </TD>
                  <TD>
                    <DocCel
                      status={row.timesheetOntvangen ? "ontvangen" : "ontbreekt"}
                      verwijder={row.placementId ? { stuk: "urenstaat", placementId: row.placementId, week: week.key, naam: row.naam } : undefined}
                    />
                  </TD>
                  <TD>
                    <DocCel
                      status={
                        row.factuurNvt ? "nvt" : row.factuurOntvangen ? "ontvangen" : "ontbreekt"
                      }
                      verwijder={row.placementId ? { stuk: "factuur", placementId: row.placementId, week: week.key, naam: row.naam } : undefined}
                    />
                  </TD>
                  <TD className="text-right tabular-nums">
                    {row.uren === null ? <span className="text-ink-300">—</span> : formatHours(row.uren)}
                  </TD>
                  <TD>
                    <StatusCel row={row} teLaat={deadlineVerstreken} />
                  </TD>
                  <TD className="max-w-[22rem]">
                    {row.problemen.length > 0 ? (
                      <span className="text-[13px] text-ink-600">
                        {row.problemen.join(" · ")}
                        {row.aantalFouten > row.problemen.length &&
                          ` · +${row.aantalFouten - row.problemen.length} meer`}
                      </span>
                    ) : row.status === "NIET_INGELEVERD" ? (
                      <span className={cn("text-[13px]", deadlineVerstreken ? "font-medium text-red-700" : "text-ink-500")}>
                        Niets ontvangen · deadline {formatDate(week.deadline)}
                      </span>
                    ) : row.status === "WACHT" ? (
                      <span className="text-[13px] text-ink-500">
                        Urenstaat binnen, zijn factuur nog niet
                      </span>
                    ) : (
                      <span className="text-[13px] text-ink-300">
                        Alle {row.aantalControles} controles groen
                        {row.aantalWaarschuwingen > 0 &&
                          ` · ${row.aantalWaarschuwingen} opmerking${row.aantalWaarschuwingen === 1 ? "" : "en"}`}
                      </span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <p className="text-xs text-ink-400">
        Niets op dit scherm wordt automatisch verstuurd of betaald. Een week gaat alleen vooruit met
        de knop <strong className="font-semibold text-ink-600">Akkoord → verkoopfactuur</strong> in
        het dossier; de verkoopfactuur komt daarna als <em>concept</em> bij Verkoopfacturen te staan.
      </p>

    </div>
  );
}
