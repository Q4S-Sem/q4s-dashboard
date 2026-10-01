import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock,
  FileQuestion,
  Receipt,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusVerdeling } from "@/components/ui/status-verdeling";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD, RowLink } from "@/components/ui/table";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { WeekBalk } from "@/components/week-balk";
import { getTeLaat, getWeekOverview, type WeekRow, type WeekStats } from "@/lib/facturatie-week";
import { DEADLINE_LABEL } from "@/lib/facturatie-checks";
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

type Filter = "alles" | "fout" | "wacht" | "niet" | "klaar" | "verwerkt";

const FILTERS: {
  key: Filter;
  label: string;
  veld: keyof WeekStats | null;
  tone: "slate" | "blue" | "green" | "amber" | "red" | "violet";
  icon: React.ReactNode;
}[] = [
  { key: "alles", label: "Alles", veld: null, tone: "slate", icon: <Users className="h-5 w-5" /> },
  { key: "niet", label: "Niet ingeleverd", veld: "nietIngeleverd", tone: "slate", icon: <CircleSlash className="h-5 w-5" /> },
  { key: "wacht", label: "Wacht op factuur", veld: "wacht", tone: "amber", icon: <Clock className="h-5 w-5" /> },
  { key: "fout", label: "Fout", veld: "fout", tone: "red", icon: <AlertTriangle className="h-5 w-5" /> },
  { key: "klaar", label: "Klaar", veld: "klaar", tone: "green", icon: <CheckCircle2 className="h-5 w-5" /> },
  { key: "verwerkt", label: "Gefactureerd", veld: null, tone: "violet", icon: <Receipt className="h-5 w-5" /> },
];

function hoortBijFilter(row: WeekRow, filter: Filter): boolean {
  if (filter === "alles") return true;
  if (filter === "fout") return row.status === "FOUT";
  if (filter === "wacht") return row.status === "WACHT";
  if (filter === "niet") return row.status === "NIET_INGELEVERD";
  if (filter === "verwerkt") return row.gefactureerd;
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
    fout?: string;
  }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const [overzicht, teLaat] = await Promise.all([getWeekOverview(sp.week, now), getTeLaat(now)]);
  const { week, rows, stats, losseUploads, personen } = overzicht;
  const deadlineVerstreken = now.getTime() > week.deadline.getTime();

  const filter = (FILTERS.find((f) => f.key === sp.filter)?.key ?? "alles") as Filter;
  const zichtbaar = rows.filter(
    (r) => hoortBijFilter(r, filter) && matchtZoek(sp.q, r.naam, r.klantNaam, r.locatie, ...r.problemen),
  );
  const ingeleverd = stats.actief - stats.nietIngeleverd;
  const verwerktAantal = rows.filter((r) => r.gefactureerd).length;
  const deel = (n: number) => (stats.actief > 0 ? n / stats.actief : 0);
  const pct = (n: number) => `${Math.round(deel(n) * 100)}%`;
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facturatie"
        title="Week verwerken"
        description="Alles wat deze week binnenkwam — per persoon één regel. Klik op een regel voor het dossier."
        actions={
          <WeekBalk basePath="/facturatie" week={week.mondayParam} currentWeek={ymd(now)} />
        }
      />

      {/* Rode melding: deadline voorbij en iemand heeft nog NIETS gestuurd. */}
      {teLaat.length > 0 && (
        <div role="alert" className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {teLaat.length === 1 ? "1 persoon heeft" : `${teLaat.length} personen hebben`} na de deadline ({DEADLINE_LABEL}) nog niets ingeleverd
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-6">
            {teLaat.map((t) => (
              <li key={`${t.naam}-${t.weekLabel}`}>
                {t.href ? (
                  <Link href={t.href} className="underline underline-offset-2 hover:text-red-950">
                    {t.naam}
                  </Link>
                ) : (
                  t.naam
                )}
                <span className="text-red-700/80"> · {t.weekLabel}{t.klantNaam ? ` · ${t.klantNaam}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ingeleverd"
          value={`${ingeleverd} / ${stats.actief}`}
          sub={`week ${week.isoWeek} · ${week.bereik}`}
          icon={<Users className="h-4 w-4" />}
          accent={deadlineVerstreken && stats.nietIngeleverd > 0 ? "red" : "slate"}
          progress={deel(ingeleverd)}
          detail="Timesheets ontvangen van actieve plaatsingen"
          detailSub={
            stats.nietIngeleverd > 0
              ? `${stats.nietIngeleverd} nog niets · deadline ${DEADLINE_LABEL} ${formatDate(week.deadline)}`
              : "iedereen heeft ingeleverd"
          }
        />
        <StatCard
          label="Klaar"
          value={stats.klaar}
          sub={`${pct(stats.klaar)} van de plaatsingen`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="green"
          progress={deel(stats.klaar)}
          detail="Alle controles groen"
          detailSub={groen.length > 0 ? `${groen.length} klaar om te verwerken` : "niets open om te verwerken"}
        />
        <StatCard
          label="Fout gevonden"
          value={stats.fout}
          sub={`${pct(stats.fout)} van de plaatsingen`}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="red"
          progress={deel(stats.fout)}
          detail="Timesheet, factuur of contract klopt niet"
          detailSub={stats.fout > 0 ? "eerst oplossen of bewust accepteren" : "geen fouten deze week"}
        />
        <StatCard
          label="Wacht op freelancer"
          value={stats.wacht}
          sub={`${pct(stats.wacht)} van de plaatsingen`}
          icon={<Clock className="h-4 w-4" />}
          accent="amber"
          progress={deel(stats.wacht)}
          detail="Urenstaat binnen, factuur nog niet"
          detailSub={verwerktAantal > 0 ? `${verwerktAantal} al gefactureerd` : "nog niets gefactureerd"}
        />
      </div>

      <StatusVerdeling
        title="Status deze week"
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          count: f.key === "verwerkt" ? verwerktAantal : f.veld ? stats[f.veld] : rows.length,
          icon: f.icon,
          tone: f.key === "niet" && deadlineVerstreken && stats.nietIngeleverd > 0 ? "red" : f.tone,
          href: chipHref(f.key),
          active: filter === f.key,
        }))}
      />

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
        het dossier; de verkoopfactuur komt daarna als <em>concept</em> bij Verkoopfacturen te staan.
      </p>
    </div>
  );
}
