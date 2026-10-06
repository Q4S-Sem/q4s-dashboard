import { requireAdminApiSession } from "@/lib/api-auth";
import { plaatsingenExcel } from "@/lib/plaatsingen-excel";

export const dynamic = "force-dynamic";

/** Alle lopende plaatsingen als Q4S-Excel. Alleen beheerder: bevat IBAN/KvK. */
export async function GET() {
  const gate = await requireAdminApiSession();
  if (gate) return gate;
  const { bytes, naam } = await plaatsingenExcel();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${naam}"`,
      "Cache-Control": "no-store",
    },
  });
}
