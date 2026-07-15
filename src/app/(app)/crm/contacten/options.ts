import "server-only";
import { db } from "@/lib/db";
import { getRecruiters, currentRecruiterId } from "@/lib/crm";

/** Dropdown data for the contact form (recruiters + linkable companies). */
export async function loadContactFormOptions() {
  const [recruiters, targets, clients, currentId] = await Promise.all([
    getRecruiters(),
    db.targetClient.findMany({ orderBy: [{ priority: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    currentRecruiterId(),
  ]);
  return {
    currentId,
    recruiters: recruiters.map((r) => ({ id: r.id, label: r.jobTitle ? `${r.name} — ${r.jobTitle}` : r.name })),
    targets: targets.map((t) => ({ id: t.id, label: t.name })),
    clients: clients.map((c) => ({ id: c.id, label: c.companyName })),
  };
}
