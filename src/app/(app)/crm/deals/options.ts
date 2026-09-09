import "server-only";
import { db } from "@/lib/db";
import { getRecruiters, getStages, currentRecruiterId } from "@/lib/crm";
import type { BadgeColor } from "@/lib/domain";

export type StageOption = { id: string; label: string; color: BadgeColor };

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

  // Eén ontdubbelde lijst met bedrijfsnamen uit ons klanten- én opdrachtgeversbestand,
  // zodat de "Bedrijf / opdrachtgever"-tekst gekoppeld is aan wat we al kennen.
  const companies = [
    ...new Set([...clients.map((c) => c.companyName), ...targets.map((t) => t.name)].filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "nl"));

  return {
    currentId,
    recruiters: recruiters.map((r) => ({ id: r.id, label: r.jobTitle ? `${r.name} — ${r.jobTitle}` : r.name })),
    stages: stages.map((s) => ({ id: s.id, label: s.name, color: s.color })),
    targets: targets.map((t) => ({ id: t.id, label: t.name })),
    clients: clients.map((c) => ({ id: c.id, label: c.companyName })),
    companies,
    vacancies: vacancies.map((v) => ({ id: v.id, label: v.companyName ? `${v.title} — ${v.companyName}` : v.title })),
    contacts: contacts.map((c) => ({
      id: c.id,
      label: [`${c.firstName} ${c.lastName ?? ""}`.trim(), c.company].filter(Boolean).join(" · "),
    })),
  };
}
