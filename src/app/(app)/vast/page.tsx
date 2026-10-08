import { TalentpoolVandaag } from "../kandidaten/TalentpoolVandaag";

export const metadata = { title: "WNS+Deta vast — vandaag binnen" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <TalentpoolVandaag spoor="VAST" />;
}
