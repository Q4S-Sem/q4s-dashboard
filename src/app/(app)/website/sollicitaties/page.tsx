import { SollicitatiesList } from "../../sollicitaties/SollicitatiesList";

export const metadata = { title: "Sollicitaties — Website" };
export const dynamic = "force-dynamic";

export default async function WebsiteSollicitatiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  return <SollicitatiesList sp={sp} basePath="/website/sollicitaties" />;
}
