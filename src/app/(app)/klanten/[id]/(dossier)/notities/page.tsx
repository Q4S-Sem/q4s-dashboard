import { notFound } from "next/navigation";
import { StickyNote, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { getActivities } from "@/lib/activities";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { saveClientNotes } from "../../../actions";
import { getClient } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  return { title: `Notities · ${client?.companyName ?? "Klant"}` };
}

export default async function KlantNotitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;

  const client = await getClient(id);
  if (!client) notFound();

  const activities = await getActivities("client", client.id);

  return (
    <div className="space-y-6">
      {/* Vaste notitie: alles wat altijd geldt (afspraken, tarieven, poortregels) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-ink-500" /> Vaste notitie
          </CardTitle>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Opgeslagen
            </span>
          )}
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-ink-500">
            Wat je altijd over deze klant wilt weten: vaste afspraken, poortregels, facturatie-eisen.
            Losse gebeurtenissen leg je hieronder in de tijdlijn vast.
          </p>
          <form action={saveClientNotes} key={client.notes ?? ""} className="space-y-3">
            <input type="hidden" name="id" value={client.id} />
            <Textarea
              name="notes"
              rows={6}
              defaultValue={client.notes ?? ""}
              placeholder="Bijv. VCA verplicht op locatie, urenstaten uiterlijk maandag 12:00, factuur altijd met PO-nummer."
            />
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Opslaan…">Notitie opslaan</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tijdlijn: gesprekken, mails en geplande taken bij deze klant */}
      <ActivityFeed
        entityType="client"
        entityId={client.id}
        path={`/klanten/${client.id}/notities`}
        activities={activities}
      />
    </div>
  );
}
