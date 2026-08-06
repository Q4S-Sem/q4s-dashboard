import { ChevronUp, ChevronDown, Trash2, Lock, Users } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { BADGE_COLORS, type BadgeColor } from "@/lib/domain";
import { AddStageForm } from "../../AddStageForm";
import { updateStage, moveStage, deleteStage, createStage } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * Elke rij is hetzelfde raster, zodat naam, kleur, kans, status en de knoppen
 * over álle fases recht onder elkaar staan. Het formulier binnenin staat op
 * `display: contents`, zodat zijn velden gewoon rasterkolommen worden en niet
 * een eigen blok vormen dat per rij anders uitvalt.
 */
const ROW =
  "grid grid-cols-[auto_minmax(0,1fr)_9rem_7rem_10rem_auto_auto] items-center gap-2";

export default async function FasesTab({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const stages = await db.crmStage.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { deals: true } } },
  });

  return (
    <div className="space-y-4">
      {error === "stage-in-use" && (
        <p className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze fase kan niet verwijderd worden zolang er deals in staan.
          Verplaats die deals eerst.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pipeline-fases</CardTitle>
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-400">
            <Users className="h-4 w-4" /> Gedeeld met het hele team
          </span>
        </CardHeader>

        <CardContent className="space-y-2">
          {/* Kolomkoppen — één keer, zodat de rijen eronder geen labels nodig hebben. */}
          <div className={`${ROW} px-2 pb-1 text-[13px] font-medium text-ink-400`}>
            <span className="w-5" />
            <span>Fase</span>
            <span>Kleur</span>
            <span>Kans %</span>
            <span>Status</span>
            <span className="w-[5.5rem]" />
            <span className="w-9" />
          </div>

          {stages.map((s, i) => {
            const closing = s.isWon || s.isLost;
            const deletable = !closing && s._count.deals === 0;
            return (
              <div
                key={s.id}
                className={`${ROW} rounded-sm border border-ink-100 px-2 py-2 transition-colors hover:border-ink-200`}
              >
                {/* Volgorde */}
                <div className="flex w-5 flex-col items-center">
                  <form action={moveStage}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button
                      type="submit"
                      disabled={i === 0}
                      title="Omhoog"
                      className="text-ink-300 transition-colors hover:text-ink-900 disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                  </form>
                  <form action={moveStage}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button
                      type="submit"
                      disabled={i === stages.length - 1}
                      title="Omlaag"
                      className="text-ink-300 transition-colors hover:text-ink-900 disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </form>
                </div>

                {/* `contents`: de velden hieronder worden zelf rasterkolommen. */}
                <form action={updateStage} className="contents">
                  <input type="hidden" name="id" value={s.id} />
                  <Input name="name" defaultValue={s.name} className="h-9" />
                  <Select name="color" defaultValue={s.color}>
                    {BADGE_COLORS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    name="probability"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={s.probability}
                    className="h-9"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {s.isWon && <Badge color="green">Gewonnen</Badge>}
                    {s.isLost && <Badge color="red">Verloren</Badge>}
                    <Badge color={(s.color as BadgeColor) ?? "slate"}>
                      {s._count.deals} {s._count.deals === 1 ? "deal" : "deals"}
                    </Badge>
                  </div>
                  <Button type="submit" variant="outline" size="sm" className="w-[5.5rem]">
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
                    className="inline-flex h-9 w-9 items-center justify-center text-ink-200"
                    title={
                      closing
                        ? "Vaste win/verlies-fase"
                        : "Bevat deals — niet te verwijderen"
                    }
                  >
                    <Lock className="h-4 w-4" />
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>

        <div className="border-t border-ink-100 px-5 py-4">
          <AddStageForm action={createStage} />
        </div>
      </Card>
    </div>
  );
}
