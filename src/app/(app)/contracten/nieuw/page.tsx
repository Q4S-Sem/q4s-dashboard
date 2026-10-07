import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ChevronRight, FileSignature, Receipt, BriefcaseBusiness } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { CONTRACT_STATUSES } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { TabelZoek } from "@/components/ui/tabel-zoek";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { verwijderDoc } from "../actions";
import { Trash2 } from "lucide-react";

export const metadata = { title: "Nieuw contract" };
export const dynamic = "force-dynamic";

const SOORTEN = [
  {
    href: "/contracten/nieuw/overeenkomst",
    titel: "Overeenkomst van opdracht",
    uitleg: "Het contract met de opdrachtnemer: partijen, opdracht, duur en tarieven. Wordt opgeslagen en staat hieronder bij de opgestelde contracten.",
    icon: FileSignature,
    tone: "bg-brand-50 text-brand-600",
  },
  {
    href: "/contracten/nieuw/offerte",
    titel: "Offerte",
    uitleg: "Een offerte voor de klant met de inspecteur, locatie en tarieven.",
    icon: Receipt,
    tone: "bg-amber-50 text-amber-600",
  },
  {
    href: "/contracten/nieuw/arbeidsovereenkomst",
    titel: "Arbeidsovereenkomst",
    uitleg: "Voor iemand in loondienst: bepaalde of onbepaalde tijd, salaris, proeftijd en verlof. Controleert de wettelijke grenzen.",
    icon: BriefcaseBusiness,
    tone: "bg-emerald-50 text-emerald-600",
  },
];

/** Beginscherm: kies welk document je gaat invullen. */
export default async function NieuwContractPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; consultantId?: string; placementId?: string; doc?: string; taal?: string }>;
}) {
  const sp = await searchParams;
  // Oude links vanuit een persoon/plaatsing: direct naar de (lege) overeenkomst.
  if (sp.consultantId || sp.placementId) redirect("/contracten/nieuw/overeenkomst");
  // Oude links (toen Blanco/Timesheet hier zaten).
  const tl = sp.taal === "en" ? "&taal=en" : "";
  if (sp.doc === "urenstaat") redirect(`/contracten/blanco?doc=timesheet${tl}`);
  if (sp.doc === "persoonsgegevens" || sp.doc === "offerte") redirect(`/contracten/blanco?doc=${sp.doc}${tl}`);

  const q = sp.q?.trim() ?? "";
  const zoek = { contains: q, mode: "insensitive" as const };
  const contracten = await db.contract.findMany({
    where: q ? { OR: [{ contractorName: zoek }, { number: zoek }, { thirdParty: zoek }] } : undefined,
    orderBy: { updatedAt: "desc" },
    select: { id: true, number: true, contractorName: true, thirdParty: true, status: true, updatedAt: true, rateDay: true },
  });

  const docs = await db.docConcept.findMany({
    where: q ? { label: zoek } : undefined,
    orderBy: { updatedAt: "desc" },
    select: { id: true, soort: true, label: true, updatedAt: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nieuw contract"
        description="Kies wat je wilt opstellen. Wat je invult blijft als concept bewaard, ook als je tussendoor naar een andere pagina gaat."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {SOORTEN.map(({ href, titel, uitleg, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col rounded-lg border border-ink-200 bg-white p-6 transition hover:border-ink-900 hover:shadow-md"
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${tone} transition-transform group-hover:scale-110`}>
              <Icon className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-lg font-bold text-ink-900">{titel}</h2>
            <p className="mt-1.5 flex-1 text-sm text-ink-500">{uitleg}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              Invullen <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-base font-bold text-ink-900">
            {q ? `Gevonden contracten (${contracten.length})` : `Opgestelde contracten (${contracten.length})`}
          </h2>
          <p className="text-sm text-ink-500">
            Alle overeenkomsten van opdracht die hier zijn ingevuld en opgeslagen. Klik om te bekijken, aan te passen, te printen of als Word te downloaden.
          </p>
        </div>
        <TabelZoek basePath="/contracten/nieuw" q={q} placeholder="Zoek op naam, contractnummer of klant…" />
        <Card className="overflow-hidden">
          {contracten.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-400">
              {q ? `Geen contracten gevonden voor “${q}”.` : "Nog geen contracten opgesteld."}
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {contracten.map((c) => (
                <li key={c.id}>
                  <Link href={`/contracten/${c.id}`} className="flex items-center gap-4 px-5 py-3 text-sm hover:bg-ink-50">
                    <FileSignature className="h-4 w-4 shrink-0 text-ink-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-900">{c.contractorName || "Naamloos"}</span>
                      <span className="block truncate text-xs text-ink-400">
                        {[c.number, c.thirdParty, c.rateDay].filter(Boolean).join(" · ") || "Overeenkomst van opdracht"}
                      </span>
                    </span>
                    <StatusBadge options={CONTRACT_STATUSES} value={c.status} />
                    <span className="hidden w-24 text-right text-xs text-ink-400 sm:block">{formatDate(c.updatedAt)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-base font-bold text-ink-900">Opgeslagen offertes &amp; arbeidsovereenkomsten ({docs.length})</h2>
          <p className="text-sm text-ink-500">Klik om verder te bewerken, te printen of als Word te downloaden.</p>
        </div>
        <Card className="overflow-hidden">
          {docs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-400">Nog niets opgeslagen — klik in een offerte of arbeidsovereenkomst op Opslaan.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 pr-3 hover:bg-ink-50">
                  <Link href={`/contracten/nieuw/${d.soort}?doc=${d.id}`} className="flex min-w-0 flex-1 items-center gap-4 px-5 py-3 text-sm">
                    {d.soort === "offerte" ? (
                      <Receipt className="h-4 w-4 shrink-0 text-amber-600" />
                    ) : (
                      <BriefcaseBusiness className="h-4 w-4 shrink-0 text-emerald-600" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-900">{d.label || "Naamloos"}</span>
                      <span className="block text-xs text-ink-400">{d.soort === "offerte" ? "Offerte" : "Arbeidsovereenkomst"}</span>
                    </span>
                    <span className="hidden w-24 text-right text-xs text-ink-400 sm:block">{formatDate(d.updatedAt)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
                  </Link>
                  <ConfirmSubmit action={verwijderDoc} id={d.id} message="Dit document verwijderen?" variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </ConfirmSubmit>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
