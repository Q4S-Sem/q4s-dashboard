import "server-only";
import { db } from "@/lib/db";

/**
 * Keuzelijsten voor het contractformulier: alle opdrachtnemers (Consultants) en
 * hun plaatsingen. De client filtert de plaatsingen op de gekozen opdrachtnemer
 * niet hard — ze staan allemaal in de lijst met een duidelijk label.
 */
export async function getContractFormOptions() {
  const [consultants, placements] = await Promise.all([
    db.consultant.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyName: true,
        kvkNumber: true,
        vatNumber: true,
        address: true,
        postalCode: true,
        city: true,
      },
    }),
    db.placement.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        consultantId: true,
        title: true,
        workLocation: true,
        client: { select: { companyName: true } },
        consultant: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return {
    consultants: consultants.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      company: c.companyName ?? "",
      kvk: c.kvkNumber ?? "",
      vat: c.vatNumber ?? "",
      address: [c.address, [c.postalCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    })),
    placements: placements.map((p) => ({
      id: p.id,
      consultantId: p.consultantId,
      label: `${p.consultant.firstName} ${p.consultant.lastName} — ${p.title}${p.client ? ` · ${p.client.companyName}` : ""}`,
      thirdParty: p.client?.companyName ?? p.workLocation ?? "",
    })),
  };
}
