import { ICOON_GROEP } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { WordKnop } from "@/components/contract/WordKnop";
import { db } from "@/lib/db";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CONTRACT_STATUSES } from "@/lib/domain";
import { getCompanySettings } from "@/lib/settings";
import { loadContractSheet } from "@/lib/contract-render";
import { TaalSchakelaar } from "@/components/contract/TaalSchakelaar";
import { ContractForm } from "../ContractForm";
import { updateContract, deleteContract } from "../actions";
import { ontbrekendeContractVelden } from "@/lib/contract-check";
import { PrintMetControle } from "./PrintMetControle";

export const metadata = { title: "Contract nakijken" };
export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ opgeslagen?: string; error?: string; taal?: string }>;
}) {
  const { id } = await params;
  const { opgeslagen, error, taal: t } = await searchParams;
  const taal = t === "en" ? "en" : "nl";

  const [sheet, contract] = await Promise.all([
    loadContractSheet(id),
    db.contract.findUnique({ where: { id } }),
  ]);
  if (!sheet || !contract) notFound();
  const ontbreekt = ontbrekendeContractVelden(contract);

  return (
    <div className="space-y-6">
      <BackLink href="/contracten">Terug naar contracten</BackLink>

      <PageHeader
        title="Overeenkomst van opdracht"
        description="Bewerk de gegevens onder Invulformulier; onder Voorbeeld zie je direct hoe het contract eruit rolt. De blauwe waarden zijn wat jij invult; de rest is de vaste modelovereenkomst."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge options={CONTRACT_STATUSES} value={contract.status} />
            <ConfirmSubmit
              action={deleteContract}
              id={id}
              message={`Contract van "${contract.contractorName}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </div>
        }
      />

      {opgeslagen !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Contract opgeslagen.</p>
      )}
      {ontbreekt.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <b>Nog niet compleet</b> — vul aan vóór je het verstuurt: {ontbreekt.join(" · ")}
        </p>
      )}
      {error === "verwijderen" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Verwijderen mislukt.</p>
      )}

      <ContractForm
        action={updateContract}
        contract={contract}
        cancelHref="/contracten"
        taalKeuze={<TaalSchakelaar taal={taal} href={(x) => `/contracten/${id}${x === "en" ? "?taal=en" : ""}`} />}
        voorbeeld={{
          settings: await getCompanySettings(),
          logoSrc: sheet.logoSrc,
          handtekening: sheet.handtekening,
          taal,
          acties: (
            <>
              <div className={ICOON_GROEP}>
                <WordKnop icoon bestandsnaam={`Overeenkomst van opdracht - ${contract.contractorName || contract.number || ""}`} />
              <PrintMetControle href={`/contracten/${id}/print${taal === "en" ? "?taal=en" : ""}`} ontbreekt={ontbreekt} />
              </div>
            </>
          ),
        }}
      />
    </div>
  );
}
