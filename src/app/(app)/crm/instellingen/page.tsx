import Link from "next/link";
import { ArrowLeft, Settings, GripVertical, ChevronUp, ChevronDown, Trash2, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { BADGE_COLORS, type BadgeColor } from "@/lib/domain";
import { currentRecruiter, getCrmSettings } from "@/lib/crm";
import { SettingsForm } from "./SettingsForm";
import { AddStageForm } from "./AddStageForm";
import { saveCrmSettings, updateStage, moveStage, deleteStage, createStage } from "./actions";

export const metadata = { title: "CRM-instellingen" };
export const dynamic = "force-dynamic";

export default async function CrmInstellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const recruiter = await currentRecruiter();
  const [settings, stages] = await Promise.all([
    getCrmSettings(recruiter?.id ?? null),
    db.crmStage.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { deals: true } } },
    }),
  ]);

  const stageOpts = stages.map((s) => ({ key: s.key, name: s.name }));

  return (
    <div className="space-y-6">
      <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar CRM
      </Link>

      <PageHeader
        title="CRM-instellingen"
        description="Stel de CRM naar jouw hand — persoonlijke voorkeuren per recruiter, plus de gedeelde pipeline-fases."
      />

      {error === "stage-in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze fase kan niet verwijderd worden zolang er deals in staan. Verplaats die deals eerst.
        </p>
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Settings className="h-4 w-4 text-ink-400" />
          <h2 className="text-sm font-semibold text-ink-700">
            Persoonlijk{recruiter ? ` — ${recruiter.name}` : ""}
          </h2>
        </div>
        <p className="mb-3 text-xs text-ink-500">
          Deze voorkeuren gelden alleen voor jou. Wissel bovenin de CRM van recruiter om iemand anders in te stellen.
        </p>
        <SettingsForm action={saveCrmSettings} settings={settings} stages={stageOpts} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-ink-400" /> Pipeline-fases
          </CardTitle>
          <span className="text-xs text-ink-400">Gedeeld met het hele team</span>
        </CardHeader>
        <CardContent className="space-y-3">
          {stages.map((s, i) => {
            const closing = s.isWon || s.isLost;
            const deletable = !closing && s._count.deals === 0;
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 p-2">
                <div className="flex flex-col">
                  <form action={moveStage}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button type="submit" disabled={i === 0} title="Omhoog" className="text-ink-400 hover:text-ink-700 disabled:opacity-30">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                  </form>
                  <form action={moveStage}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button type="submit" disabled={i === stages.length - 1} title="Omlaag" className="text-ink-400 hover:text-ink-700 disabled:opacity-30">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </form>
                </div>

                <form action={updateStage} className="flex flex-1 flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={s.id} />
                  <Input name="name" defaultValue={s.name} className="h-9 min-w-40 flex-1" />
                  <Select name="color" defaultValue={s.color} className="w-32">
                    {BADGE_COLORS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                  <div className="flex items-center gap-1">
                    <Input name="probability" type="number" min={0} max={100} defaultValue={s.probability} className="h-9 w-20" />
                    <span className="text-xs text-ink-400">% kans</span>
                  </div>
                  {s.isWon && <Badge color="green">Gewonnen</Badge>}
                  {s.isLost && <Badge color="red">Verloren</Badge>}
                  <Badge color={(s.color as BadgeColor) ?? "slate"}>{s._count.deals} deals</Badge>
                  <Button type="submit" variant="outline" size="sm">
                    Opslaan
                  </Button>
                </form>

                {deletable ? (
                  <ConfirmSubmit
                    action={deleteStage}
                    id={s.id}
                    message={`Fase "${s.name}" verwijderen?`}
                    variant="ghost"
                    size="icon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </ConfirmSubmit>
                ) : (
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center text-ink-300"
                    title={closing ? "Vaste win/verlies-fase" : "Bevat deals — niet te verwijderen"}
                  >
                    <Lock className="h-4 w-4" />
                  </span>
                )}
              </div>
            );
          })}

          <div className="border-t border-ink-100 pt-4">
            <AddStageForm action={createStage} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Link href="/crm" className={buttonVariants({ variant: "outline" })}>
          Klaar
        </Link>
      </div>
    </div>
  );
}
