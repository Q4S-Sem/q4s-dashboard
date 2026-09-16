import { SollicitatieDetail } from "../../../sollicitaties/SollicitatieDetail";

export const metadata = { title: "Sollicitatie — Website" };

export default async function WebsiteSollicitatieDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  return <SollicitatieDetail id={id} error={error} basePath="/website/sollicitaties" />;
}
