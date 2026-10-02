import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { EMPLOYMENT_TYPES, labelFor, type BadgeColor } from "@/lib/domain";
import {
  DOSSIER_REQUIREMENTS,
  EVALUATION_MAX_AGE_MONTHS,
  checkDossiers,
  dossierHref,
  type DossierStatus,
} from "@/lib/dossier-check";
import { loadDossierPeople } from "@/lib/dossier-data";

export const metadata = { title: "Dossiercheck (NEN 4400 / Kiwa)" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<DossierStatus, { label: string; color: BadgeColor }> = {
  red: { label: "Niet auditproof", color: "red" },
  amber: { label: "Vraagt aandacht", color: "amber" },
  green: { label: "In orde", color: "green" },
};

/**
 * Dossiercheck (NEN 4400 / Kiwa): per actieve medewerker of gedetacheerde welke
 * verplichte dossierstukken ontbreken of verlopen zijn. Puur een LEESLIJST — deze
 * pagina vraagt niets op, mailt niets en wijzigt geen dossier of status; de
 * beoordeling zelf komt uit de pure check in src/lib/dossier-check.ts.
 */
export default async function DossiercheckPage() {
  const checks = checkDossiers(await loadDossierPeople(), new Date());
  const count = (status: DossierStatus) => checks.filter((c) => c.status === status).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dossiercheck (NEN 4400 / Kiwa)"
        description="Is elk personeelsdossier compleet? Per persoon zie je welke verplichte stukken ontbreken of verlopen zijn, zodat je ze vóór een audit kunt opvragen. Deze pagina leest alleen — opvragen en bijwerken doe je zelf in het dossier."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Dossiers gecontroleerd" value={checks.length} icon={<Users className="h-5 w-5" />} accent="brand" />
        <StatCard
          label="Niet auditproof"
          value={count("red")}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={count("red") ? "red" : "slate"}
        />
        <StatCard
          label="Vraagt aandacht"
          value={count("amber")}
          icon={<ShieldCheck className="h-5 w-5" />}
          accent={count("amber") ? "amber" : "slate"}
        />
        <StatCard label="In orde" value={count("green")} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
      </div>

      {checks.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Geen actieve dossiers"
          description="Zodra er actieve werknemers of medewerkers zijn, verschijnen ze hier met hun dossierstatus."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-ink-400" /> Dossiers ({checks.length})
            </CardTitle>
            <span className="text-sm text-ink-400">slechtste eerst</span>
          </CardHeader>
          <div className="divide-y divide-ink-100">
            {checks.map((check) => (
              <div key={`${check.kind}-${check.id}`} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={dossierHref(check)} className="font-semibold text-ink-900 hover:text-brand-700">
                    {check.name}
                  </Link>
                  <Badge color={STATUS_META[check.status].color}>{STATUS_META[check.status].label}</Badge>
                  <span className="text-xs text-ink-400">
                    {check.kind === "consultant" ? "Gedetacheerd" : "Eigen medewerker"} ·{" "}
                    {labelFor(EMPLOYMENT_TYPES, check.employmentType)}
                  </span>
                </div>
                {check.issues.length === 0 ? (
                  <p className="mt-0.5 text-xs text-emerald-700">
                    Alle {check.items.length} verplichte stukken aanwezig en geldig.
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {check.issues.map((issue) => (
                      <li key={issue.key} className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge color={issue.severity === "hard" ? "red" : "amber"}>
                          {issue.status === "expired" ? "VERLOPEN" : "ONTBREEKT"}
                        </Badge>
                        <span className="font-medium text-ink-700">{issue.label}</span>
                        {issue.detail && <span className="text-ink-400">— {issue.detail}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-ink-400" /> Wat controleren we?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-600">
          <ul className="space-y-1">
            {DOSSIER_REQUIREMENTS.map((requirement) => (
              <li key={requirement.key} className="flex flex-wrap items-center gap-2">
                <Badge color={requirement.severity === "hard" ? "red" : "amber"}>
                  {requirement.severity === "hard" ? "ROOD" : "ORANJE"}
                </Badge>
                {requirement.label}
                {requirement.key === "KVK" && (
                  <span className="text-xs text-ink-400">— alleen bij ZZP/freelance</span>
                )}
                {requirement.key === "EVALUATION" && (
                  <span className="text-xs text-ink-400">— alleen bij gedetacheerden</span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-400">
            Rood = de audit valt hierop om, oranje = vraagt aandacht. Een evaluatie mag maximaal{" "}
            {EVALUATION_MAX_AGE_MONTHS} maanden oud zijn. De regel{" "}
            <strong>Dossier onvolledig (NEN 4400 / Kiwa)</strong> bij{" "}
            <Link href="/dashboard/automatisering" className="text-brand-700 hover:underline">
              Automatisering
            </Link>{" "}
            zet dezelfde bevindingen als interne taak op het juiste dossier.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
