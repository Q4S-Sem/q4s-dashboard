import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  Sparkles,
  Filter,
  Users,
  Target,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  DISCIPLINES,
  VACANCY_STATUSES,
  VACANCY_SOURCES,
  VACANCY_RELEVANCE,
  APPLICATION_STATUSES,
  labelFor,
} from "@/lib/domain";
import { isAIConfigured } from "@/lib/ai";
import { formatDate, formatDateLong } from "@/lib/utils";
import { CopyButton } from "../CopyButton";
import {
  deleteVacancy,
  improveVacancy,
  publishVacancy,
  unpublishVacancy,
  filterRelevance,
  rematchVacancyMatches,
} from "../actions";
import { startSourcing } from "../../website/actions";

export const metadata = { title: "Vacature" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default async function VacatureDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const vacancy = await db.vacancy.findUnique({
    where: { id },
    include: {
      client: true,
      applications: {
        include: { candidate: true },
        orderBy: { createdAt: "desc" },
      },
      matches: {
        include: { candidate: true },
        orderBy: { score: "desc" },
        take: 10,
      },
    },
  });

  if (!vacancy) notFound();

  const aiReady = isAIConfigured();
  const company = vacancy.client?.companyName ?? vacancy.companyName ?? null;
  const isPublished = vacancy.status === "PUBLISHED";
  const hasImproved = Boolean(vacancy.improvedText);
  // Publishable as soon as there's website content (structured sections or full text).
  const hasContent = Boolean(
    vacancy.improvedText ||
      vacancy.summary ||
      vacancy.responsibilities ||
      vacancy.requirements,
  );

  return (
    <div className="space-y-6">
      <Link
        href="/vacatures"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar vacatures
      </Link>

      <PageHeader
        title={vacancy.title}
        description={[company, labelFor(DISCIPLINES, vacancy.discipline)]
          .filter((v) => v && v !== "—")
          .join(" · ")}
        actions={
          <>
            <StatusBadge options={VACANCY_STATUSES} value={vacancy.status} />
            {vacancy.sourcing ? (
              <Link href="/website/cvs/matches" className={buttonVariants({ variant: "outline" })}>
                <Target className="h-4 w-4" /> Op matchpagina
              </Link>
            ) : (
              <form action={startSourcing}>
                <input type="hidden" name="vacancyId" value={vacancy.id} />
                <SubmitButton pendingLabel="Bezig…">
                  <Users className="h-4 w-4" /> Ik zoek kandidaten
                </SubmitButton>
              </form>
            )}
            <Link
              href={`/vacatures/${vacancy.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteVacancy}
              id={vacancy.id}
              message={`Vacature "${vacancy.title}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {error === "ai" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          AI-actie mislukt. Controleer of ANTHROPIC_API_KEY is ingesteld en
          probeer opnieuw.
        </p>
      )}

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze vacature kan op dit moment niet verwijderd worden.
        </p>
      )}

      {/* AI / publicatie-acties */}
      <Card>
        <CardContent className="space-y-4">
          {!aiReady && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Stel ANTHROPIC_API_KEY in je .env in om AI-functies te gebruiken.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {aiReady && (
              <form action={improveVacancy}>
                <input type="hidden" name="id" value={vacancy.id} />
                <SubmitButton pendingLabel="AI is bezig…">
                  <Sparkles className="h-4 w-4" />
                  {hasImproved ? "Opnieuw verbeteren" : "Verbeter met AI"}
                </SubmitButton>
              </form>
            )}

            {aiReady && (
              <form action={filterRelevance}>
                <input type="hidden" name="id" value={vacancy.id} />
                <SubmitButton variant="outline" pendingLabel="AI is bezig…">
                  <Filter className="h-4 w-4" /> Beoordeel relevantie (AI)
                </SubmitButton>
              </form>
            )}

            {!isPublished && hasContent && (
              <form action={publishVacancy}>
                <input type="hidden" name="id" value={vacancy.id} />
                <SubmitButton variant="success">Publiceren</SubmitButton>
              </form>
            )}

            {isPublished && (
              <>
                <Link
                  href={`/vacature/${vacancy.slug}`}
                  target="_blank"
                  className={buttonVariants({ variant: "outline" })}
                >
                  <ExternalLink className="h-4 w-4" /> Bekijk publieke pagina
                </Link>
                <form action={unpublishVacancy}>
                  <input type="hidden" name="id" value={vacancy.id} />
                  <SubmitButton variant="outline">Depubliceren</SubmitButton>
                </form>
              </>
            )}
          </div>

          {isPublished && vacancy.publishedAt && (
            <p className="text-xs text-slate-500">
              Gepubliceerd op {formatDateLong(vacancy.publishedAt)}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Meta-gegevens */}
      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail
              label="Klant / bedrijf"
              value={
                vacancy.client ? (
                  <Link
                    href={`/klanten/${vacancy.client.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {vacancy.client.companyName}
                  </Link>
                ) : (
                  company
                )
              }
            />
            <Detail
              label="Discipline"
              value={labelFor(DISCIPLINES, vacancy.discipline)}
            />
            <Detail label="Plaats" value={vacancy.location} />
            <Detail label="Dienstverband" value={vacancy.employmentType} />
            <Detail label="Salaris" value={vacancy.salary} />
            <Detail
              label="Bron"
              value={
                <StatusBadge options={VACANCY_SOURCES} value={vacancy.source} />
              }
            />
            <Detail
              label="Relevantie"
              value={
                <StatusBadge
                  options={VACANCY_RELEVANCE}
                  value={vacancy.relevance}
                />
              }
            />
          </dl>
          {vacancy.relevanceReason && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Onderbouwing relevantie
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {vacancy.relevanceReason}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Origineel */}
      <Card>
        <CardHeader>
          <CardTitle>Origineel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {vacancy.rawText}
          </p>
        </CardContent>
      </Card>

      {/* Sollicitaties */}
      <Card>
        <CardHeader>
          <CardTitle>Sollicitaties</CardTitle>
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
            <Users className="h-4 w-4" /> {vacancy.applications.length}
          </span>
        </CardHeader>
        {vacancy.applications.length === 0 ? (
          <CardContent className="text-sm text-slate-500">
            Nog geen sollicitaties op deze vacature.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Kandidaat</TH>
                <TH>Discipline</TH>
                <TH>Ontvangen</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {vacancy.applications.map((app) => (
                <TR key={app.id}>
                  <TD>
                    <Link
                      href={`/sollicitaties/${app.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {app.candidate.firstName} {app.candidate.lastName}
                    </Link>
                  </TD>
                  <TD>{labelFor(DISCIPLINES, app.candidate.discipline)}</TD>
                  <TD>{formatDate(app.createdAt)}</TD>
                  <TD>
                    <StatusBadge
                      options={APPLICATION_STATUSES}
                      value={app.status}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Kandidaat-matches (met percentage) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" /> Kandidaat-matches
            <span className="text-xs font-normal text-slate-400">({vacancy.matches.length})</span>
          </CardTitle>
          <form action={rematchVacancyMatches}>
            <input type="hidden" name="id" value={vacancy.id} />
            <SubmitButton variant="outline" size="sm" pendingLabel="Matchen…">
              Matches verversen
            </SubmitButton>
          </form>
        </CardHeader>
        {vacancy.matches.length === 0 ? (
          <CardContent className="text-sm text-slate-500">
            Nog geen matches uit de talentpool. Klik op &ldquo;Matches verversen&rdquo; om te zoeken;
            de AI scoort kandidaten daarna tegen de eisen van deze vacature.
          </CardContent>
        ) : (
          <CardContent className="space-y-3">
            {vacancy.matches.map((m) => {
              const pct = Math.round(m.score * 100);
              return (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/kandidaten/${m.candidate.id}`}
                      className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700"
                    >
                      {m.candidate.firstName} {m.candidate.lastName}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {[labelFor(DISCIPLINES, m.candidate.discipline), m.reason]
                        .filter((x) => x && x !== "—")
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-700">
                      {pct}%
                    </span>
                  </span>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* Samenvatting */}
      {vacancy.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Samenvatting</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">{vacancy.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Verbeterde vacaturetekst */}
      {vacancy.improvedText && (
        <Card>
          <CardHeader>
            <CardTitle>Verbeterde vacaturetekst</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {vacancy.improvedText}
            </p>
          </CardContent>
        </Card>
      )}

      {/* LinkedIn-post */}
      {vacancy.linkedinPost && (
        <Card>
          <CardHeader>
            <CardTitle>LinkedIn-post</CardTitle>
            <CopyButton text={vacancy.linkedinPost} label="Kopieer post" />
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {vacancy.linkedinPost}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
