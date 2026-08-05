import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { parseJsonMap } from "@/lib/evaluation-forms";
import { getEvalSuggestions } from "@/lib/evaluation-suggestions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EvaluationForm } from "../../EvaluationForm";
import { updateEvaluation } from "../../actions";

export const metadata = { title: "Evaluatie bewerken" };

function toInput(d: Date | null): string {
  if (!d) return "";
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

export default async function EvaluatieBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ev, consultants, suggestions] = await Promise.all([
    db.evaluation.findUnique({ where: { id } }),
    db.consultant.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    getEvalSuggestions(),
  ]);
  if (!ev) notFound();

  const rawScores = parseJsonMap(ev.scoresJson);
  const scores: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawScores)) {
    const n = Number(v);
    if (Number.isFinite(n)) scores[k] = n;
  }
  const rawAnswers = parseJsonMap(ev.answersJson);
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawAnswers)) answers[k] = String(v);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/evaluaties/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar evaluatie
      </Link>
      <PageHeader title="Evaluatie bewerken" />
      <Card>
        <CardContent>
          <EvaluationForm
            action={updateEvaluation}
            consultants={consultants.map((c) => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName}`,
            }))}
            suggestions={suggestions}
            defaults={{ year: ev.year, quarter: ev.quarter }}
            cancelHref={`/evaluaties/${id}`}
            evaluation={{
              id: ev.id,
              consultantId: ev.consultantId,
              type: ev.type,
              status: ev.status,
              year: ev.year,
              quarter: ev.quarter,
              evaluationDate: toInput(ev.evaluationDate),
              clientName: ev.clientName ?? "",
              clientAddress: ev.clientAddress ?? "",
              department: ev.department ?? "",
              reference: ev.reference ?? "",
              functionTitle: ev.functionTitle ?? "",
              workLocation: ev.workLocation ?? "",
              periodText: ev.periodText ?? "",
              evaluatorName: ev.evaluatorName ?? "",
              scores,
              answers,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
