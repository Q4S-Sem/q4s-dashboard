import Link from "next/link";
import {
  Globe,
  FileText,
  Sparkles,
  ExternalLink,
  Eye,
  Pause,
  Play,
  Trash2,
  Inbox,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { VACANCY_STATUSES } from "@/lib/domain";
import { pauseVacancy, resumeVacancy, deleteVacancy } from "../vacatures/actions";
import { sendDealToWebsite } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Briefcase, MapPin, ArrowRight, Send } from "lucide-react";

export const metadata = { title: "Website" };

/** Turn a stored website value ("www.q4s.nl") into a clickable absolute URL. */
function siteUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default async function WebsitePage() {
  const [settings, vacTotal, vacPublished, cvCount, liveVacancies, viewsAgg, openDeals] =
    await Promise.all([
      db.companySettings.findUnique({ where: { id: "default" } }),
      db.vacancy.count(),
      db.vacancy.count({ where: { status: "PUBLISHED" } }),
      db.candidate.count({ where: { cvFileName: { not: null } } }),
      // Published + paused — both are managed here; paused are off the public site.
      db.vacancy.findMany({
        where: { status: { in: ["PUBLISHED", "PAUSED"] } },
        orderBy: [{ status: "asc" }, { views: "desc" }, { publishedAt: "desc" }],
        include: { vmsConnector: { select: { name: true } } },
      }),
      db.vacancy.aggregate({
        where: { status: "PUBLISHED" },
        _sum: { views: true },
      }),
      // Openstaande vacatures uit de recruitment-hub (deals zonder kandidaat).
      // Recruitment is leidend; hier zie je hun status richting de website.
      db.deal.findMany({
        where: { status: "OPEN", candidateId: null },
        orderBy: [{ createdAt: "desc" }],
        include: {
          client: { select: { companyName: true } },
          vacancy: { select: { id: true, status: true, slug: true } },
        },
      }),
    ]);

  const url = siteUrl(settings?.website);
  const totalViews = viewsAgg._sum.views ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website"
        description="Alles wat richting de publieke website gaat: vacatures publiceren en beheren wat live staat op q4s.nl."
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
        <StatCard label="Vacatures totaal" value={vacTotal} icon={<FileText className="h-5 w-5" />} accent="brand" />
        <StatCard label="Live op de site" value={vacPublished} icon={<Sparkles className="h-5 w-5" />} accent="green" />
        <StatCard label="CV's binnengekomen" value={cvCount} sub="via de website" icon={<Inbox className="h-5 w-5" />} accent="slate" />
        <StatCard
          label="Weergaven via website"
          value={totalViews}
          sub="kliks op gepubliceerde vacatures"
          icon={<Eye className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      {/* Openstaande vacatures uit de recruitment-hub */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-600" /> Openstaande vacatures (recruitment)
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
              description="Vacatures die je in de recruitment-hub aanmaakt, verschijnen hier automatisch — klaar om naar de website te sturen."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Vacature</TH>
                <TH>Bedrijf</TH>
                <TH>Websitestatus</TH>
                <TH className="text-right">Actie</TH>
              </TR>
            </THead>
            <TBody>
              {openDeals.map((d) => {
                const company = d.client?.companyName ?? d.company;
                const vac = d.vacancy;
                const websiteLabel = !vac
                  ? { text: "Nog niet klaargezet", cls: "bg-ink-100 text-ink-600" }
                  : vac.status === "PUBLISHED"
                    ? { text: "Live op de site", cls: "bg-emerald-50 text-emerald-700" }
                    : vac.status === "PAUSED"
                      ? { text: "Gepauzeerd", cls: "bg-amber-50 text-amber-700" }
                      : { text: "Concept", cls: "bg-blue-50 text-blue-700" };
                return (
                  <TR key={d.id}>
                    <TD>
                      <Link href={`/crm/deals/${d.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {d.title}
                      </Link>
                      {d.location && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-400">
                          <MapPin className="h-3 w-3" /> {d.location}
                        </span>
                      )}
                    </TD>
                    <TD className="text-ink-700">{company}</TD>
                    <TD>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${websiteLabel.cls}`}>
                        {websiteLabel.text}
                      </span>
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end">
                        {vac ? (
                          <Link
                            href={`/vacatures/${vac.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                          >
                            Uitwerken <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <form action={sendDealToWebsite}>
                            <input type="hidden" name="dealId" value={d.id} />
                            <SubmitButton variant="outline" size="sm" pendingLabel="Bezig…">
                              <Send className="h-4 w-4" /> Naar website
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live op de website</CardTitle>
          <Link href="/vacatures" className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2">
            Alle vacatures
          </Link>
        </CardHeader>
        {liveVacancies.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<Globe className="h-6 w-6" />}
              title="Nog niets gepubliceerd"
              description="Zodra je een vacature publiceert, verschijnt hij hier én op de publieke website."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Titel</TH>
                <TH>Gepubliceerd</TH>
                <TH>Status</TH>
                <TH className="text-right">Weergaven</TH>
                <TH className="text-right">Acties</TH>
              </TR>
            </THead>
            <TBody>
              {liveVacancies.map((v) => (
                <TR key={v.id}>
                  <TD>
                    <Link
                      href={`/vacatures/${v.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {v.title}
                    </Link>
                    {v.vmsConnector && (
                      <span className="ml-2 inline-flex items-center rounded-sm bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                        via {v.vmsConnector.name}
                      </span>
                    )}
                  </TD>
                  <TD>{formatDate(v.publishedAt)}</TD>
                  <TD>
                    <StatusBadge options={VACANCY_STATUSES} value={v.status} />
                  </TD>
                  <TD className="text-right">
                    <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-ink-900">
                      <Eye className="h-3.5 w-3.5 text-ink-400" />
                      {v.views ?? 0}
                    </span>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      {v.status === "PUBLISHED" ? (
                        <>
                          <a
                            href={`/vacature/${v.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                            title="Bekijk op de website"
                          >
                            Bekijk <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <ConfirmSubmit
                            action={pauseVacancy}
                            id={v.id}
                            hidden={{ from: "website" }}
                            message={`Vacature "${v.title}" pauzeren? Hij gaat direct offline op de website.`}
                            variant="outline"
                            size="sm"
                          >
                            <Pause className="h-4 w-4" /> Pauzeren
                          </ConfirmSubmit>
                        </>
                      ) : (
                        <ConfirmSubmit
                          action={resumeVacancy}
                          id={v.id}
                          hidden={{ from: "website" }}
                          message={`Vacature "${v.title}" hervatten? Hij gaat direct weer live op de website.`}
                          variant="success"
                          size="sm"
                        >
                          <Play className="h-4 w-4" /> Hervatten
                        </ConfirmSubmit>
                      )}
                      <ConfirmSubmit
                        action={deleteVacancy}
                        id={v.id}
                        message={`Vacature "${v.title}" verwijderen? Dit haalt hem ook direct van de website.`}
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
