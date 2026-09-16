import Link from "next/link";
import {
  Globe,
  Briefcase,
  MapPin,
  ArrowRight,
  Users,
  ExternalLink,
  Eye,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { sendDealToWebsite } from "./actions";
import { pauseVacancy, resumeVacancy } from "../vacatures/actions";
import { CloudOff, CloudUpload } from "lucide-react";
import { publicVacancyUrl } from "@/lib/public-site";

/** LinkedIn-logo (lucide heeft geen merk-icoon). */
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** Vierkante icoon-knop (uniform met de outline-knoppen). */
const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-900";

export const metadata = { title: "Vacatures — Website" };
export const dynamic = "force-dynamic";

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
function bucketOf(vac: { status: string } | null): Bucket {
  if (!vac || vac.status === "CONCEPT") return "concept";
  if (vac.status === "PUBLISHED") return "online";
  return "gereed";
}

const TABS: { key: Bucket; label: string; dot: string }[] = [
  { key: "concept", label: "Concept", dot: "bg-ink-400" },
  { key: "gereed", label: "Gereed", dot: "bg-blue-500" },
  { key: "online", label: "Online", dot: "bg-emerald-500" },
];

const STATUS_LABEL: Record<Bucket, { text: string; cls: string }> = {
  concept: { text: "Concept", cls: "bg-ink-100 text-ink-600" },
  gereed: { text: "Gereed voor publicatie", cls: "bg-blue-50 text-blue-700" },
  online: { text: "Online", cls: "bg-emerald-50 text-emerald-700" },
};

export default async function WebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
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
  const counts: Record<Bucket, number> = {
    concept: rows.filter((r) => r.bucket === "concept").length,
    gereed: rows.filter((r) => r.bucket === "gereed").length,
    online: rows.filter((r) => r.bucket === "online").length,
  };

  const validTab = new Set<string>(TABS.map((t) => t.key));
  const active: Bucket = validTab.has(sp.tab ?? "") ? (sp.tab as Bucket) : "concept";
  const visible = rows.filter((r) => r.bucket === active);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures"
        description="Alle openstaande vacatures uit de recruitment-hub. Werk ze hier uit voor de website en maak er een LinkedIn-post van — recruitment blijft leidend."
        actions={
          url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              <Globe className="h-4 w-4" /> {settings?.website}
              <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
            </a>
          ) : undefined
        }
      />

      {/* Tabs — zelfde layout als de Sollicitaties-pagina */}
      <nav
        aria-label="Websitestatus"
        className="flex items-end gap-1 overflow-x-auto border-b border-ink-200"
      >
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={`/website?tab=${t.key}`}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                on
                  ? "border-ink-200 border-b-[#fafafa] bg-white text-ink-900"
                  : "border-transparent text-ink-500 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", t.dot)} />
              {t.label}
              <span
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  on ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500",
                )}
              >
                {counts[t.key]}
              </span>
            </Link>
          );
        })}
      </nav>

      <Card>
        {visible.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            {active === "concept" && "Geen concepten — alles is al uitgewerkt of nog niet aangemaakt."}
            {active === "gereed" && "Niets staat klaar voor publicatie. Werk een concept uit met de AI-tekst."}
            {active === "online" && "Nog niets live op de website. Publiceer een gereed staande vacature."}
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {visible.map(({ d, bucket }) => {
              const company = d.client?.companyName ?? d.company;
              const vac = d.vacancy;
              const status = STATUS_LABEL[bucket];
              const disc = d.discipline ? labelFor(DISCIPLINES, d.discipline) : "";
              return (
                <li key={d.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  {/* Vacature-info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/crm/deals/${d.id}`}
                        className="truncate font-semibold text-ink-900 hover:text-brand-700"
                      >
                        {d.title}
                      </Link>
                      <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", status.cls)}>
                        {status.text}
                      </span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5 text-ink-400" /> {company}
                      </span>
                      {d.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-ink-400" /> {d.location}
                        </span>
                      )}
                      {disc && <span className="text-ink-400">{disc}</span>}
                      {bucket === "online" && (
                        <span className="inline-flex items-center gap-1 text-ink-400">
                          <Eye className="h-3.5 w-3.5" /> {vac?.views ?? 0}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Acties — de doorlopende flow: uitwerken · LinkedIn · sollicitaties */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {vac ? (
                      <Link
                        href={`/vacatures/${vac.id}`}
                        className={iconBtn}
                        title={
                          bucket === "online"
                            ? "Website-tekst bekijken en bijwerken"
                            : "Uitwerken & publiceren op de website"
                        }
                        aria-label="Uitwerken & publiceren"
                      >
                        <Globe className="h-4 w-4" />
                      </Link>
                    ) : (
                      <form action={sendDealToWebsite}>
                        <input type="hidden" name="dealId" value={d.id} />
                        <SubmitButton
                          variant="outline"
                          size="icon"
                          pendingLabel="…"
                          title="Website-tekst maken (AI schrijft)"
                          aria-label="Website-tekst maken"
                        >
                          <Globe className="h-4 w-4" />
                        </SubmitButton>
                      </form>
                    )}

                    <Link
                      href={vac ? `/website/linkedin?vac=${vac.id}` : `/website/linkedin`}
                      className={cn(iconBtn, !vac && "pointer-events-none opacity-40")}
                      title={
                        vac
                          ? "LinkedIn-post maken — tekst staat meteen klaar in de generator"
                          : "Zet eerst de website-tekst klaar"
                      }
                      aria-label="LinkedIn-post maken"
                      aria-disabled={!vac}
                    >
                      <LinkedinIcon className="h-4 w-4" />
                    </Link>

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

                    {bucket === "online" && vac?.slug && (
                      <a
                        href={publicVacancyUrl(vac.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                        title="Bekijk op de website"
                      >
                        Bekijk <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {/* Online/offline schakelen: een live vacature is met één klik
                        van de site te halen en net zo makkelijk weer terug te
                        zetten (status PAUSED <-> PUBLISHED, tekst blijft staan). */}
                    {vac && bucket === "online" && (
                      <form action={pauseVacancy}>
                        <input type="hidden" name="id" value={vac.id} />
                        <input type="hidden" name="from" value="website" />
                        <SubmitButton
                          variant="outline"
                          size="sm"
                          pendingLabel="…"
                          title="Direct van de website halen — de tekst blijft bewaard en je kunt hem altijd terugzetten"
                        >
                          <CloudOff className="h-4 w-4" /> Offline halen
                        </SubmitButton>
                      </form>
                    )}
                    {vac && bucket === "gereed" && (
                      <form action={resumeVacancy}>
                        <input type="hidden" name="id" value={vac.id} />
                        <input type="hidden" name="from" value="website" />
                        <SubmitButton
                          variant="success"
                          size="sm"
                          pendingLabel="…"
                          title="Zet deze vacature (weer) live op q4s.nl"
                        >
                          <CloudUpload className="h-4 w-4" /> Online zetten
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
