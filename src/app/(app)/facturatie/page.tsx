import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock,
  FileQuestion,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD, RowLink } from "@/components/ui/table";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { WeekBalk } from "@/components/week-balk";
import { getWeekOverview, type WeekRow, type WeekStats } from "@/lib/facturatie-week";
import { cn, formatDate, formatHours } from "@/lib/utils";
import { ymd } from "@/lib/week-nav";
import { UploadPaneel } from "./UploadPaneel";
import { koppelLosseUpload, verwerkGroeneWeken, verwijderLosseUpload } from "./actions";

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

type Filter = "alles" | "fout" | "wacht" | "niet" | "klaar";

const FILTERS: { key: Filter; label: string; veld: keyof WeekStats | null }[] = [
  { key: "alles", label: "Alles", veld: null },
  { key: "fout", label: "Fout", veld: "fout" },
  { key: "wacht", label: "Wacht", veld: "wacht" },
  { key: "niet", label: "Niet ingeleverd", veld: "nietIngeleverd" },
  { key: "klaar", label: "Klaar", veld: "klaar" },
];

function hoortBijFilter(row: WeekRow, filter: Filter): boolean {
  if (filter === "alles") return true;
  if (filter === "fout") return row.status === "FOUT";
  if (filter === "wacht") return row.status === "WACHT";
  if (filter === "niet") return row.status === "NIET_INGELEVERD";
  return row.status === "KLAAR";
}

/** Het bolletje + woord in de kolommen Timesheet / Factuur. */
function DocCel({ status }: { status: "ontvangen" | "ontbreekt" | "nvt" }) {
  if (status === "nvt") {
    return <span className="text-[13px] text-ink-300">— n.v.t.</span>;
  }
  const ok = status === "ontvangen";
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-600">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", ok ? "bg-emerald-600" : "bg-red-600")} />
      {ok ? "ontvangen" : "ontbreekt"}
    </span>
  );
}

