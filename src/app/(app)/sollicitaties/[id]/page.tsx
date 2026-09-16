import { SollicitatieDetail } from "../SollicitatieDetail";

export const metadata = { title: "Sollicitatie" };

export default async function SollicitatieDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  return <SollicitatieDetail id={id} error={error} basePath="/sollicitaties" />;
}
