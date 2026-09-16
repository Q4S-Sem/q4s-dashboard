import { DealDetail } from "../../deals/DealDetail";

export const metadata = { title: "Vacature" };
export const dynamic = "force-dynamic";

export default async function VacatureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealDetail id={id} basePath="/crm/vacatures" />;
}
