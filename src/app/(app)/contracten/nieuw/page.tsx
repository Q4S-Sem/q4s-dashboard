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
import { Trash2, Hourglass, CheckCircle2 } from "lucide-react";
import { mapTabVariants } from "@/components/ui/button";

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
  searchParams: Promise<{ q?: string; map?: string; consultantId?: string; placementId?: string; doc?: string; taal?: string }>;
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
    select: { id: true, soort: true, label: true, status: true, updatedAt: true },
  });

  // Eén lijst: overeenkomsten (Contract) + opgeslagen offertes/arbeidsovereenkomsten.
  const rijen = [
    ...contracten.map((c) => ({
      id: c.id,
      doc: false,
      href: `/contracten/${c.id}`,
      Icon: FileSignature,
      kleur: "text-ink-400",
      titel: c.contractorName,
      sub: ["Overeenkomst van opdracht", c.number, c.thirdParty, c.rateDay].filter(Boolean).join(" · "),
      status: c.status as string | null,
      klaar: c.status !== "DRAFT",
      datum: c.updatedAt,
    })),
    ...docs.map((d) => ({
      id: d.id,
      doc: true,
      href: `/contracten/nieuw/${d.soort}?doc=${d.id}`,
      Icon: d.soort === "offerte" ? Receipt : BriefcaseBusiness,
      kleur: d.soort === "offerte" ? "text-amber-600" : "text-emerald-600",
      titel: d.label,
      sub: d.soort === "offerte" ? "Offerte" : "Arbeidsovereenkomst",
      status: null,
      klaar: d.status === "READY",
      datum: d.updatedAt,
    })),
  ].sort((x, y) => y.datum.getTime() - x.datum.getTime());
  const concepten = rijen.filter((r) => !r.klaar);
  const klaar = rijen.filter((r) => r.klaar);
  // Zonder keuze: Klaar, tenzij daar niets in staat en er wel concepten zijn.
  const map = sp.map === "klaar" || sp.map === "concepten" ? sp.map : klaar.length === 0 && concepten.length > 0 ? "concepten" : "klaar";
  const zichtbaar = map === "klaar" ? klaar : concepten;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nieuw contract"
        description="Kies wat je wilt opstellen — je begint altijd met een leeg formulier. Opslaan als concept of als klaar; je vindt het hieronder terug."
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
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-200">
          <nav aria-label="Opgestelde documenten" className="flex items-end gap-1">
            {(
              [
                ["klaar", "Klaar", klaar.length, <CheckCircle2 key="k" className="h-4 w-4" />],
                ["concepten", "Concepten", concepten.length, <Hourglass key="c" className="h-4 w-4" />],
              ] as const
            ).map(([key, label, n, icon]) => (
              <Link
                key={key}
                href={`/contracten/nieuw?map=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                aria-current={map === key ? "true" : undefined}
                className={mapTabVariants(map === key)}
              >
                {/* Zelfde kleuren als Plaatsingen: groen = klaar, oranje = nog bezig. */}
                <span className={key === "klaar" ? "text-emerald-600" : "text-orange-500"}>{icon}</span>
                {label}
                <span
                  className={`rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    key === "klaar" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"
                  }`}
                >
                  {n}
                </span>
              </Link>
            ))}
          </nav>
          <p className="mb-2 text-xs text-ink-500">
            {map === "klaar" ? "Definitief of getekend — klaar om te versturen." : "Nog niet af — klik om verder te gaan."}
          </p>
        </div>
        <TabelZoek basePath="/contracten/nieuw" behoud={{ map }} q={q} placeholder="Zoek op naam, contractnummer of klant…" />
        <Card className="overflow-hidden">
          {zichtbaar.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-400">
              {q ? `Niets gevonden voor “${q}”.` : map === "klaar" ? "Nog niets klaar." : "Geen concepten."}
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {zichtbaar.map((r) => (
                <li key={r.id} className="flex items-center gap-2 pr-3 hover:bg-ink-50">
                  <Link href={r.href} className="flex min-w-0 flex-1 items-center gap-4 px-5 py-3 text-sm">
                    <r.Icon className={`h-4 w-4 shrink-0 ${r.kleur}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-900">{r.titel || "Naamloos"}</span>
                      <span className="block truncate text-xs text-ink-400">{r.sub}</span>
                    </span>
                    {r.status && <StatusBadge options={CONTRACT_STATUSES} value={r.status} />}
                    <span className="hidden w-24 text-right text-xs text-ink-400 sm:block">{formatDate(r.datum)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
                  </Link>
                  {r.doc && (
                    <ConfirmSubmit action={verwijderDoc} id={r.id} message="Dit document verwijderen?" variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </ConfirmSubmit>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
