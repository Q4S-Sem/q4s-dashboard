import Link from "next/link";
import {
  Target,
  TrendingUp,
  Trophy,
  Sparkles,
  ArrowRight,
  Plus,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { OPPORTUNITY_STATUSES, OPPORTUNITY_POTENTIAL } from "@/lib/domain";
import { isAIConfigured } from "@/lib/ai";

export const metadata = { title: "Analyses" };

export default async function AnalysesPage() {
  const [total, pursuing, won, highPotential, recent] = await Promise.all([
    db.opportunity.count(),
    db.opportunity.count({ where: { status: "PURSUING" } }),
    db.opportunity.count({ where: { status: "WON" } }),
    db.opportunity.count({ where: { potential: "HOOG" } }),
    db.opportunity.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analyses"
        description="Ontdek waar Q4S kan groeien: nieuwe sectoren, projecten en regio's binnen QA, QC, lassen, fitters en NDO."
        actions={
          <Link href="/marktkansen" className={buttonVariants()}>
            <Target className="h-4 w-4" /> Naar marktkansen
          </Link>
        }
      />

      {!isAIConfigured() && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Tip:</strong> stel <code>DEEPSEEK_API_KEY</code> in je{" "}
          <code>.env</code> in om met AI automatisch marktkansen te laten
          genereren.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kansen totaal" value={total} icon={<Target className="h-5 w-5" />} accent="brand" />
        <StatCard label="Hoog potentieel" value={highPotential} icon={<TrendingUp className="h-5 w-5" />} accent="green" />
        <StatCard label="Actief oppakken" value={pursuing} icon={<Sparkles className="h-5 w-5" />} accent="violet" />
        <StatCard label="Gewonnen" value={won} icon={<Trophy className="h-5 w-5" />} accent="amber" />
      </div>

      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink-900">
            Laat AI nieuwe kansen vinden
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            De AI denkt mee als strategisch adviseur en stelt concrete
            groeirichtingen voor — nieuwe sectoren (scheepsbouw, offshore,
            petrochemie), regio's en doelbedrijven — die je daarna in je pijplijn
            kunt opvolgen.
          </p>
        </div>
        <Link href="/marktkansen" className={buttonVariants()}>
          <Sparkles className="h-4 w-4" /> Kansen genereren
        </Link>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recente kansen</CardTitle>
          <Link href="/marktkansen" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Alle marktkansen <ArrowRight className="inline h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        {recent.length === 0 ? (
          <CardContent className="flex items-center justify-between text-sm text-ink-500">
            <span>Nog geen marktkansen.</span>
            <Link href="/marktkansen/nieuw" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Plus className="h-4 w-4" /> Nieuwe kans
            </Link>
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Kans</TH>
                <TH>Sector</TH>
                <TH>Potentieel</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {recent.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <Link href={`/marktkansen/${o.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {o.title}
                    </Link>
                  </TD>
                  <TD>{o.sector ?? "—"}</TD>
                  <TD>
                    <StatusBadge options={OPPORTUNITY_POTENTIAL} value={o.potential} />
                  </TD>
                  <TD>
                    <StatusBadge options={OPPORTUNITY_STATUSES} value={o.status} />
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
