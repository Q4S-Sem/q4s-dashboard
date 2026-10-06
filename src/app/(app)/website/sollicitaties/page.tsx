import { redirect } from "next/navigation";

// Sollicitaties staan nu op één plek: Recruitment → Sollicitaties.
export default async function WebsiteSollicitatiesRedirect({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  redirect(status ? `/sollicitaties?status=${status}` : "/sollicitaties");
}
