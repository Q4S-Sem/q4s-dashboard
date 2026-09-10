// TIJDELIJKE, one-shot opschoon-route: verwijdert alle MSP-opdrachtgevers
// (TargetClient) uit de database. Beveiligd met een geheim token in de code —
// wordt direct na gebruik weer verwijderd. NIET laten staan.
//
// Veilig: alle relaties naar TargetClient zijn onDelete: SetNull, dus er
// cascadet niks weg; gekoppelde records verliezen alleen hun (optionele) FK.
//
//   GET  /api/admin/wipe-opdrachtgevers?token=<TOKEN>   -> preview (verandert niets)
//   POST /api/admin/wipe-opdrachtgevers  body {token,apply:true} -> echt verwijderen
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const TOKEN = "8e46e9aad3f0a406a76bc2de787fc5b868f3675b54c47964";

async function snapshot() {
  const targets = await db.targetClient.findMany({
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
  const ids = targets.map((t) => t.id);
  const [deals, contacts, apps, events, tasks, clients, candidates] = await Promise.all([
    db.deal.count({ where: { targetClientId: { in: ids } } }),
    db.crmContact.count({ where: { targetClientId: { in: ids } } }),
    db.application.count({ where: { submittedToId: { in: ids } } }),
    db.calendarEvent.count({ where: { targetClientId: { in: ids } } }),
    db.task.count({ where: { targetClientId: { in: ids } } }),
    db.client.count(),
    db.candidate.count(),
  ]);
  return {
    count: targets.length,
    names: targets.map((t) => t.name),
    unlinked: { deals, contacts, applications: apps, events, tasks },
    untouched: { clients, candidates },
  };
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (token !== TOKEN) return new Response("forbidden", { status: 403 });
  return Response.json({ mode: "preview", ...(await snapshot()) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body?.token !== TOKEN) return new Response("forbidden", { status: 403 });
  const before = await snapshot();
  if (!body?.apply) return Response.json({ mode: "preview", ...before });

  const res = await db.targetClient.deleteMany({});
  const after = await db.targetClient.count();
  return Response.json({ mode: "applied", deleted: res.count, remaining: after, before });
}
