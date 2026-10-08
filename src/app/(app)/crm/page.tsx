import { PipelineBord } from "./PipelineBord";

export const metadata = { title: "Projecten — pipeline" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <PipelineBord spoor="PROJECT" />;
}
