import { EvaluatiesList } from "../EvaluatiesList";

export const metadata = { title: "Evaluaties inlener" };

export default async function InlenerEvaluatiesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const sp = await searchParams;
  return (
    <EvaluatiesList
      type="UITZENDKRACHT"
      basePath="/evaluaties/inlener"
      title="Evaluatie inlener (uitzendkracht → inlener)"
      description="De uitzendkracht beoordeelt de inlener en de werkplek. Gesorteerd op kwartaal."
      sp={sp}
    />
  );
}
