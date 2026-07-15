import "server-only";
import { db } from "@/lib/db";
import { getRecruiters, getStages, currentRecruiterId } from "@/lib/crm";

/** Load every dropdown the deal-form needs (recruiters, stages, linkable records). */
export async function loadDealFormOptions() {
  const [recruiters, stages, targets, clients, vacancies, contacts, currentId] = await Promise.all([
    getRecruiters(),
    getStages(),
    db.targetClient.findMany({ orderBy: [{ priority: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    db.vacancy.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, title: true, companyName: true } }),
    db.crmContact.findMany({ orderBy: [{ firstName: "asc" }], select: { id: true, firstName: true, lastName: true, company: true } }),
    currentRecruiterId(),
  ]);

  return {
    currentId,
    recruiters: recruiters.map((r) => ({ id: r.id, label: r.jobTitle ? `${r.name} — ${r.jobTitle}` : r.name })),
    stages: stages.map((s) => ({ id: s.id, label: s.name })),
    targets: targets.map((t) => ({ id: t.id, label: t.name })),
    clients: clients.map((c) => ({ id: c.id, label: c.companyName })),
    vacancies: vacancies.map((v) => ({ id: v.id, label: v.companyName ? `${v.title} — ${v.companyName}` : v.title })),
    contacts: contacts.map((c) => ({
      id: c.id,
      label: [`${c.firstName} ${c.lastName ?? ""}`.trim(), c.company].filter(Boolean).join(" · "),
    })),
  };
}
