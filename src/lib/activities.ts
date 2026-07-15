import { db } from "./db";

export type ActivityItem = {
  id: string;
  kind: "LOG" | "TODO";
  type: string;
  body: string;
  dueAt: string | null; // ISO
  done: boolean;
  createdAt: string; // ISO
  authorName: string | null;
};

/** Alle activiteiten van één record (nieuwste eerst), met opgeloste auteur-namen. */
export async function getActivities(entityType: string, entityId: string): Promise<ActivityItem[]> {
  const rows = await db.activity.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  });

  const authorIds = [...new Set(rows.map((r) => r.authorId).filter((x): x is string => Boolean(x)))];
  const users = authorIds.length
    ? await db.appUser.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind === "TODO" ? "TODO" : "LOG",
    type: r.type,
    body: r.body,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null,
    done: r.done,
    createdAt: r.createdAt.toISOString(),
    authorName: r.authorId ? nameById.get(r.authorId) ?? null : null,
  }));
}

export type OpenTask = {
  id: string;
  type: string;
  body: string;
  dueAt: string | null;
  entityType: string;
  entityLabel: string;
  href: string;
  ruleGenerated: boolean;
};

/** Alle open taken (Activity, kind TODO, niet afgerond) over ALLE records — met de
 *  naam + link van het bronrecord opgelost. Voor het centrale "Te doen"-overzicht. */
export async function getOpenTasks(): Promise<OpenTask[]> {
  const rows = await db.activity.findMany({
    where: { kind: "TODO", done: false },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });

  const ids = (t: string) => rows.filter((r) => r.entityType === t).map((r) => r.entityId);
  const [placements, clients, consultants, employees, targets] = await Promise.all([
    ids("placement").length
      ? db.placement.findMany({ where: { id: { in: ids("placement") } }, select: { id: true, title: true, client: { select: { companyName: true } } } })
      : [],
    ids("client").length
      ? db.client.findMany({ where: { id: { in: ids("client") } }, select: { id: true, companyName: true } })
      : [],
    ids("consultant").length
      ? db.consultant.findMany({ where: { id: { in: ids("consultant") } }, select: { id: true, firstName: true, lastName: true } })
      : [],
    ids("employee").length
      ? db.employee.findMany({ where: { id: { in: ids("employee") } }, select: { id: true, firstName: true, lastName: true } })
      : [],
    ids("target").length
      ? db.targetClient.findMany({ where: { id: { in: ids("target") } }, select: { id: true, name: true } })
      : [],
  ]);
  const plMap = new Map(placements.map((p) => [p.id, `${p.title} · ${p.client.companyName}`]));
  const clMap = new Map(clients.map((c) => [c.id, c.companyName]));
  const coMap = new Map(consultants.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));
  const emMap = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const taMap = new Map(targets.map((t) => [t.id, t.name]));

  return rows.map((r) => {
    let entityLabel = "Onbekend record";
    let href = "#";
    if (r.entityType === "placement") {
      entityLabel = plMap.get(r.entityId) ?? "Plaatsing";
      href = `/plaatsingen/${r.entityId}`;
    } else if (r.entityType === "client") {
      entityLabel = clMap.get(r.entityId) ?? "Klant";
      href = `/klanten/${r.entityId}`;
    } else if (r.entityType === "consultant") {
      entityLabel = coMap.get(r.entityId) ?? "Medewerker";
      href = `/werknemers/${r.entityId}`;
    } else if (r.entityType === "employee") {
      entityLabel = emMap.get(r.entityId) ?? "Q4S-medewerker";
      href = `/medewerkers/${r.entityId}`;
    } else if (r.entityType === "target") {
      entityLabel = taMap.get(r.entityId) ?? "Opdrachtgever";
      href = `/opdrachtgevers/${r.entityId}`;
    }
    return {
      id: r.id,
      type: r.type,
      body: r.body,
      dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      entityType: r.entityType,
      entityLabel,
      href,
      ruleGenerated: Boolean(r.ruleId),
    };
  });
}
