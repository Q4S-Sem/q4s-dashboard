import Link from "next/link";
import {
  ArrowUp,
  Globe,
  Briefcase,
  MapPin,
  Users,
  ExternalLink,
  Eye,
  Plus,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { naarGereed, zetOnline } from "./actions";
import { pauseVacancy } from "../vacatures/actions";
import { CloudUpload, Pencil } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { VacatureTabs, websiteFase } from "../crm/vacatures/VacatureTabs";
import { AllesNaarGereed, NaarGereedKnop } from "./TekstVoortgang";

/** Vierkante icoon-knop (uniform met de outline-knoppen). */
const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-900";

/** Vaste kolommen (zoals de vacaturelijst in Recruitment): alles staat recht onder elkaar. */
const WEB_KOLOMMEN =
  "grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_9rem_9rem_minmax(14rem,auto)]";

export const metadata = { title: "Vacatures — Website" };
export const dynamic = "force-dynamic";
// AI schrijft bij "naar gereed" de website-teksten (meerdere tegelijk).
export const maxDuration = 60;

/** Turn a stored website value ("www.q4s.nl") into a clickable absolute URL. */
function siteUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

type Bucket = "concept" | "gereed" | "online";

/**
 * Websitefase van een vacature-deal:
 *  - concept  = nog geen website-tekst klaar (geen Vacancy, of status CONCEPT)
 *  - gereed   = website-tekst uitgewerkt, nog niet live (IMPROVED / PAUSED)
 *  - online   = live op q4s.nl (PUBLISHED)
 */
const bucketOf = websiteFase;

const TABS: { key: Bucket; label: string; dot: string }[] = [
  { key: "concept", label: "Concept", dot: "bg-ink-400" },
  { key: "gereed", label: "Gereed", dot: "bg-blue-500" },
  { key: "online", label: "Online", dot: "bg-emerald-500" },
];


export default async function WebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; mislukt?: string; reden?: string }>;
}) {
  const sp = await searchParams;
  const [settings, openDeals] = await Promise.all([
    db.companySettings.findUnique({ where: { id: "default" } }),
    // Alle openstaande vacatures uit de recruitment-hub (deals zonder kandidaat).
    // Recruitment is leidend; hier werk je ze uit naar website + LinkedIn.
    db.deal.findMany({
      where: { status: "OPEN", candidateId: null },
      orderBy: [{ createdAt: "desc" }],
      include: {
        client: { select: { companyName: true } },
        vacancy: {
          select: {
            id: true,
            status: true,
            slug: true,
            views: true,
            _count: { select: { applications: true } },
          },
        },
      },
    }),
  ]);

  const url = siteUrl(settings?.website);

  // Verrijk met de bucket zodat we niet steeds opnieuw hoeven te bepalen.
  const rows = openDeals.map((d) => ({ d, bucket: bucketOf(d.vacancy) }));

  const validTab = new Set<string>(TABS.map((t) => t.key));
  const active: Bucket = validTab.has(sp.tab ?? "")
    ? (sp.tab as Bucket)
    : "concept";
  const visible = rows.filter((r) => r.bucket === active);
  // Bulk: concept → gereed (AI-tekst) en gereed → online. Op die twee tabs zit de
  // hele lijst in één formulier (rij-knop, aangevinkt of alles); Online heeft
  // per rij een eigen offline-formulier, dus daar geen omhullend formulier.
  const bulk =
    active === "online" ? null : active === "concept" ? naarGereed : zetOnline;
  const alleIds = visible
    .map(({ d }) => (active === "concept" ? d.id : d.vacancy?.id))
    .filter(Boolean)
    .join(",");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures"
        description="Werk de openstaande vacatures uit voor de website en zet ze online. Maak er daarna in Socials een post van."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <Globe className="h-4 w-4" /> {settings?.website}
                <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
              </a>
            )}
            {/* Nieuwe vacatures ontstaan in Recruitment (die blijft leidend). */}
            <Link href="/crm/vacatures/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Vacature plaatsen
            </Link>
          </div>
        }
      />

      <VacatureTabs actief={active} />

      {sp.mislukt && active === "concept" && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Bij {sp.mislukt} vacature(s) lukte het schrijven van de website-tekst
          niet. Probeer het opnieuw of werk de tekst uit via de vacature zelf.
          {sp.reden && <span className="mt-1 block text-xs text-amber-700">Reden: {sp.reden}</span>}
        </p>
      )}

      {(() => {
        const lijst = (
          <>
            {bulk && visible.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {active === "gereed" && (
                  <SubmitButton
                    variant="outline"
                    size="sm"
                    pendingLabel="Online zetten…"
                  >
                    <CloudUpload className="h-4 w-4" /> Selectie online zetten
                  </SubmitButton>
                )}
                {active === "concept" ? (
                  <AllesNaarGereed ids={visible.map(({ d }) => d.id)} />
                ) : (
                <SubmitButton
                  name="knop"
                  value={alleIds}
                  variant={active === "gereed" ? "success" : "primary"}
                  size="sm"
                  pendingLabel="Online zetten…"
                >
                  <CloudUpload className="h-4 w-4" /> Alles online zetten ({visible.length})
                </SubmitButton>
                )}
              </div>
            )}

            <Card>
              {visible.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-ink-500">
                  {active === "concept" &&
                    "Geen concepten — alles is al uitgewerkt of nog niet aangemaakt."}
                  {active === "gereed" &&
                    "Niets staat klaar voor publicatie. Werk een concept uit met de AI-tekst."}
                  {active === "online" &&
                    "Nog niets live op de website. Publiceer een gereed staande vacature."}
                </div>
              ) : (
                <>
                {/* Kolomkop: zelfde tabel-opbouw als Openstaand / In pipeline. */}
                <div className={cn(WEB_KOLOMMEN, "hidden h-9 border-b border-ink-200 bg-ink-50 text-[12px] font-medium text-ink-500 md:grid")}>
                  <span>Functie</span>
                  <span>Opdrachtgever</span>
                  <span>Vakgebied</span>
                  <span>{active === "online" ? "Bekeken" : "Plaats"}</span>
                  <span className="text-right">Acties</span>
                </div>
                <ul className="divide-y divide-ink-200/70">
                  {visible.map(({ d, bucket }) => {
                    const company = d.client?.companyName ?? d.company;
                    const vac = d.vacancy;
                    const disc = d.discipline
                      ? labelFor(DISCIPLINES, d.discipline)
                      : "";
                    return (
                      <li
                        key={d.id}
                        className={cn(WEB_KOLOMMEN, "grid min-h-11 py-2 text-[13px] transition-colors hover:bg-ink-50/80")}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {active === "gereed" && vac && (
                            <input
                              type="checkbox"
                              name="id"
                              value={vac.id}
                              aria-label={`${d.title} selecteren`}
                              className="h-4 w-4 shrink-0 accent-ink-900"
                            />
                          )}
                          <Link href={`/crm/deals/${d.id}`} className="truncate font-medium text-ink-900 hover:underline">
                            {d.title}
                          </Link>
                        </div>
                        <span className="hidden min-w-0 items-center gap-1.5 truncate text-ink-600 md:flex">
                          <Briefcase className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                          <span className="truncate">{company || "—"}</span>
                        </span>
                        <span className="hidden truncate text-ink-600 md:block">{disc || <span className="text-ink-300">—</span>}</span>
                        <span className="hidden truncate text-ink-600 md:block">
                          {bucket === "online" ? (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Eye className="h-3.5 w-3.5 text-ink-400" /> {vac?.views ?? 0}
                            </span>
                          ) : d.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-ink-400" /> {d.location}
                            </span>
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </span>

                        {/* Acties — de doorlopende flow: uitwerken · LinkedIn · sollicitaties */}
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {bucket === "concept" ? (
                            <NaarGereedKnop dealId={d.id} />
                          ) : (
                            vac && (
                              <Link
                                href={`/vacatures/${vac.id}`}
                                className={iconBtn}
                                title="Website-tekst bewerken"
                                aria-label="Website-tekst bewerken"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            )
                          )}

                          {vac && (
                            <Link
                              href={`/website/vacatures/${vac.id}/sollicitaties`}
                              className={cn(iconBtn, "relative")}
                              title="Sollicitaties op deze vacature bekijken"
                              aria-label="Sollicitaties"
                            >
                              <Users className="h-4 w-4" />
                              {vac._count.applications > 0 && (
                                <span className="absolute -right-1.5 -top-1.5 min-w-[16px] rounded-full bg-brand-600 px-1 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                                  {vac._count.applications}
                                </span>
                              )}
                            </Link>
                          )}

                          {/* Online/offline schakelen: een live vacature is met één klik
                        van de site te halen en net zo makkelijk weer terug te
                        zetten (status PAUSED <-> PUBLISHED, tekst blijft staan). */}
                          {vac && bucket === "online" && (
                            <ConfirmSubmit
                              action={pauseVacancy}
                              id={vac.id}
                              hidden={{ from: "website" }}
                              trigger="icon"
                              icon={
                                <span className="relative inline-flex" title="Offline halen">
                                  <Globe className="h-4 w-4" />
                                  {/* doorgekruist: een schuine streep over de wereldbol */}
                                  <span aria-hidden className="absolute left-1/2 top-1/2 h-[1.5px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current ring-1 ring-white" />
                                </span>
                              }
                              iconClassName={cn(iconBtn, "hover:border-red-200 hover:bg-red-50 hover:text-red-600")}
                              message={`"${d.title}" offline halen?`}
                              description="De vacature verdwijnt direct van q4s.nl. De tekst blijft bewaard en je kunt hem altijd weer online zetten (staat dan bij Gereed)."
                              confirmLabel="Offline halen"
                            >
                              Offline halen
                            </ConfirmSubmit>
                          )}
                          {vac && bucket === "gereed" && (
                            <SubmitButton
                              name="knop"
                              value={vac.id}
                              variant="success"
                              size="sm"
                              pendingLabel="…"
                              title="Online zetten op q4s.nl"
                              aria-label="Online zetten op q4s.nl"
                              className="h-9 w-9 px-0"
                            >
                              {/* Wereldbol met pijltje omhoog = online zetten */}
                              <span className="relative inline-flex">
                                <Globe className="h-4 w-4" />
                                <ArrowUp aria-hidden className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full bg-emerald-600 stroke-[3]" />
                              </span>
                            </SubmitButton>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                </>
              )}
            </Card>
          </>
        );
        return bulk ? (
          <form action={bulk} className="space-y-6">
            {lijst}
          </form>
        ) : (
          lijst
        );
      })()}
    </div>
  );
}
