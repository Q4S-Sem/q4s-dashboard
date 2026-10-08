import { AlleKandidaten, type SP } from "../AlleKandidaten";

export const metadata = { title: "Projecten — alle kandidaten" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  return <AlleKandidaten sp={await searchParams} spoor="PROJECT" />;
}
