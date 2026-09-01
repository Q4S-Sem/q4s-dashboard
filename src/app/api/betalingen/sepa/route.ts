import { requireAdminApiSession } from "@/lib/api-auth";
import { buildSepaForPayables } from "@/lib/betalingen";

/** Download het SEPA-betaalbestand (pain.001) voor alle openstaande inkoopfacturen. */
export async function GET() {
  const gate = await requireAdminApiSession();
  if (gate) return gate;

  const res = await buildSepaForPayables();
  if (!res.ok || !res.xml) {
    return new Response(res.error ?? "Kon geen SEPA-bestand maken.", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const fname = `Q4S-SEPA-betalingen-${new Date().toISOString().slice(0, 10)}.xml`;
  return new Response(res.xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
