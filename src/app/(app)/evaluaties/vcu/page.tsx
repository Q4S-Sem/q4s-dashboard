import { EvaluatiesList } from "../EvaluatiesList";

export const metadata = { title: "VG-evaluaties" };

export default async function VcuEvaluatiesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string; opgeslagen?: string }>;
}) {
  const sp = await searchParams;
  return (
    <EvaluatiesList
      type="VCU"
      basePath="/evaluaties/vcu"
      title="VG-evaluatie (inlener → uitzendkracht)"
      description="VG-evaluatieformulier (VCU): de inlener beoordeelt de uitzendkracht. Gesorteerd op kwartaal."
      sp={sp}
    />
  );
}
