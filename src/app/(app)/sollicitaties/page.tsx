import { SollicitatiesList } from "./SollicitatiesList";

export const metadata = { title: "Sollicitaties" };
export const dynamic = "force-dynamic";

export default async function SollicitatiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  return <SollicitatiesList sp={sp} basePath="/sollicitaties" />;
}
