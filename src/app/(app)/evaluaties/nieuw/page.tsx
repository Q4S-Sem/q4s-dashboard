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

/** Wat we uit een plaatsing overnemen in de kop van het evaluatieformulier. */
type PlacementForPrefill = {
  title: string;
  workLocation: string | null;
  client: {
    companyName: string;
    address: string | null;
    postalCode: string | null;
    city: string | null;
  } | null;
};

function placementPrefill(p: PlacementForPrefill): Record<string, string> {
  const address = [p.client?.address, [p.client?.postalCode, p.client?.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return {
    clientName: p.client?.companyName ?? "",
    clientAddress: address,
    functionTitle: p.title,
    workLocation: p.workLocation ?? "",
  };
}

export default async function NieuwEvaluatiePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; placementId?: string }>;
}) {
  const { type, placementId } = await searchParams;
  const presetType =
    type && EVALUATION_TYPE_VALUES.includes(type) ? type : undefined;
  const backHref =
    presetType === "UITZENDKRACHT" ? "/evaluaties/inlener" : "/evaluaties/vcu";

  const [consultants, suggestions, placements, fromPlacement] = await Promise.all([
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
    // Kom je vanuit één specifieke plaatsing (bijv. via de kwartaalevaluatie-taak),
    // dan nemen we de medewerker en de kopgegevens van díe plaatsing over.
    placementId
      ? db.placement.findUnique({
          where: { id: placementId },
          select: {
            consultantId: true,
            title: true,
            workLocation: true,
            consultant: { select: { firstName: true, lastName: true } },
            client: {
              select: { companyName: true, address: true, postalCode: true, city: true },
            },
          },
        })
      : null,
  ]);
  const now = new Date();

  const prefills: Record<string, Record<string, string>> = {};
  for (const p of placements) {
    if (prefills[p.consultantId]) continue; // meest recente wint
    prefills[p.consultantId] = placementPrefill(p);
  }
  const fromPlacementPrefill = fromPlacement ? placementPrefill(fromPlacement) : undefined;
  // De gekozen plaatsing wint van de "meest recente plaatsing"-gok.
  if (fromPlacement && fromPlacementPrefill) prefills[fromPlacement.consultantId] = fromPlacementPrefill;

  const people = consultants.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));
  // Een plaatsing kan (uitzonderlijk) bij een inactieve werknemer horen; zet die dan
  // alsnog in de keuzelijst, zodat de voorgeselecteerde persoon zichtbaar is en er
  // bij opslaan geen dubbele persoon wordt aangemaakt.
  if (fromPlacement && !people.some((p) => p.id === fromPlacement.consultantId)) {
    people.push({
      id: fromPlacement.consultantId,
      name: `${fromPlacement.consultant.firstName} ${fromPlacement.consultant.lastName}`.trim(),
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink href={backHref}>Terug naar evaluaties</BackLink>
      <PageHeader
        title="Nieuwe evaluatie"
        description="Kies het formuliertype en beoordeel een medewerker of inlener."
      />
      <Card>
        <CardContent>
          <EvaluationForm
            action={createEvaluation}
            consultants={people}
            suggestions={suggestions}
            prefills={prefills}
            defaults={{
              year: now.getFullYear(),
              quarter: quarterOf(now),
              type: presetType,
              consultantId: fromPlacement?.consultantId,
              prefill: fromPlacementPrefill,
            }}
            cancelHref={backHref}
          />
        </CardContent>
      </Card>
    </div>
  );
}
