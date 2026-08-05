import { notFound } from "next/navigation";
import { StickyNote, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { getActivities } from "@/lib/activities";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { savePlacementNotes } from "../../../actions";
import { getPlacement } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placement = await getPlacement(id);
  return { title: `Notities · ${placement?.title ?? "Plaatsing"}` };
}

export default async function PlaatsingNotitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;

  const placement = await getPlacement(id);
  if (!placement) notFound();

  const activities = await getActivities("placement", placement.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-slate-500" /> Vaste notitie
          </CardTitle>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Opgeslagen
            </span>
          )}
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-500">
            Wat je altijd bij deze plaatsing wilt weten: werktijden, contactpersoon op locatie,
            afspraken over toeslagen. Losse gebeurtenissen leg je hieronder in de tijdlijn vast.
          </p>
          <form action={savePlacementNotes} key={placement.notes ?? ""} className="space-y-3">
            <input type="hidden" name="id" value={placement.id} />
            <Textarea
              name="notes"
              rows={6}
              defaultValue={placement.notes ?? ""}
              placeholder="Bijv. start 07:00 bij de poort, melden bij de uitvoerder; helm + veiligheidsbril verplicht."
            />
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Opslaan…">Notitie opslaan</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <ActivityFeed
        entityType="placement"
        entityId={placement.id}
        path={`/plaatsingen/${placement.id}/notities`}
        activities={activities}
      />
    </div>
  );
}
