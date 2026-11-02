import { PageHeader } from "@/components/ui/page-header";
import { MedewerkerForm } from "../MedewerkerForm";
import { ConceptWissen } from "@/components/concept-wissen";
import { createEmployee } from "../actions";

export const metadata = { title: "Nieuwe medewerker" };

export default function NieuweMedewerkerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nieuwe medewerker"
        description="Voeg een Q4S-medewerker toe aan het personeelsbestand. Wat je invult blijft bewaard, ook als je tussendoor iets anders opent."
        actions={<ConceptWissen wat="deze medewerker" />}
      />
      <MedewerkerForm
        action={createEmployee}
        submitLabel="Medewerker toevoegen"
        cancelHref="/medewerkers"
      />
    </div>
  );
}
