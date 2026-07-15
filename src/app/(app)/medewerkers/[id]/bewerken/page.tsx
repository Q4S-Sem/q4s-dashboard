import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { MedewerkerForm } from "../../MedewerkerForm";
import { updateEmployee } from "../../actions";

export const metadata = { title: "Medewerker bewerken" };
export const dynamic = "force-dynamic";

export default async function BewerkMedewerkerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await db.employee.findUnique({ where: { id } });
  if (!employee) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`${employee.firstName} ${employee.lastName} bewerken`} />
      <MedewerkerForm
        action={updateEmployee}
        employee={employee}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/medewerkers/${id}`}
      />
    </div>
  );
}
