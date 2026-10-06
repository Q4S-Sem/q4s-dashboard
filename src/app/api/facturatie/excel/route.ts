import { requireAdminApiSession } from "@/lib/api-auth";
import { vulSjabloon } from "@/lib/excel-sjabloon";
import { factuuroverzicht } from "@/lib/factuuroverzicht";

// Het Q4S-factuuroverzicht als Excel — exact de opmaak van het handmatige
// bestand (logo, Overzicht · Facturen · Kosten). ?jaar=2026 en optioneel
// &kwartaal=1..4 voor één kwartaal.
export async function GET(req: Request) {
  const gate = await requireAdminApiSession();
  if (gate) return gate;
  const sp = new URL(req.url).searchParams;
  const jaar = /^\d{4}$/.test(sp.get("jaar") ?? "") ? Number(sp.get("jaar")) : new Date().getFullYear();
  const k = Number(sp.get("kwartaal"));
  const kwartaal = k >= 1 && k <= 4 ? k : null;

  const { vulling, naam } = await factuuroverzicht(jaar, kwartaal);
  return new Response(Buffer.from(vulSjabloon(vulling)), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${naam}"`,
      "Cache-Control": "no-store",
    },
  });
}
