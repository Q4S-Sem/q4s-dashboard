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
import { HubCard } from "@/components/ui/hub-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { VACANCY_STATUSES } from "@/lib/domain";
import { pauseVacancy, resumeVacancy, deleteVacancy } from "../vacatures/actions";

export const metadata = { title: "Website" };

/** Turn a stored website value ("www.q4s.nl") into a clickable absolute URL. */
function siteUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default async function WebsitePage() {
  const [settings, vacTotal, vacPublished, cvCount, liveVacancies, viewsAgg] =
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Globe className="h-4 w-4" /> {settings?.website}
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <HubCard
          icon={<FileText className="h-6 w-6" />}
          title="Vacatures"
          description="Alle vacatures voor de website — sorteer en filter op status of discipline, publiceer, pauzeer of haal ze offline."
          href="/website/vacatures"
          cta="Naar vacatures"
          newHref="/vacatures/nieuw"
        />
        <HubCard
          icon={<Inbox className="h-6 w-6" />}
          title="Binnengekomen CV's"
          description="Elke sollicitatie met CV vanaf de website. Sorteer, filter en zet een interessante kandidaat met één klik als lead in de CRM-pijplijn."
          href="/website/cvs"
          cta="Naar CV's"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live op de website</CardTitle>
          <Link href="/vacatures" className="text-sm font-medium text-brand-700 hover:text-brand-800">
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
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {v.title}
                    </Link>
                    {v.vmsConnector && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        via {v.vmsConnector.name}
                      </span>
                    )}
                  </TD>
                  <TD>{formatDate(v.publishedAt)}</TD>
                  <TD>
                    <StatusBadge options={VACANCY_STATUSES} value={v.status} />
                  </TD>
                  <TD className="text-right">
                    <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-slate-900">
                      <Eye className="h-3.5 w-3.5 text-slate-400" />
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
