import { PageHeader } from "@/components/ui/page-header";
import { MedewerkerForm } from "../MedewerkerForm";
import { createEmployee } from "../actions";

export const metadata = { title: "Nieuwe medewerker" };

export default function NieuweMedewerkerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nieuwe medewerker"
        description="Voeg een Q4S-medewerker toe aan het personeelsbestand."
      />
      <MedewerkerForm
        action={createEmployee}
        submitLabel="Medewerker toevoegen"
        cancelHref="/medewerkers"
      />
    </div>
  );
}
