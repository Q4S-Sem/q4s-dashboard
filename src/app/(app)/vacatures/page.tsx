import Link from "next/link";
import {
  FileText,
  Plus,
  Upload,
  Eye,
  Rocket,
  PencilRuler,
  ExternalLink,
  Pause,
  Play,
  CheckCircle2,
  AlertTriangle,
  Send,
  MapPin,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { DISCIPLINES, VACANCY_STATUSES } from "@/lib/domain";
import { publishVacancy, pauseVacancy, resumeVacancy } from "./actions";

export const metadata = { title: "Vacatures" };
export const dynamic = "force-dynamic";

type SP = { error?: string };

// De secties die een vacature nodig heeft voor een volwaardige pagina op de
// website ("Over de functie", "Werkzaamheden", "Functie-eisen").
const WEBSITE_FIELDS = ["summary", "responsibilities", "requirements"] as const;
type WebsiteVacancy = Record<(typeof WEBSITE_FIELDS)[number], string | null>;

function completeness(v: WebsiteVacancy) {
  const filled = WEBSITE_FIELDS.filter((f) => (v[f] ?? "").trim().length > 0).length;
  return { filled, total: WEBSITE_FIELDS.length, complete: filled === WEBSITE_FIELDS.length };
}

export default async function VacaturesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const vacancies = await db.vacancy.findMany({ orderBy: { createdAt: "desc" } });

  const total = vacancies.length;
  const liveVacancies = vacancies.filter((v) => v.status === "PUBLISHED");
  const pipeline = vacancies.filter((v) => v.status !== "PUBLISHED");
  const totalViews = vacancies.reduce((s, v) => s + (v.views ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures"
        description="Beheer je vacatures en stuur ze met één klik naar de vacaturehub op de website — inclusief alle informatie die de vacature nodig heeft."
        actions={
          <>
            <Link
              href="/vacatures/importeren"
              className={buttonVariants({ variant: "outline" })}
            >
              <Upload className="h-4 w-4" /> Importeren
            </Link>
            <Link href="/vacatures/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe vacature
            </Link>
          </>
        }
      />

      {sp.error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze vacature kan op dit moment niet verwijderd worden.
        </p>
      )}

      {/* Kerncijfers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vacatures totaal" value={total} icon={<FileText className="h-5 w-5" />} accent="slate" />
        <StatCard label="Live op de site" value={liveVacancies.length} accent="green" icon={<Rocket className="h-5 w-5" />} />
        <StatCard label="Nog te versturen" value={pipeline.length} accent="amber" icon={<PencilRuler className="h-5 w-5" />} />
        <StatCard
          label="Weergaven via website"
          value={totalViews}
          sub="kliks op gepubliceerde vacatures"
          accent="slate"
          icon={<Eye className="h-5 w-5" />}
        />
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Nog geen vacatures"
          description="Voeg een binnengekomen vacature toe en laat de AI deze uitschrijven en verbeteren."
          action={
            <Link href="/vacatures/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe vacature
            </Link>
          }
        />
      ) : (
        <>
          {/* Live op de website — overzicht van wat momenteel openstaat */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-emerald-600" /> Live op de website
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {liveVacancies.length}
                </span>
              </CardTitle>
              <Link
                href="/website"
                className="shrink-0 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                Website &amp; kliks →
              </Link>
            </CardHeader>
            {liveVacancies.length === 0 ? (
              <CardContent className="py-8 text-center text-sm text-slate-400">
                Nog geen vacatures live. Stuur er hieronder één naar de website.
              </CardContent>
            ) : (
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {liveVacancies.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-col rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/vacatures/${v.id}`}
                        className="font-semibold text-slate-900 hover:text-emerald-700"
                      >
                        {v.title}
                      </Link>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-slate-500">
                        <Eye className="h-3.5 w-3.5" /> {v.views ?? 0}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {v.discipline && <StatusBadge options={DISCIPLINES} value={v.discipline} />}
                      {v.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" /> {v.location}
                        </span>
                      )}
                    </div>
                    {v.publishedAt && (
                      <p className="mt-2 text-xs text-slate-400">
                        Live sinds {formatDate(v.publishedAt)}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
                      <a
                        href={`/vacature/${v.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Bekijk op site
                      </a>
                      <span className="ml-auto">
                        <ConfirmSubmit
                          action={pauseVacancy}
                          id={v.id}
                          hidden={{ from: "list" }}
                          variant="outline"
                          size="sm"
                          message={`"${v.title}" pauzeren? De vacature verdwijnt direct van de website.`}
                        >
                          <Pause className="h-3.5 w-3.5" /> Pauzeren
                        </ConfirmSubmit>
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {/* Klaar om te versturen — pijplijn met publiceer-actie + volledigheidscheck */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-4 w-4 text-slate-500" /> Klaar om te versturen
              </CardTitle>
            </CardHeader>
            {pipeline.length === 0 ? (
              <CardContent className="py-8 text-center text-sm text-slate-400">
                Alle vacatures staan live op de website.
              </CardContent>
            ) : (
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Titel</TH>
                    <TH>Discipline</TH>
                    <TH>Plaats</TH>
                    <TH>Volledigheid</TH>
                    <TH>Status</TH>
                    <TH className="text-right">
                      <span className="sr-only">Acties</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {pipeline.map((v) => {
                    const c = completeness(v);
                    const paused = v.status === "PAUSED";
                    return (
                      <TR key={v.id}>
                        <TD>
                          <Link
                            href={`/vacatures/${v.id}`}
                            className="font-medium text-slate-900 hover:text-emerald-700"
                          >
                            {v.title}
                          </Link>
                        </TD>
                        <TD>
                          {v.discipline ? (
                            <StatusBadge options={DISCIPLINES} value={v.discipline} />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TD>
                        <TD className="text-slate-600">{v.location ?? "—"}</TD>
                        <TD>
                          {c.complete ? (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" /> Compleet
                            </span>
                          ) : (
                            <Link
                              href={`/vacatures/${v.id}/bewerken`}
                              title="Samenvatting, werkzaamheden en/of functie-eisen ontbreken nog"
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:underline"
                            >
                              <AlertTriangle className="h-4 w-4" /> Vul aan ({c.filled}/{c.total})
                            </Link>
                          )}
                        </TD>
                        <TD>
                          <StatusBadge options={VACANCY_STATUSES} value={v.status} />
                        </TD>
                        <TD>
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/vacatures/${v.id}/bewerken`}
                              className="text-sm font-medium text-slate-500 hover:text-slate-900"
                            >
                              Bewerken
                            </Link>
                            {paused ? (
                              <form action={resumeVacancy}>
                                <input type="hidden" name="id" value={v.id} />
                                <input type="hidden" name="from" value="list" />
                                <SubmitButton variant="success" size="sm" pendingLabel="Bezig…">
                                  <Play className="h-3.5 w-3.5" /> Hervatten
                                </SubmitButton>
                              </form>
                            ) : (
                              <ConfirmSubmit
                                action={publishVacancy}
                                id={v.id}
                                hidden={{ from: "list" }}
                                variant="success"
                                size="sm"
                                message={
                                  c.complete
                                    ? `"${v.title}" nu live op de website zetten?`
                                    : `Let op: deze vacature mist nog info (${c.filled}/${c.total} secties ingevuld). Toch live zetten?`
                                }
                              >
                                <Rocket className="h-3.5 w-3.5" /> Naar website
                              </ConfirmSubmit>
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
        </>
      )}
    </div>
  );
}
