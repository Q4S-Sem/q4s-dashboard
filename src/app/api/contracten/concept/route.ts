import { requireApiSession } from "@/lib/api-auth";
import { bewaarContractConcept, bewaarDoc } from "@/app/(app)/contracten/actions";

export const dynamic = "force-dynamic";

/**
 * Automatisch bewaren van contracten/offertes/arbeidsovereenkomsten tijdens het
 * typen. Een API-route i.p.v. een server action: blijft werken als er intussen
 * een nieuwe versie live staat.
 */
export async function POST(req: Request) {
  const gate = await requireApiSession();
  if (gate) return gate;
  const fd = await req.formData();
  const soort = String(fd.get("_soort") ?? "");
  if (soort === "overeenkomst") {
    fd.delete("_soort");
    return Response.json(await bewaarContractConcept(fd));
  }
  let waarden: Record<string, string> = {};
  try {
    waarden = JSON.parse(String(fd.get("_waarden") ?? "{}"));
  } catch {
    return Response.json(null, { status: 400 });
  }
  const r = await bewaarDoc(soort, String(fd.get("_id") ?? "") || null, waarden);
  return Response.json("id" in r ? r : null, { status: "id" in r ? 200 : 400 });
}
