import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  ExternalLink,
  Check,
  Play,
  Square,
  Users,
  CheckCircle2,
  UserPlus,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { DISCIPLINES, CHALLENGE_STATUSES, labelFor } from "@/lib/domain";
import { parseOptions } from "@/lib/vakproef";
import { deleteChallenge, setChallengeStatus } from "../actions";

export const metadata = { title: "Vakproef" };

export default async function VakproefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const challenge = await db.challenge.findUnique({
    where: { id },
    include: {
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { candidate: true },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!challenge) notFound();

  const options = parseOptions(challenge.optionsJson);
  const totalAttempts = challenge._count.attempts;
  const correctCount = await db.challengeAttempt.count({
    where: { challengeId: id, correct: true },
  });
  const signups = await db.challengeAttempt.count({
    where: { challengeId: id, candidateId: { not: null } },
  });
  const passRate =
    totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/socials/vakproef"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar vakproef
      </Link>

      <PageHeader
        title={challenge.title}
        description={
          challenge.discipline ? labelFor(DISCIPLINES, challenge.discipline) : "Algemeen"
        }
        actions={
          <>
            <StatusBadge options={CHALLENGE_STATUSES} value={challenge.status} />
            <Link
              href={`/socials/vakproef/${challenge.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteChallenge}
              id={challenge.id}
              message={`Vakproef "${challenge.title}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {/* Status actions + public link */}
      <div className="flex flex-wrap items-center gap-2">
        {challenge.status !== "ACTIVE" && (
          <form action={setChallengeStatus}>
            <input type="hidden" name="id" value={challenge.id} />
            <input type="hidden" name="status" value="ACTIVE" />
            <Button type="submit" variant="success" size="sm">
              <Play className="h-4 w-4" /> Activeren
            </Button>
          </form>
        )}
        {challenge.status === "ACTIVE" && (
          <>
            <form action={setChallengeStatus}>
              <input type="hidden" name="id" value={challenge.id} />
              <input type="hidden" name="status" value="CLOSED" />
              <Button type="submit" variant="outline" size="sm">
                <Square className="h-4 w-4" /> Sluiten
              </Button>
            </form>
            <a
              href={`/vakproef/${challenge.slug}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ExternalLink className="h-4 w-4" /> Publieke pagina
            </a>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Deelnemers" value={totalAttempts} icon={<Users className="h-5 w-5" />} accent="brand" />
        <StatCard label={passRate === null ? "Geslaagd" : `Geslaagd (${passRate}%)`} value={correctCount} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <StatCard label="Talentpool-aanmeldingen" value={signups} icon={<UserPlus className="h-5 w-5" />} accent="violet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vraag</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm text-slate-800">
            {challenge.question}
          </p>
          <ul className="space-y-2">
            {options.map((o, i) => {
              const isCorrect = i === challenge.correctIndex;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                    isCorrect
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-700",
                  )}
                >
                  {isCorrect ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                  {o}
                </li>
              );
            })}
          </ul>
          {challenge.explanation && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Toelichting: </span>
              {challenge.explanation}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recente deelnemers</CardTitle>
        </CardHeader>
        {challenge.attempts.length === 0 ? (
          <CardContent className="text-sm text-slate-500">
            Nog geen deelnemers. Zet de vakproef op ACTIEF en deel de publieke link.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Kandidaat</TH>
                <TH>Resultaat</TH>
                <TH>Wanneer</TH>
              </TR>
            </THead>
            <TBody>
              {challenge.attempts.map((a) => (
                <TR key={a.id}>
                  <TD>
                    {a.candidate ? (
                      <Link
                        href={`/kandidaten/${a.candidate.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {a.candidate.firstName} {a.candidate.lastName}
                      </Link>
                    ) : (
                      <span className="text-slate-400">anoniem</span>
                    )}
                  </TD>
                  <TD>
                    {a.correct ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Check className="h-4 w-4" /> Goed
                      </span>
                    ) : (
                      <span className="text-slate-500">Fout</span>
                    )}
                  </TD>
                  <TD>{formatDate(a.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
