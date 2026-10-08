import { AlleKandidaten, type SP } from "../../kandidaten/AlleKandidaten";

export const metadata = { title: "WNS+Deta vast — alle kandidaten" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  return <AlleKandidaten sp={await searchParams} spoor="VAST" />;
}
