import { PipelineBord } from "../../crm/PipelineBord";

export const metadata = { title: "WNS+Deta vast — pipeline" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <PipelineBord spoor="VAST" />;
}
