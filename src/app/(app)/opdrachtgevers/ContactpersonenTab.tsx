import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";
import { CompaniesBrowser, type CompanyRow } from "../crm/contacten/CompaniesBrowser";

/** Tab "Contactpersonen" op Klanten & contacten: per bedrijf de contactpersonen. */
export async function ContactpersonenTab() {
  const [clients, contacts] = await Promise.all([
    db.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true, city: true },
    }),
    db.crmContact.findMany({
      where: { clientId: { not: null } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, jobTitle: true, phone: true, email: true, clientId: true },
    }),
  ]);

  const byClient = new Map<string, CompanyRow["contacts"]>();
  for (const c of contacts) {
    const row = { id: c.id, name: `${c.firstName} ${c.lastName ?? ""}`.trim(), jobTitle: c.jobTitle, phone: c.phone, email: c.email };
    byClient.set(c.clientId!, [...(byClient.get(c.clientId!) ?? []), row]);
  }
  const companies: CompanyRow[] = clients.map((cl) => ({
    id: cl.id,
    name: cl.companyName,
    city: cl.city,
    contacts: byClient.get(cl.id) ?? [],
  }));

  return companies.length === 0 ? (
    <EmptyState icon={<Building2 className="h-6 w-6" />} title="Geen bedrijven gevonden" description="Pas je zoekopdracht aan of voeg een bedrijf toe." />
  ) : (
    <CompaniesBrowser companies={companies} />
  );
}
