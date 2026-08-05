import { notFound } from "next/navigation";
import { getActivities } from "@/lib/activities";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { getEmployee } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getEmployee(id);
  return { title: `Notities · ${m ? `${m.firstName} ${m.lastName}` : "Medewerker"}` };
}

export default async function MedewerkerNotitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const m = await getEmployee(id);
  if (!m) notFound();

  const activities = await getActivities("employee", m.id);

  return (
    <ActivityFeed
      entityType="employee"
      entityId={m.id}
      path={`/medewerkers/${m.id}/notities`}
      activities={activities}
    />
  );
}
