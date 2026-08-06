import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Check, Download, Archive, CheckCircle2, Printer } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, cn } from "@/lib/utils";
import { scoreLabel, SCORE_SOLID, SCORE_BADGE } from "@/lib/evaluaties";
import {
  getFormDef,
  parseJsonMap,
  averageOfScores,
  type HeaderKey,
} from "@/lib/evaluation-forms";
import { EVALUATION_TYPES, EVALUATION_STATUSES, EVAL_SCORES } from "@/lib/domain";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { deleteEvaluation, archiveEvaluationToDossier } from "../actions";

export const metadata = { title: "Evaluatie" };

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-0.5 text-sm text-ink-800">{value || "—"}</div>
    </div>
  );
}

function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 bg-ink-50 px-3 py-1.5 text-sm font-semibold text-ink-700">{children}</h2>
  );
}

export default async function EvaluatieDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const e = await db.evaluation.findUnique({
    where: { id },
    include: { consultant: { select: { firstName: true, lastName: true } } },
  });
  if (!e) notFound();

  const name = `${e.consultant.firstName} ${e.consultant.lastName}`;
  const def = getFormDef(e.type);
  const scores = parseJsonMap(e.scoresJson);
  const answers = parseJsonMap(e.answersJson);
  const avg = averageOfScores(scores);
  const headerVal: Record<HeaderKey, string | null> = {
    clientName: e.clientName,
    clientAddress: e.clientAddress,
    department: e.department,
    reference: e.reference,
    functionTitle: e.functionTitle,
    workLocation: e.workLocation,
    periodText: e.periodText,
  };
  const str = (k: string) => String(answers[k] ?? "").trim();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <BackLink href="/evaluaties">
          Terug naar evaluaties
        </BackLink>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink-900">{name}</h1>
            <Badge color="slate">Q{e.quarter} · {e.year}</Badge>
            <StatusBadge options={EVALUATION_TYPES} value={e.type} />
            <StatusBadge options={EVALUATION_STATUSES} value={e.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/evaluaties/${e.id}/print`} className={buttonVariants()}>
              <Printer className="h-4 w-4" /> Printen / PDF
            </Link>
            <a
              href={`/evaluaties/${e.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
            <form action={archiveEvaluationToDossier}>
              <input type="hidden" name="id" value={e.id} />
              <SubmitButton variant="secondary" pendingLabel="Opslaan…">
                <Archive className="h-4 w-4" /> Bewaar in dossier
              </SubmitButton>
            </form>
            <Link
              href={`/evaluaties/${e.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit action={deleteEvaluation} id={e.id} message="Deze evaluatie verwijderen?">
              Verwijderen
            </ConfirmSubmit>
          </div>
        </div>

        {saved && (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> De ingevulde evaluatie is als PDF opgeslagen in het
            dossier van {name} (Werknemers → Documenten).
          </p>
        )}
      </div>

      <Card>
        <CardContent className="space-y-8 p-6 sm:p-8">
          <div>
            <div className="text-lg font-bold text-ink-900">{def.title}</div>
            <p className="text-sm text-ink-500">{def.subtitle}</p>
          </div>

          {/* Header fields */}
          <div>
            <SectionBar>{def.subtitle}</SectionBar>
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Medewerker" value={name} />
              {def.headerFields.map((h) => (
                <Info key={h.key} label={h.label} value={headerVal[h.key]} />
              ))}
              <Info label="Datum" value={formatDate(e.evaluationDate)} />
            </div>
          </div>

          {/* Score sections */}
          {def.scoreSections.map((sec) => (
            <div key={sec.title}>
              <SectionBar>{sec.title}</SectionBar>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs font-semibold uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-2 text-left">Criterium</th>
                    {EVAL_SCORES.map((s) => (
                      <th key={s.value} className="px-2 py-2 text-center">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {sec.criteria.map((crit) => {
                    const val = Number(scores[crit.key]);
                    return (
                      <tr key={crit.key}>
                        <td className="py-2.5 pr-2 text-ink-700">{crit.label}</td>
                        {EVAL_SCORES.map((s) => {
                          const on = val === Number(s.value);
                          return (
                            <td key={s.value} className="px-2 py-2.5 text-center">
                              <span
                                className={cn(
                                  "inline-flex h-6 w-6 items-center justify-center rounded-full",
                                  on ? cn(SCORE_SOLID[Number(s.value)], "text-white") : "bg-ink-100",
                                )}
                              >
                                {on && <Check className="h-3.5 w-3.5" />}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {str(sec.noteKey) && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700">
                  <span className="font-medium text-ink-500">Toelichting: </span>
                  {str(sec.noteKey)}
                </p>
              )}
            </div>
          ))}

          {/* Gemiddelde */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              Gemiddelde score
            </span>
            <p className="mt-1">
              {avg !== null ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-sm font-semibold ring-1 ring-inset",
                    SCORE_BADGE[Math.round(avg)],
                  )}
                >
                  {avg.toLocaleString("nl-NL")} / 4 · {scoreLabel(Math.round(avg))}
                </span>
              ) : (
                <span className="text-sm text-ink-400">—</span>
              )}
            </p>
          </div>

          {/* Closing: free text + yes/no */}
          {(def.textFields.length > 0 || def.boolQuestions.length > 0) && (
            <div>
              <SectionBar>{def.closingTitle ?? "Afronding"}</SectionBar>
              <div className="space-y-3">
                {def.textFields.map((t) => (
                  <Info key={t.key} label={t.label} value={str(t.key)} />
                ))}
                {def.boolQuestions.map((b) => {
                  const v = str(b.key);
                  return (
                    <div key={b.key} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ink-700">{b.label}</span>
                      {v === "ja" ? (
                        <Badge color="green">Ja</Badge>
                      ) : v === "nee" ? (
                        <Badge color="red">Nee</Badge>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {str(def.closingNoteKey) && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700">
                  <span className="font-medium text-ink-500">Toelichting: </span>
                  {str(def.closingNoteKey)}
                </p>
              )}
            </div>
          )}

          <div className="border-t border-ink-100 pt-4 text-sm text-ink-600">
            {def.evaluatorLabel}:{" "}
            <span className="font-medium text-ink-900">{e.evaluatorName || "—"}</span>
            {e.evaluationDate && <> · {formatDate(e.evaluationDate)}</>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
