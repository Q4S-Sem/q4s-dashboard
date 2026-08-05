import Link from "next/link";
import { GraduationCap, Plus, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { DISCIPLINES, CHALLENGE_STATUSES, labelFor } from "@/lib/domain";

export const metadata = { title: "Vakproef" };

export default async function VakproefPage() {
  const [challenges, attempts, correct] = await Promise.all([
    db.challenge.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    db.challengeAttempt.groupBy({ by: ["challengeId"], _count: { _all: true } }),
    db.challengeAttempt.groupBy({
      by: ["challengeId"],
      where: { correct: true },
      _count: { _all: true },
    }),
  ]);
  const aMap = new Map(attempts.map((a) => [a.challengeId, a._count._all]));
  const cMap = new Map(correct.map((a) => [a.challengeId, a._count._all]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vakproef"
        description="Een wekelijkse vakinhoudelijke challenge als wervingskanaal. Wie 'm maakt, belandt automatisch in je Talentpool — zelf-selecterend, want alleen echte vakmensen scoren."
        actions={
          <Link href="/socials/vakproef/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe vakproef
          </Link>
        }
      />

      {challenges.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-6 w-6" />}
          title="Nog geen vakproef"
          description="Maak je eerste skills-challenge (bijv. 'Herken de lasfout') en deel 'm op je kanalen."
          action={
            <Link href="/socials/vakproef/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe vakproef
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Titel</TH>
                <TH>Discipline</TH>
                <TH>Status</TH>
                <TH className="text-right">Deelnemers</TH>
                <TH className="text-right">Geslaagd</TH>
                <TH>Publiek</TH>
              </TR>
            </THead>
            <TBody>
              {challenges.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link
                      href={`/socials/vakproef/${c.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {c.title}
                    </Link>
                  </TD>
                  <TD>{c.discipline ? labelFor(DISCIPLINES, c.discipline) : "Algemeen"}</TD>
                  <TD>
                    <StatusBadge options={CHALLENGE_STATUSES} value={c.status} />
                  </TD>
                  <TD className="text-right tabular-nums">{aMap.get(c.id) ?? 0}</TD>
                  <TD className="text-right tabular-nums">{cMap.get(c.id) ?? 0}</TD>
                  <TD>
                    {c.status === "ACTIVE" ? (
                      <a
                        href={`/vakproef/${c.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
                      >
                        Bekijken <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-sm text-ink-400">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