/** De statusbadge van een regel, met het aantal fouten erin. */
function StatusCel({ row }: { row: WeekRow }) {
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
        <Badge color="slate">Niet ingeleverd</Badge>
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
    verwerkt?: string;
    facturen?: string;
    overgeslagen?: string;
    gekoppeld?: string;
    verwijderd?: string;
    fout?: string;
  }>;
}) {
  const sp = await searchParams;
  const overzicht = await getWeekOverview(sp.week);
  const { week, rows, stats, losseUploads, personen } = overzicht;

  const filter = (FILTERS.find((f) => f.key === sp.filter)?.key ?? "alles") as Filter;
  const zichtbaar = rows.filter((r) => hoortBijFilter(r, filter));
  // Dezelfde selectie als de bulkactie server-side maakt (zie akkoordWeken):
  // groen, niet geparkeerd en nog niet gefactureerd.
  const groen = rows.filter(
    (r) => r.placementId && r.status === "KLAAR" && !r.gefactureerd && !r.wachtkamerSinds,
  );

  const chipHref = (key: Filter) =>
    key === "alles"
      ? `/facturatie?week=${week.mondayParam}`
      : `/facturatie?week=${week.mondayParam}&filter=${key}`;

  const verwerkt = Number(sp.verwerkt ?? "");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facturatie"
        title="Week verwerken"
        description="Alles wat deze week binnenkwam — per persoon één regel. Klik op een regel voor het dossier."
        actions={
          <WeekBalk basePath="/facturatie" week={week.mondayParam} currentWeek={ymd(new Date())} />
        }
      />

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
                  sp.facturen ? `, ${sp.facturen} concept-verkoopfactuur${Number(sp.facturen) === 1 ? "" : "en"} klaargezet in Facturen` : ""
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
      {sp.verwijderd && (
        <p className="rounded-sm border border-ink-200 bg-ink-50 px-3 py-2 text-[13px] text-ink-600">
          De losse upload is verwijderd.
        </p>
      )}
      {sp.fout === "koppelen" && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          Kies eerst een persoon om het bestand aan te koppelen.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Actieve plaatsingen"
          value={stats.actief}
          sub={`week ${week.isoWeek} · ${week.bereik}`}
          icon={<Users className="h-4 w-4" />}
          accent="slate"
        />
        <StatCard
          label="Klaar — alle controles groen"
          value={stats.klaar}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="green"
        />
        <StatCard
          label="Fout gevonden"
          value={stats.fout}
          sub={stats.fout > 0 ? "eerst oplossen of bewust accepteren" : undefined}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="red"
        />
        <StatCard
          label="Wacht op freelancer"
          value={stats.wacht}
          sub="urenstaat binnen, factuur nog niet"
          icon={<Clock className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Niets ingeleverd"
          value={stats.nietIngeleverd}
          sub={`deadline ma 12:00 · ${formatDate(week.deadline)}`}
          icon={<CircleSlash className="h-4 w-4" />}
          accent="slate"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const aantal = f.veld ? stats[f.veld] : rows.length;
          return (
            <Link
              key={f.key}
              href={chipHref(f.key)}
              scroll={false}
              aria-current={filter === f.key ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                filter === f.key
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50",
              )}
            >
              {f.label}
              <span className={cn("tabular-nums", filter === f.key ? "text-white/80" : "text-ink-400")}>
                {aantal}
              </span>
            </Link>
          );
        })}
        <span className="flex-1" />
        {groen.length > 0 && (
          <form action={verwerkGroeneWeken}>
            <input type="hidden" name="week" value={week.key} />
            <SubmitButton variant="secondary" size="sm" pendingLabel="Bezig met vastleggen…">
              {groen.length === 1 ? "1 groene week verwerken" : `${groen.length} groene weken verwerken`} →
            </SubmitButton>
          </form>
        )}
      </div>

      <Card className="overflow-hidden">
        {zichtbaar.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={<CheckCircle2 className="h-6 w-6" />}
            title={
              rows.length === 0
                ? "Geen actieve plaatsingen in deze week"
                : "Geen regels in dit filter"
            }
            description={
              rows.length === 0
                ? "Er is in deze week niemand geplaatst en er kwam niets binnen."
                : "Kies een ander filter of blader naar een andere week."
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
                    <DocCel status={row.timesheetOntvangen ? "ontvangen" : "ontbreekt"} />
                  </TD>
                  <TD>
                    <DocCel
                      status={
                        row.factuurNvt ? "nvt" : row.factuurOntvangen ? "ontvangen" : "ontbreekt"
                      }
                    />
                  </TD>
                  <TD className="text-right tabular-nums">
                    {row.uren === null ? <span className="text-ink-300">—</span> : formatHours(row.uren)}
                  </TD>
                  <TD>
                    <StatusCel row={row} />
                  </TD>
                  <TD className="max-w-[22rem]">
                    {row.problemen.length > 0 ? (
                      <span className="text-[13px] text-ink-600">
                        {row.problemen.join(" · ")}
                        {row.aantalFouten > row.problemen.length &&
                          ` · +${row.aantalFouten - row.problemen.length} meer`}
                      </span>
                    ) : row.status === "NIET_INGELEVERD" ? (
                      <span className="text-[13px] text-ink-500">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <UploadPaneel week={week.key} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-ink-400" /> Niet gekoppeld
            </CardTitle>
            <span className="text-xs text-ink-400">
              {losseUploads.length === 0
                ? "alles is aan een persoon gekoppeld"
                : `${losseUploads.length} bestand${losseUploads.length === 1 ? "" : "en"}`}
            </span>
          </CardHeader>
          <CardContent>
            {losseUploads.length === 0 ? (
              <p className="text-[13px] text-ink-400">
                Er staan geen losse bestanden open. Komt een naam niet overeen met iemand in het
                dossier, dan verschijnt het bestand hier met een keuzelijst.
              </p>
            ) : (
              <ul className="space-y-3">
                {losseUploads.map((los) => (
                  <li key={los.id} className="rounded-sm border border-ink-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0">
                        <a
                          href={los.src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-[13px] font-semibold text-ink-900 underline underline-offset-2 hover:text-brand-700"
                          title={los.originalName}
                        >
                          {los.originalName}
                        </a>
                        <span className="mt-0.5 block text-xs text-ink-500">
                          {los.soort === "timesheet" ? "Urenstaat" : "Factuur"}
                          {los.gelezenNaam ? ` · gelezen naam: ${los.gelezenNaam}` : ""}
                        </span>
                      </span>
                      <Badge color={los.soort === "timesheet" ? "blue" : "amber"}>
                        {los.soort === "timesheet" ? "uren" : "factuur"}
                      </Badge>
                    </div>
                    {los.reden && <p className="mt-1.5 text-xs text-ink-500">{los.reden}</p>}
                    <div className="mt-2.5 flex flex-wrap items-end gap-2">
                      <form action={koppelLosseUpload} className="flex flex-1 items-end gap-2">
                        <input type="hidden" name="id" value={los.id} />
                        <input type="hidden" name="soort" value={los.soort} />
                        <input type="hidden" name="week" value={week.key} />
                        <Select
                          name="consultantId"
                          defaultValue=""
                          className="min-w-[12rem] flex-1"
                          aria-label="Kies de persoon"
                        >
                          <option value="">Kies de persoon…</option>
                          {personen.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.naam}
                            </option>
                          ))}
                        </Select>
                        <SubmitButton variant="outline" size="sm" pendingLabel="Koppelen…">
                          Koppelen
                        </SubmitButton>
                      </form>
                      <ConfirmSubmit
                        action={verwijderLosseUpload}
                        id={los.id}
                        hidden={{ soort: los.soort, week: week.key }}
                        message="Deze upload verwijderen?"
                        description="Het bestand verdwijnt. Er is nog niets geboekt, dus er gaat geen administratie verloren."
                      >
                        Verwijderen
                      </ConfirmSubmit>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-ink-400">
        Niets op dit scherm wordt automatisch verstuurd of betaald. Een week gaat alleen vooruit met
        de knop <strong className="font-semibold text-ink-600">Akkoord → verkoopfactuur</strong> in
        het dossier; de verkoopfactuur komt daarna als <em>concept</em> in Facturen te staan.
      </p>
    </div>
  );
}
