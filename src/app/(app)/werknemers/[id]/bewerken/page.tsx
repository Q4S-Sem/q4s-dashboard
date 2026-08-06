import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ConsultantForm } from "../../ConsultantForm";
import { updateConsultant } from "../../actions";

export const metadata = { title: "Werknemer bewerken" };

export default async function WerknemerBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const consultant = await db.consultant.findUnique({ where: { id } });
  if (!consultant) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href={`/werknemers/${consultant.id}`}>
        Terug naar werknemer
      </BackLink>
      <PageHeader
        title="Werknemer bewerken"
        description={`${consultant.firstName} ${consultant.lastName}`}
      />
      <ConsultantForm
        action={updateConsultant}
        consultant={consultant}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/werknemers/${consultant.id}`}
      />
    </div>
  );
}
