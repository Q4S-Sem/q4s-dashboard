import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { quarterOf } from "@/lib/evaluaties";
import { getEvalSuggestions } from "@/lib/evaluation-suggestions";
import { EVALUATION_TYPE_VALUES } from "@/lib/domain";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EvaluationForm } from "../EvaluationForm";
import { createEvaluation } from "../actions";

export const metadata = { title: "Nieuwe evaluatie" };
export const dynamic = "force-dynamic"; // always show the current medewerker/klant list

export default async function NieuwEvaluatiePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const presetType =
    type && EVALUATION_TYPE_VALUES.includes(type) ? type : undefined;
  const backHref =
    presetType === "UITZENDKRACHT" ? "/evaluaties/inlener" : "/evaluaties/vcu";

  const [consultants, suggestions] = await Promise.all([
    db.consultant.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    getEvalSuggestions(),
  ]);
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar evaluaties
      </Link>
      <PageHeader
        title="Nieuwe evaluatie"
        description="Kies het formuliertype en beoordeel een medewerker of inlener."
      />
      <Card>
        <CardContent>
          <EvaluationForm
            action={createEvaluation}
            consultants={consultants.map((c) => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName}`,
            }))}
            suggestions={suggestions}
            defaults={{
              year: now.getFullYear(),
              quarter: quarterOf(now),
              type: presetType,
            }}
            cancelHref={backHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}
