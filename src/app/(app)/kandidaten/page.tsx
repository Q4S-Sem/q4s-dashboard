import { TalentpoolVandaag } from "./TalentpoolVandaag";

export const metadata = { title: "Projecten — vandaag binnen" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <TalentpoolVandaag spoor="PROJECT" />;
}
