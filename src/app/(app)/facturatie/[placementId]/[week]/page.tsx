import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText, PauseCircle, PencilLine, PlayCircle, Receipt, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, ICOON_GROEP, ICOON_KNOP } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { getWeekDossier } from "@/lib/facturatie-week";
import { StapUpload } from "./StapUpload";
import type { Check as Controle, CheckGroup } from "@/lib/facturatie-checks";
import { cn, formatCurrency, formatHours } from "@/lib/utils";
import { CorrectieFormulier } from "./CorrectieFormulier";
import { DossierDocument } from "./DossierDocument";
import { DocumentViewer } from "@/components/document-viewer";
import { akkoordNaarVerkoopfactuur, naarWachtkamer, uitWachtkamer, verwijderEnOpnieuw } from "./actions";

// ---------------------------------------------------------------------------
// HET DOSSIER van één persoon in één week, in twee fases:
//   1 Documenten — alleen de timesheet en de factuur (uploaden + bekijken).
//      Zodra beide binnen zijn, opent vanzelf fase 2.
//   2 Controle — links het document (filter Timesheet | Factuur | Mail), rechts
//      wat afwijkt + de controles; één Akkoord-knop (bij fouten met reden).
//      Akkoord → inkoop goedgekeurd (Inkoop), verkoopfactuur gemaakt (Verkoop),
//      terug naar Week verwerken.
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
  searchParams: Promise<{ stap?: string; geblokkeerd?: string; wachtkamer?: string; fout?: string; andereWeek?: string; van?: string }>;
}) {
  const { placementId, week } = await params;
  const sp = await searchParams;
  const dossier = await getWeekDossier(placementId, week);
  if (!dossier) notFound();

  const { row, checks, comparison, akkoorden, accepteerReden, geld } = dossier;
  const wk = dossier.week.key;
  const documentenBinnen = row.timesheetOntvangen && (row.factuurNvt || row.factuurOntvangen);
  // Fase: documenten tot beide binnen zijn (of als je er bewust naar teruggaat).
  const fase = !row.vastgelegd && (!documentenBinnen || sp.stap === "documenten") ? "documenten" : "controle";

  const afwijkend = comparison.filter((r) => !r.ok);
  const akkoordSet = new Set(akkoorden);
  const fouten = checks.filter((c) => c.level === "error");
  const letOp = checks.filter((c) => c.level === "warn" && !akkoordSet.has(c.id));
  const openFouten = fouten.length > 0 && !accepteerReden;
  // Alleen de inhoudelijke blokkade telt; fouten los je op met een reden in de Akkoord-balk.
  const onvolledig = checks.some((c) => c.id === "contract-compleet");
  const blokkade = openFouten && !onvolledig && !row.gefactureerd ? null : dossier.akkoordGeblokkeerd;
  const nietOk = GROEP_ORDE.flatMap((g) => checks.filter((c) => c.group === g && c.level !== "ok" && !akkoordSet.has(c.id)));

  const statusBadge = row.gefactureerd ? (
    <Badge color="violet">Gefactureerd</Badge>
  ) : row.vastgelegd ? (
    <Badge color="green">Akkoord</Badge>
  ) : fase === "documenten" ? (
    <Badge color="slate">Documenten</Badge>
  ) : openFouten ? (
    <Badge color="red">{fouten.length === 1 ? "1 fout" : `${fouten.length} fouten`}</Badge>
  ) : (
    <Badge color="green">Klaar voor akkoord</Badge>
  );
  const verborgen = { placementId, week: wk };

  return (
    <div className="space-y-5">
      {/* Kopbalk: wie/welke week, de 2 fases, en rechts de acties (Akkoord altijd in beeld). */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-ink-200 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={`/facturatie?week=${wk}`} className={ICOON_KNOP} aria-label="Terug naar Week verwerken" title="Terug naar Week verwerken">
            <ArrowLeft />
          </Link>
          <PersoonVierkant naam={row.naam} />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-ink-900">{row.naam}</h1>
            <p className="truncate text-xs text-ink-400">
              {[row.klantNaam ?? "geen klant", `${dossier.week.label} · ${dossier.week.bereik}`].join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge color={row.isZZP ? "slate" : "blue"}>{row.isZZP ? "ZZP" : "In dienst"}</Badge>
            {statusBadge}
            {row.wachtkamerSinds && <Badge color="amber">Wachtkamer</Badge>}
          </div>

          <FaseBalk fase={fase} basis={`/facturatie/${placementId}/${wk}`} controleKan={documentenBinnen || row.vastgelegd} />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className={ICOON_GROEP}>
              {row.inboxId && !row.vastgelegd && (
                <form action={row.wachtkamerSinds ? uitWachtkamer : naarWachtkamer}>
                  <input type="hidden" name="placementId" value={placementId} />
                  <input type="hidden" name="week" value={wk} />
                  <input type="hidden" name="inboxId" value={row.inboxId} />
                  <input type="hidden" name="reden" value={fouten[0]?.title ?? letOp[0]?.title ?? "wacht op een reactie van de freelancer"} />
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
                hidden={verborgen}
                message="Deze week verwijderen en opnieuw doen?"
                description="De urenstaat, de concept-verkoopfactuur en de geregistreerde inkoopfactuur van deze week verdwijnen; de uitgelezen scan komt terug op het overzicht. Een al vrijgegeven, verstuurde of betaalde factuur blokkeert dit — die moet gecrediteerd worden."
              >
                Verwijderen &amp; opnieuw
              </ConfirmSubmit>
            </div>

            {fase === "documenten" && documentenBinnen && (
              <Link href={`/facturatie/${placementId}/${wk}`} className={buttonVariants({ size: "sm" })}>
                Naar controle <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {fase === "controle" && !row.vastgelegd && (
              <form action={akkoordNaarVerkoopfactuur} className="flex items-center gap-2">
                <input type="hidden" name="placementId" value={placementId} />
                <input type="hidden" name="week" value={wk} />
                {openFouten && !blokkade && (
                  <Input name="reden" required maxLength={2000} placeholder="Reden om de fouten te accepteren" aria-label="Reden" className="h-8 w-64 text-[13px]" />
                )}
                <SubmitButton
                  size="sm"
                  variant="success"
                  disabled={Boolean(blokkade)}
                  pendingLabel="Verwerken…"
                  title={blokkade ?? "Inkoop goedkeuren, verkoopfactuur maken en terug naar Week verwerken"}
                >
                  <Check className="h-3.5 w-3.5" /> {openFouten ? "Toch akkoord" : "Akkoord"}
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
        {fase === "controle" && blokkade && !row.vastgelegd && <p className="mt-1 text-right text-xs text-red-600">{blokkade}</p>}
      </div>

      {sp.andereWeek && (
        <Melding toon="oranje">
          Dit was een document van <strong>week {sp.andereWeek}</strong>, niet van week {sp.van}. Week {sp.andereWeek} stond nog open, dus je
          werkt nu verder in week {sp.andereWeek}.
        </Melding>
      )}
      {sp.geblokkeerd && <Melding toon="rood">{sp.geblokkeerd === "1" ? "Deze week kon niet vastgelegd worden." : sp.geblokkeerd}</Melding>}
      {sp.fout === "reset" && <Melding toon="oranje">Er was niets te verwijderen voor deze week.</Melding>}
      {sp.wachtkamer && <Melding toon="oranje">De week staat in de wachtkamer en is van het weekoverzicht verdwenen tot je hem terugzet.</Melding>}
      {row.vastgelegd && (
        <Melding toon={row.gefactureerd ? "violet" : "groen"}>
          {row.gefactureerd && row.verkoopFactuurId ? (
            <>
              Akkoord gegeven en gefactureerd op verkoopfactuur {row.verkoopFactuurNummer}.{" "}
              <Link href={`/facturatie/verkoop/${row.verkoopFactuurId}`} className="font-semibold underline underline-offset-2">
                Open de factuur
              </Link>
            </>
          ) : (
            "Akkoord gegeven — de uren zijn verzameld voor de verkoopfactuur van deze periode."
          )}
        </Melding>
      )}

      {fase === "documenten" ? (
        /* FASE 1 — alleen de timesheet en de factuur, naast elkaar. */
        <div className={cn("grid items-start gap-4", !row.factuurNvt && "lg:grid-cols-2")}>
          <DocKolom
            nr={1}
            titel="Timesheet"
            icon={<FileText className="h-4 w-4" />}
            binnen={row.timesheetOntvangen}
            doc={dossier.timesheetDoc}
            upload={<StapUpload soort="file" week={wk} consultantId={row.consultantId} placementId={placementId} />}
          />
          {!row.factuurNvt && (
            <DocKolom
              nr={2}
              titel="Factuur"
              icon={<Receipt className="h-4 w-4" />}
              binnen={row.factuurOntvangen}
              doc={dossier.factuurDoc}
              upload={<StapUpload soort="factuur" week={wk} consultantId={row.consultantId} placementId={placementId} />}
            />
          )}
        </div>
      ) : (
        /* FASE 2 — controle: document links (filter), wat afwijkt + controles rechts. */
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden xl:sticky xl:top-32">
            <DossierDocument
              weekLabel={`wk ${dossier.week.isoWeek}`}
              factuurNummer={dossier.invoer.factuurNummer || null}
              timesheet={dossier.timesheetDoc}
              factuur={dossier.factuurDoc}
            />
          </Card>

          <div className="space-y-4">
            <Card className="grid grid-cols-2 divide-ink-100 sm:grid-cols-4 sm:divide-x">
              <Kpi label="Uren" waarde={geld ? formatHours(geld.uren) : "—"} />
              <Kpi label="Verkoop" waarde={geld ? formatCurrency(geld.verkoop) : "—"} />
              <Kpi label="Inkoop" waarde={geld ? formatCurrency(geld.inkoop) : "—"} />
              <Kpi label="Marge" waarde={geld ? formatCurrency(geld.marge) : "—"} kleur={geld && geld.marge > 0 ? "text-emerald-700" : geld ? "text-red-700" : undefined} />
            </Card>

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
                        <td className="px-4 py-1.5 text-right tabular-nums text-ink-700">{rij.timesheet ?? <span className="text-ink-300">—</span>}</td>
                        <td className="bg-red-50 px-4 py-1.5 text-right font-semibold tabular-nums text-red-700">{rij.invoice ?? <span className="text-ink-300">—</span>}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-ink-500">{rij.contract ?? <span className="text-ink-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {/* Controles: alleen wat niet groen is. Geen knop per regel — één Akkoord bovenin. */}
            <Card className="overflow-hidden">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Controles</CardTitle>
                <span className={cn("text-xs font-semibold tabular-nums", openFouten ? "text-red-600" : letOp.length ? "text-amber-600" : "text-emerald-600")}>
                  {checks.length - nietOk.length}/{checks.length} in orde
                </span>
              </CardHeader>
              {nietOk.length === 0 ? (
                <p className="flex items-center gap-2 px-4 pb-4 text-[13px] text-emerald-700">
                  <Check className="h-4 w-4" /> Alles klopt — timesheet, factuur, koppeling en contract.
                </p>
              ) : (
                <ul className="space-y-2 px-4 pb-4">
                  {nietOk.map((c) => (
                    <li key={c.id} className="flex items-start gap-2.5">
                      <ControleIcoon level={c.level} akkoord={false} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-ink-800">
                          <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{GROEP_LABEL[c.group]}</span>
                          {c.title}
                        </span>
                        <span className="block text-xs leading-snug text-ink-500">{c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {accepteerReden && (
                <p className="border-t border-amber-200 bg-amber-50/60 px-4 py-2 text-xs text-amber-900">
                  Fouten geaccepteerd: <span className="font-semibold">“{accepteerReden}”</span>
                </p>
              )}
            </Card>

            <details className="group rounded-lg border border-ink-200 bg-white" open={afwijkend.length > 0 && !row.vastgelegd}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
                <PencilLine className="h-4 w-4 text-ink-400" /> Uitgelezen waarden
                <span className="ml-auto text-xs font-normal text-ink-400">
                  {row.vastgelegd ? "vastgelegd" : "corrigeer wat de AI verkeerd las"}
                </span>
              </summary>
              <div className="border-t border-ink-100 p-4">
                <CorrectieFormulier
                  placementId={placementId}
                  week={wk}
                  invoer={dossier.invoer}
                  dagen={dossier.dagen}
                  isZZP={row.isZZP}
                  heeftFactuur={Boolean(row.receivedInvoiceId)}
                  vergrendeld={row.vastgelegd}
                />
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

/** De twee fases als schakelaar in de kopbalk. */
function FaseBalk({ fase, basis, controleKan }: { fase: "documenten" | "controle"; basis: string; controleKan: boolean }) {
  const stap = (nr: number, label: string, aan: boolean, href: string | null) => {
    const inhoud = (
      <>
        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold", aan ? "bg-white text-ink-900" : "bg-ink-200 text-ink-600")}>{nr}</span>
        {label}
      </>
    );
    const cls = cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold", aan ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-100");
    return href && !aan ? <Link href={href} className={cls}>{inhoud}</Link> : <span className={cn(cls, !href && !aan && "opacity-50")}>{inhoud}</span>;
  };
  return (
    <div className="flex items-center gap-1 rounded-lg bg-ink-50 p-0.5">
      {stap(1, "Documenten", fase === "documenten", `${basis}?stap=documenten`)}
      {stap(2, "Controle", fase === "controle", controleKan ? basis : null)}
    </div>
  );
}

/** Fase 1: één document — uploadvak bovenaan, daaronder het document zelf. */
function DocKolom({
  nr,
  titel,
  icon,
  binnen,
  doc,
  upload,
}: {
  nr: number;
  titel: string;
  icon: React.ReactNode;
  binnen: boolean;
  doc: { src: string; originalName: string; mimeType: string | null } | null;
  upload: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-ink-100 px-4 py-3">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white", binnen ? "bg-emerald-600" : "bg-ink-900")}>
          {binnen ? <Check className="h-3.5 w-3.5" /> : nr}
        </span>
        <span className="text-ink-400">{icon}</span>
        <h2 className="text-sm font-semibold text-ink-900">{titel}</h2>
        <span className={cn("ml-auto text-xs", binnen ? "text-emerald-700" : "text-ink-400")}>{binnen ? "uitgelezen" : "nog uploaden"}</span>
      </div>
      <div className="p-3">
        {binnen && doc ? (
          <>
            <DocumentViewer src={doc.src} mimeType={doc.mimeType} originalName={doc.originalName} titel={titel} hoogte="h-[420px] xl:h-[560px]" />
            <details className="mt-2">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs text-ink-500 hover:text-ink-900 [&::-webkit-details-marker]:hidden">
                <RefreshCw className="h-3.5 w-3.5" /> Verkeerd bestand? Vervangen
              </summary>
              {upload}
            </details>
          </>
        ) : (
          upload
        )}
      </div>
    </Card>
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
