import Link from "next/link";
import {
  Globe,
  Briefcase,
  MapPin,
  Sparkles,
  MessageSquarePlus,
  Send,
  ArrowRight,
  ExternalLink,
  FileText,
  Eye,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
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

/** Websitestatus van een vacature-deal: afgeleid van de gekoppelde Vacancy. */
function statusOf(vac: { status: string } | null): { text: string; cls: string } {
  if (!vac) return { text: "Nog niet klaargezet", cls: "bg-ink-100 text-ink-600" };
  if (vac.status === "PUBLISHED") return { text: "Live op de site", cls: "bg-emerald-50 text-emerald-700" };
  if (vac.status === "PAUSED") return { text: "Gepauzeerd", cls: "bg-amber-50 text-amber-700" };
  return { text: "Concept", cls: "bg-blue-50 text-blue-700" };
}

export default async function WebsitePage() {
  const [settings, openDeals] = await Promise.all([
    db.companySettings.findUnique({ where: { id: "default" } }),
    // Alle openstaande vacatures uit de recruitment-hub (deals zonder kandidaat).
    // Recruitment is leidend; hier werk je ze uit naar website + LinkedIn.
    db.deal.findMany({
      where: { status: "OPEN", candidateId: null },
      orderBy: [{ createdAt: "desc" }],
      include: {
        client: { select: { companyName: true } },
        vacancy: { select: { id: true, status: true, slug: true, views: true } },
      },
    }),
  ]);

  const url = siteUrl(settings?.website);

  const total = openDeals.length;
  const live = openDeals.filter((d) => d.vacancy?.status === "PUBLISHED").length;
  const concept = openDeals.filter(
    (d) => d.vacancy && d.vacancy.status !== "PUBLISHED",
  ).length;
  const todo = openDeals.filter((d) => !d.vacancy).length;

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vacatures" value={total} sub="uit recruitment" icon={<Briefcase className="h-5 w-5" />} accent="brand" />
        <StatCard label="Live op de site" value={live} icon={<Sparkles className="h-5 w-5" />} accent="green" />
        <StatCard label="Concept" value={concept} icon={<FileText className="h-5 w-5" />} accent="slate" />
        <StatCard label="Nog uit te werken" value={todo} icon={<Send className="h-5 w-5" />} accent={todo > 0 ? "amber" : "slate"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-600" /> Alle vacatures
          </CardTitle>
          <Link href="/crm/vacatures" className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2">
            Naar recruitment
          </Link>
        </CardHeader>

        {openDeals.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<Briefcase className="h-6 w-6" />}
              title="Geen openstaande vacatures"
              description="Vacatures die je in de recruitment-hub aanmaakt, verschijnen hier automatisch — klaar om uit te werken voor de website."
            />
          </CardContent>
        ) : (
          <ul className="divide-y divide-ink-100">
            {openDeals.map((d) => {
              const company = d.client?.companyName ?? d.company;
              const vac = d.vacancy;
              const status = statusOf(vac);
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
                      {vac?.status === "PUBLISHED" && (
                        <span className="inline-flex items-center gap-1 text-ink-400">
                          <Eye className="h-3.5 w-3.5" /> {vac.views ?? 0}
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
                        <Sparkles className="h-4 w-4" /> Website-tekst
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

                    {vac?.status === "PUBLISHED" && vac.slug && (
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
