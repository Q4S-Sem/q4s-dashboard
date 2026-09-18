import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { db } from "@/lib/db";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CONTRACT_STATUSES } from "@/lib/domain";
import { ContractVel } from "@/components/contract/ContractVel";
import { loadContractSheet } from "@/lib/contract-render";
import { ContractForm } from "../ContractForm";
import { updateContract, deleteContract } from "../actions";
import { getContractFormOptions } from "../data";

export const metadata = { title: "Contract nakijken" };
export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ opgeslagen?: string; error?: string }>;
}) {
  const { id } = await params;
  const { opgeslagen, error } = await searchParams;

  const [sheet, options, contract] = await Promise.all([
    loadContractSheet(id),
    getContractFormOptions(),
    db.contract.findUnique({ where: { id } }),
  ]);
  if (!sheet || !contract) notFound();

  return (
    <div className="space-y-6">
      <BackLink href="/contracten">Terug naar contracten</BackLink>

      <PageHeader
        title="Overeenkomst van opdracht"
        description="Links bewerk je de gegevens, rechts zie je direct hoe het contract eruit rolt. De blauwe waarden zijn wat jij invult; de rest is de vaste modelovereenkomst."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge options={CONTRACT_STATUSES} value={contract.status} />
            <Link href={`/contracten/${id}/print`} className={buttonVariants({ variant: "outline" })}>
              <Printer className="h-4 w-4" /> Printen / PDF
            </Link>
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
      {error === "verwijderen" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Verwijderen mislukt.</p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <ContractForm
          action={updateContract}
          contract={contract}
          consultants={options.consultants}
          placements={options.placements}
          cancelHref="/contracten"
        />

        {/* Live voorbeeld — hetzelfde vel als de print/PDF, op schaal. */}
        <div className="hidden xl:block">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Voorbeeld</p>
          <div className="origin-top-left scale-[0.62] overflow-hidden rounded-lg border border-ink-200 shadow-sm">
            <ContractVel doc={sheet.doc} logoSrc={sheet.logoSrc} />
          </div>
        </div>
      </div>
    </div>
  );
}
