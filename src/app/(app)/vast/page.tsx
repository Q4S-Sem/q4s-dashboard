import { TalentpoolVandaag } from "../kandidaten/TalentpoolVandaag";

export const metadata = { title: "WNS+Deta vast — afgelopen 24 uur" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <TalentpoolVandaag spoor="VAST" />;
}
