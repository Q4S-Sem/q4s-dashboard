import { PipelineBord } from "./PipelineBord";

export const metadata = { title: "Projecten — pipeline" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ vacature?: string }> }) {
  return <PipelineBord spoor="PROJECT" vacature={(await searchParams).vacature} />;
}
