import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { labelFor, OPPORTUNITY_POTENTIAL, OPPORTUNITY_STATUSES } from "@/lib/domain";
import { CopyButton } from "../CopyButton";
import { deleteOpportunity, setOpportunityStatus } from "../actions";

export const metadata = { title: "Marktkans" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink-900">{value || "—"}</dd>
    </div>
  );
}

export default async function MarktkansDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const opportunity = await db.opportunity.findUnique({ where: { id } });
  if (!opportunity) notFound();

  // Pipeline: show every status except the current one as a quick-move button.
  const moves = OPPORTUNITY_STATUSES.filter((s) => s.value !== opportunity.status);

  return (
    <div className="space-y-6">
      <Link
        href="/marktkansen"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar marktkansen
      </Link>

      {error === "ai" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          AI-actie mislukt. Controleer of ANTHROPIC_API_KEY is ingesteld en probeer
          opnieuw.
        </p>
      )}

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze kans kan op dit moment niet verwijderd worden.
        </p>
      )}

      <PageHeader
        title={opportunity.title}
        actions={
          <>
            <Link
              href={`/marktkansen/${opportunity.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteOpportunity}
              id={opportunity.id}
              message={`Kans "${opportunity.title}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge options={OPPORTUNITY_POTENTIAL} value={opportunity.potential} />
        <StatusBadge options={OPPORTUNITY_STATUSES} value={opportunity.status} />
        <Badge color={opportunity.source === "AI" ? "violet" : "slate"}>
          {opportunity.source === "AI" ? "AI" : "Handmatig"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kerngegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail label="Sector" value={opportunity.sector} />
            <Detail label="Regio" value={opportunity.region} />
            <Detail
              label="Potentieel"
              value={labelFor(OPPORTUNITY_POTENTIAL, opportunity.potential)}
            />
            <Detail
              label="Status"
              value={labelFor(OPPORTUNITY_STATUSES, opportunity.status)}
            />
            <Detail
              label="Bron"
              value={opportunity.source === "AI" ? "AI-gegenereerd" : "Handmatig"}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pijplijn</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {moves.map((m) => (
            <form key={m.value} action={setOpportunityStatus}>
              <input type="hidden" name="id" value={opportunity.id} />
              <input type="hidden" name="status" value={m.value} />
              <Button type="submit" variant="outline" size="sm">
                {m.label}
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Omschrijving</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-ink-700">
            {opportunity.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waarom kansrijk</CardTitle>
        </CardHeader>
        <CardContent>
          {opportunity.rationale ? (
            <p className="whitespace-pre-wrap text-sm text-ink-700">
              {opportunity.rationale}
            </p>
          ) : (
            <p className="text-sm text-ink-500">Nog geen onderbouwing toegevoegd.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Doelbedrijven</CardTitle>
          {opportunity.targetCompanies && (
            <CopyButton text={opportunity.targetCompanies} />
          )}
        </CardHeader>
        <CardContent>
          {opportunity.targetCompanies ? (
            <p className="whitespace-pre-wrap text-sm text-ink-700">
              {opportunity.targetCompanies}
            </p>
          ) : (
            <p className="text-sm text-ink-500">Nog geen doelbedrijven toegevoegd.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
