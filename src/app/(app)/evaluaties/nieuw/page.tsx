import Link from "next/link";
import { BackLink } from "@/components/back-link";
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

  const [consultants, suggestions, placements] = await Promise.all([
    db.consultant.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    getEvalSuggestions(),
    // De lopende plaatsing per medewerker — daarmee vullen we klant, functie en
    // werklocatie alvast in zodra je iemand kiest.
    db.placement.findMany({
      where: { status: "ACTIVE" },
      orderBy: { startDate: "desc" },
      select: {
        consultantId: true,
        title: true,
        workLocation: true,
        client: {
          select: { companyName: true, address: true, postalCode: true, city: true },
        },
      },
    }),
  ]);
  const now = new Date();

  const prefills: Record<string, Record<string, string>> = {};
  for (const p of placements) {
    if (prefills[p.consultantId]) continue; // meest recente wint
    const address = [p.client?.address, [p.client?.postalCode, p.client?.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    prefills[p.consultantId] = {
      clientName: p.client?.companyName ?? "",
      clientAddress: address,
      functionTitle: p.title,
      workLocation: p.workLocation ?? "",
    };
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href={backHref}>Terug naar evaluaties</BackLink>
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
            prefills={prefills}
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
