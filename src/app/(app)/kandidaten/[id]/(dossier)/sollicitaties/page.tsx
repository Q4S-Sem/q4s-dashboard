import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, MessageSquarePlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { APPLICATION_STATUSES, VACANCY_STATUSES } from "@/lib/domain";
import { getCandidate, getMatches } from "../data";
import { SubmitButton } from "@/components/ui/submit-button";
import { createCandidateLinkedOutreach } from "../../../../berichten/actions";

export default async function SollicitatiesTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) notFound();
  const matches = await getMatches(candidate.discipline);

  return (
    <div className="space-y-6">
      {/* Sollicitaties */}
      <Card>
        <CardHeader>
          <CardTitle>Sollicitaties</CardTitle>
        </CardHeader>
        {candidate.applications.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Nog geen sollicitaties voor deze kandidaat.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Vacature</TH>
                <TH>Aangemaakt</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {candidate.applications.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <Link
                      href={`/sollicitaties/${a.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {a.vacancy ? a.vacancy.title : "Open sollicitatie"}
                    </Link>
                  </TD>
                  <TD>{formatDate(a.createdAt)}</TD>
                  <TD>
                    <StatusBadge options={APPLICATION_STATUSES} value={a.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Mogelijke matches */}
      <Card>
        <CardHeader>
          <CardTitle>Mogelijke matches</CardTitle>
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-400">
            <Sparkles className="h-4 w-4" /> Zelfde discipline
          </span>
        </CardHeader>
        {!candidate.discipline ? (
          <CardContent className="text-sm text-ink-500">
            Stel een discipline in om openstaande vacatures te matchen.
          </CardContent>
        ) : matches.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Geen openstaande vacatures binnen deze discipline.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Vacature</TH>
                <TH>Locatie</TH>
                <TH>Status</TH>
                <TH className="text-right">Actie</TH>
              </TR>
            </THead>
            <TBody>
              {matches.map((v) => (
                <TR key={v.id}>
                  <TD>
                    <Link
                      href={`/vacatures/${v.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {v.title}
                    </Link>
                  </TD>
                  <TD>{v.location ?? "—"}</TD>
                  <TD>
                    <StatusBadge options={VACANCY_STATUSES} value={v.status} />
                  </TD>
                  <TD className="text-right">
                    <form action={createCandidateLinkedOutreach}>
                      <input type="hidden" name="candidateId" value={candidate.id} />
                      <input type="hidden" name="vacancyId" value={v.id} />
                      <SubmitButton
                        type="submit"
                        variant="outline"
                        size="sm"
                        pendingLabel="Concept…"
                      >
                        <MessageSquarePlus className="h-4 w-4" /> Concept
                      </SubmitButton>
                    </form>
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
