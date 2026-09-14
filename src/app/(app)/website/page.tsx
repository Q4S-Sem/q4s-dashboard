import Link from "next/link";
import {
  Globe,
  Briefcase,
  MapPin,
  Sparkles,
  MessageSquarePlus,
  ArrowRight,
  Users,
  ExternalLink,
  FileText,
  Rocket,
  Eye,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { sendDealToWebsite } from "./actions";

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

      <Card>
        <CardHeader className="flex-col items-stretch gap-0 pb-0">
          <CardTitle className="flex items-center gap-2 pb-3">
            <Briefcase className="h-4 w-4 text-brand-600" /> Alle vacatures
            <Link
              href="/crm/vacatures"
              className="ml-auto text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2"
            >
              Naar recruitment
            </Link>
          </CardTitle>

          {/* Tab-switch: Concept · Gereed · Online */}
          <nav className="-mb-px flex gap-1 border-b border-ink-100">
            {TABS.map((t) => {
              const on = t.key === active;
              return (
                <Link
                  key={t.key}
                  href={`/website?tab=${t.key}`}
                  scroll={false}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    on
                      ? "border-brand-600 bg-white text-ink-900"
                      : "border-transparent text-ink-500 hover:text-ink-800",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", t.dot)} />
                  {t.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                      on ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500",
                    )}
                  >
                    {counts[t.key]}
                  </span>
                </Link>
              );
            })}
          </nav>
        </CardHeader>

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

                  {/* Acties — de doorlopende flow: eerst website-tekst, dan LinkedIn */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {vac ? (
                      <Link
                        href={`/vacatures/${vac.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        title="Website-tekst bekijken, aanpassen en publiceren"
                      >
                        {bucket === "online" ? (
                          <>
                            <Sparkles className="h-4 w-4" /> Website-tekst
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4" /> Uitwerken & publiceren
                          </>
                        )}
                      </Link>
                    ) : (
                      <form action={sendDealToWebsite}>
                        <input type="hidden" name="dealId" value={d.id} />
                        <SubmitButton size="sm" pendingLabel="AI schrijft…">
                          <Sparkles className="h-4 w-4" /> Website-tekst maken
                        </SubmitButton>
                      </form>
                    )}

                    <Link
                      href={vac ? `/socials?vac=${vac.id}` : `/socials`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        !vac && "pointer-events-none opacity-40",
                      )}
                      title={vac ? "LinkedIn-post maken met de website-link" : "Zet eerst de website-tekst klaar"}
                      aria-disabled={!vac}
                    >
                      <MessageSquarePlus className="h-4 w-4" /> LinkedIn-post
                    </Link>

                    {vac && (
                      <Link
                        href={`/website/vacatures/${vac.id}/sollicitaties`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        title="Sollicitaties op deze vacature bekijken"
                      >
                        <Users className="h-4 w-4" /> Sollicitaties
                        {vac._count.applications > 0 && (
                          <span className="ml-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                            {vac._count.applications}
                          </span>
                        )}
                      </Link>
                    )}

                    {bucket === "online" && vac?.slug && (
                      <a
                        href={`/vacature/${vac.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                        title="Bekijk op de website"
                      >
                        Bekijk <ArrowRight className="h-3.5 w-3.5" />
                      </a>
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
