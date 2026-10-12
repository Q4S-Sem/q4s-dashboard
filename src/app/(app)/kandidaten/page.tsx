import { TalentpoolVandaag } from "./TalentpoolVandaag";

export const metadata = { title: "Projecten — afgelopen 24 uur" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <TalentpoolVandaag spoor="PROJECT" />;
}
