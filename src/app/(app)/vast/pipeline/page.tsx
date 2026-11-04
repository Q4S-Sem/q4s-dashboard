import { PipelineBord } from "../../crm/PipelineBord";

export const metadata = { title: "WNS+Deta vast — pipeline" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ vacature?: string }> }) {
  return <PipelineBord spoor="VAST" vacature={(await searchParams).vacature} />;
}
