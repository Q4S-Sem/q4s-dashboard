import { redirect } from "next/navigation";

/** Het mapje Kandidaten zit nu links op de generator zelf; oude links landen daar. */
export default async function CvGeneratorKandidatenRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; fout?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  redirect(`/socials/cv-generator${qs.size ? `?${qs}` : ""}`);
}
