import { ICOON_GROEP } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { WordKnop } from "@/components/contract/WordKnop";
import { getCompanySettings } from "@/lib/settings";
import { contractLogoDataUri, q4sHandtekeningDataUri } from "@/lib/contract-render";
import { ContractForm } from "../../ContractForm";
import { PrintKnop } from "../../[id]/print/PrintBar";
import { createContract } from "../../actions";
import { db } from "@/lib/db";
import { contractUitPlaatsing } from "@/lib/contract-tarieven";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import type { Contract } from "@prisma/client";

export const metadata = { title: "Nieuw contract" };
export const dynamic = "force-dynamic";

/** Een overeenkomst van opdracht invullen (met live voorbeeld) en opslaan. */
export default async function NieuwContractPage({
  searchParams,
}: {
  searchParams: Promise<{ taal?: string; consultantId?: string; placementId?: string }>;
}) {
  const sp = await searchParams;
  const taal = sp.taal === "en" ? "en" : "nl";

  // Koppeling met de plaatsingen: gekozen plaatsing (of de nieuwste van de persoon)
  // levert partijen, opdracht, looptijd en inkooptarieven → ~90% ingevuld.
  const plaatsing = sp.placementId
    ? await db.placement.findUnique({ where: { id: sp.placementId }, include: { consultant: true, client: true } })
    : sp.consultantId
      ? await db.placement.findFirst({
          where: { consultantId: sp.consultantId, status: { not: "ARCHIVED" } },
          orderBy: [{ status: "asc" }, { startDate: "desc" }],
          include: { consultant: true, client: true },
        })
      : null;
  const persoon = plaatsing?.consultant ?? (sp.consultantId ? await db.consultant.findUnique({ where: { id: sp.consultantId } }) : null);
  const defaults: Partial<Contract> | undefined = persoon
    ? {
        ...(contractUitPlaatsing(persoon, plaatsing) as Partial<Contract>),
        consultantId: persoon.id,
        ...(plaatsing ? { placementId: plaatsing.id } : {}),
      }
    : undefined;
  // Keuzelijst: alle lopende plaatsingen, actieve eerst.
  const keuzes = persoon
    ? []
    : await db.placement.findMany({
        where: { status: { notIn: ["ARCHIVED", "ENDED"] } },
        orderBy: [{ status: "asc" }, { consultant: { firstName: "asc" } }],
        select: { id: true, title: true, consultant: { select: { firstName: true, lastName: true } }, client: { select: { companyName: true } } },
      });
  const koppel = (t: string) => {
    const q = new URLSearchParams();
    if (t === "en") q.set("taal", "en");
    if (defaults?.consultantId) q.set("consultantId", defaults.consultantId);
    if (defaults?.placementId) q.set("placementId", defaults.placementId);
    const s = q.toString();
    return `/contracten/nieuw/overeenkomst${s ? `?${s}` : ""}`;
  };
  return (
    <div className="space-y-6">
      <BackLink href="/contracten/nieuw">Terug naar nieuw contract</BackLink>
      <PageHeader
        title="Overeenkomst van opdracht"
        description="Vul het formulier in en bekijk het resultaat onder Voorbeeld. Opslaan als concept, of Klaar als alles is ingevuld — ontbreekt er iets, dan krijg je een melding."
      />
      {keuzes.length > 0 && (
        <Card>
          <CardContent>
            {/* Native GET-formulier: kies een plaatsing → pagina herlaadt voor-ingevuld. */}
            <form method="get" className="flex flex-wrap items-end gap-3">
              {taal === "en" && <input type="hidden" name="taal" value="en" />}
              <label className="min-w-0 flex-1 text-sm">
                <span className="mb-1 block font-medium text-ink-900">Voor wie? Kies een plaatsing — dan vullen we alles in</span>
                <Select name="placementId" required aria-label="Plaatsing">
                  <option value="">Kies een persoon / plaatsing…</option>
                  {keuzes.map((k) => (
                    <option key={k.id} value={k.id}>
                      {`${k.consultant.firstName} ${k.consultant.lastName} — ${k.title}${k.client ? ` · ${k.client.companyName}` : ""}`}
                    </option>
                  ))}
                </Select>
              </label>
              <button type="submit" className={buttonVariants({ variant: "success" })}>
                Invullen
              </button>
            </form>
            <p className="mt-2 text-xs text-ink-500">Nieuw persoon (nog geen plaatsing)? Vul het formulier hieronder gewoon zelf in.</p>
          </CardContent>
        </Card>
      )}
      <ContractForm
        key={defaults?.placementId ?? defaults?.consultantId ?? "leeg"}
        defaults={defaults}
        action={createContract}
        cancelHref="/contracten/nieuw"
        taalKeuze={<TaalSchakelaar taal={taal} href={koppel} />}
        voorbeeld={{
          settings: await getCompanySettings(),
          logoSrc: contractLogoDataUri(),
          handtekening: q4sHandtekeningDataUri(),
          taal,
          acties: (
            <>
              <div className={ICOON_GROEP}>
                <WordKnop icoon bestandsnaam={`Overeenkomst van opdracht${defaults?.contractorName ? ` - ${defaults.contractorName}` : ""}`} />
                <PrintKnop icoon />
              </div>
            </>
          ),
        }}
      />
    </div>
  );
}
