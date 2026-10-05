import Link from "next/link";
import { ChevronRight, ExternalLink, FileText, Plus, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isAdminSession } from "@/lib/session";
import { CONTRACT_STATUSES, DOCUMENT_CATEGORIES } from "@/lib/domain";

export const metadata = { title: "Contracten" };
export const dynamic = "force-dynamic";

// Welke geüploade documenten per persoon getoond worden.
const DOC_SOORTEN = ["CONTRACT", "KVK", "ID"];
const KOLOMMEN = "grid-cols-[minmax(0,2fr)_minmax(0,2fr)_8rem_7rem_repeat(3,6.5rem)_1.5rem]";
const KOLOMMEN_PERSONEEL = "grid-cols-[minmax(0,2fr)_8rem_8rem_6rem_6.5rem_1.5rem]";

/**
 * Contracten per persoon: één regel per opdrachtnemer met bedrijf + KvK-nummer
 * en in één oogopslag of contract, KvK-uittreksel en ID er zijn. Uitklappen
 * toont de opgestelde contracten en de geüploade bestanden om te openen.
 */
export default async function ContractenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const mensen = await db.consultant.findMany({
    where: { OR: [{ active: true }, { contracts: { some: {} } }] },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      kvkNumber: true,
      contracts: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, number: true, status: true, updatedAt: true, rateDay: true, startDate: true },
      },
      documents: {
        where: { category: { in: DOC_SOORTEN } },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, category: true, createdAt: true },
      },
      placements: {
        orderBy: { startDate: "desc" },
        take: 1,
        select: { id: true, title: true, client: { select: { companyName: true } } },
      },
    },
  });

  const lijst = mensen.filter((m) =>
    matchtZoek(q, m.firstName, m.lastName, m.companyName, m.kvkNumber, m.placements[0]?.client?.companyName),
  );
  // Contracten voor nieuwe personen (nog niet als werknemer in het dashboard).
  const los = (
    await db.contract.findMany({
      where: { consultantId: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, number: true, status: true, updatedAt: true, contractorName: true, contractorKvk: true },
    })
  ).filter((c) => matchtZoek(q, c.contractorName, c.contractorKvk, c.number));
  // Eigen personeel (loondienst): hun getekende contract staat als dossierstuk bij de medewerker.
  const [personeelAlle, magSalaris] = await Promise.all([
    db.employee.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        startDate: true,
        monthlySalary: true,
        hoursPerWeek: true,
        documents: {
          where: { category: "CONTRACT" },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, createdAt: true },
        },
      },
    }),
    isAdminSession(),
  ]);
  const personeel = personeelAlle.filter((e) => matchtZoek(q, e.firstName, e.lastName, e.jobTitle));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracten"
        description="Alle contracten van iedereen die bij ons werkt — opdrachtnemers én eigen personeel. Klik op een naam om de contracten te openen, te printen of aan te passen."
        actions={
          <Link href="/contracten/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw contract
          </Link>
        }
      />

      <TabelZoek basePath="/contracten" q={q} placeholder="Zoek op naam, bedrijf, KvK of klant…" />

      <h2 className="text-sm font-bold text-ink-900">Opdrachtnemers (ZZP / gedetacheerd)</h2>
      <Card className="overflow-x-auto">
        <div className="min-w-[58rem]">
          <div
            className={`grid ${KOLOMMEN} items-center gap-3 border-b border-ink-200 bg-ink-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500`}
          >
            <span>Persoon</span>
            <span>Bedrijf</span>
            <span>KvK-nr.</span>
            <span>Dagtarief</span>
            <span>Contract</span>
            <span>KvK-uittreksel</span>
            <span>ID</span>
            <span />
          </div>

          {lijst.length === 0 && los.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink-400">
              {q ? "Niemand gevonden." : "Nog geen personen."}
            </p>
          )}

          {los.map((c) => (
            <Link
              key={c.id}
              href={`/contracten/${c.id}`}
              className={`grid ${KOLOMMEN} items-center gap-3 border-b border-ink-100 px-4 py-2.5 text-sm hover:bg-ink-50`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink-900">{c.contractorName}</span>
                <span className="block truncate text-xs text-amber-700">Nieuw persoon · nog niet gekoppeld</span>
              </span>
              <span className="truncate text-ink-600">{c.number ?? "—"}</span>
              <span className="tabular-nums text-ink-600">{c.contractorKvk || "—"}</span>
              <span className="text-ink-400">—</span>
              <StatusBadge options={CONTRACT_STATUSES} value={c.status} />
              <span className="text-xs text-ink-400">—</span>
              <span className="text-xs text-ink-400">—</span>
              <ChevronRight className="h-4 w-4 text-ink-400" />
            </Link>
          ))}

          {lijst.map((m) => {
            const naam = `${m.firstName} ${m.lastName}`.trim();
            const p = m.placements[0];
            const heeft = (soort: string) => m.documents.some((d) => d.category === soort);
            return (
              <details key={m.id} className="group border-b border-ink-100 last:border-0">
                <summary
                  className={`grid ${KOLOMMEN} cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-50 [&::-webkit-details-marker]:hidden`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-900">{naam}</span>
                    {p && (
                      <span className="block truncate text-xs text-ink-400">
                        {p.title}
                        {p.client ? ` · ${p.client.companyName}` : ""}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-ink-600">{m.companyName || "—"}</span>
                  <span className="tabular-nums text-ink-600">{m.kvkNumber || "—"}</span>
                  <span className="truncate tabular-nums text-ink-900">{m.contracts.find((c) => c.rateDay)?.rateDay || "—"}</span>
                  {/* Getekend of geüpload = aanwezig; anders de status van het laatste contract (bv. Concept). */}
                  {heeft("CONTRACT") || m.contracts.some((c) => c.status === "SIGNED") || m.contracts.length === 0 ? (
                    <Vink ok={m.contracts.length > 0 || heeft("CONTRACT")} />
                  ) : (
                    <StatusBadge options={CONTRACT_STATUSES} value={m.contracts[0].status} />
                  )}
                  <Vink ok={heeft("KVK")} />
                  <Vink ok={heeft("ID")} />
                  <ChevronRight className="h-4 w-4 text-ink-400 transition-transform group-open:rotate-90" />
                </summary>

                <div className="grid gap-4 border-t border-ink-100 bg-ink-50/50 px-4 py-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                      Opgestelde contracten
                    </p>
                    {m.contracts.length === 0 ? (
                      <p className="text-sm text-ink-400">Nog geen contract opgesteld.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {m.contracts.map((c) => (
                          <li key={c.id}>
                            <Link
                              href={`/contracten/${c.id}`}
                              className="flex items-center gap-2 rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm hover:border-ink-400"
                            >
                              <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                              <span className="font-medium text-ink-900">{c.number ?? "Contract"}</span>
                              {c.rateDay && <span className="text-xs text-ink-500">{c.rateDay}</span>}
                              <StatusBadge options={CONTRACT_STATUSES} value={c.status} />
                              <span className="ml-auto text-xs text-ink-400">{formatDate(c.updatedAt)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href={`/contracten/nieuw?consultantId=${m.id}${p ? `&placementId=${p.id}` : ""}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Nieuw contract
                    </Link>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                      Bestanden (contract, KvK-uittreksel, ID)
                    </p>
                    {m.documents.length === 0 ? (
                      <p className="text-sm text-ink-400">Nog niets geüpload.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {m.documents.map((d) => (
                          <li key={d.id}>
                            <a
                              href={`/api/documents/${d.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm hover:border-ink-400"
                            >
                              <StatusBadge options={DOCUMENT_CATEGORIES} value={d.category} />
                              <span className="min-w-0 truncate text-ink-900">{d.title}</span>
                              <span className="ml-auto shrink-0 text-xs text-ink-400">{formatDate(d.createdAt)}</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {p && (
                      <Link
                        href={`/plaatsingen/${p.id}/documenten`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                      >
                        <Upload className="h-3.5 w-3.5" /> Bestand uploaden
                      </Link>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </Card>

      <h2 className="pt-2 text-sm font-bold text-ink-900">Eigen personeel (loondienst)</h2>
      <Card className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div
            className={`grid ${KOLOMMEN_PERSONEEL} items-center gap-3 border-b border-ink-200 bg-ink-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500`}
          >
            <span>Persoon</span>
            <span>In dienst sinds</span>
            <span>Salaris p/m</span>
            <span>Uren/week</span>
            <span>Contract</span>
            <span />
          </div>
          {personeel.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink-400">{q ? "Niemand gevonden." : "Nog geen personeel."}</p>
          )}
          {personeel.map((e) => (
            <details key={e.id} className="group border-b border-ink-100 last:border-0">
              <summary
                className={`grid ${KOLOMMEN_PERSONEEL} cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-50 [&::-webkit-details-marker]:hidden`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink-900">{`${e.firstName} ${e.lastName}`.trim()}</span>
                  {e.jobTitle && <span className="block truncate text-xs text-ink-400">{e.jobTitle}</span>}
                </span>
                <span className="text-ink-600">{e.startDate ? formatDate(e.startDate) : "—"}</span>
                <span className="tabular-nums text-ink-900">{magSalaris ? (e.monthlySalary ? formatCurrency(e.monthlySalary) : "—") : "••••"}</span>
                <span className="tabular-nums text-ink-600">{e.hoursPerWeek}</span>
                <Vink ok={e.documents.length > 0} />
                <ChevronRight className="h-4 w-4 text-ink-400 transition-transform group-open:rotate-90" />
              </summary>
              <div className="border-t border-ink-100 bg-ink-50/50 px-4 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Contracten</p>
                {e.documents.length === 0 ? (
                  <p className="text-sm text-ink-400">Nog geen contract geüpload.</p>
                ) : (
                  <ul className="space-y-1.5 sm:max-w-xl">
                    {e.documents.map((d) => (
                      <li key={d.id}>
                        <a
                          href={`/api/medewerkers/document/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm hover:border-ink-400"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                          <span className="min-w-0 truncate text-ink-900">{d.title}</span>
                          <span className="ml-auto shrink-0 text-xs text-ink-400">{formatDate(d.createdAt)}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex gap-4">
                  <Link
                    href={`/medewerkers/${e.id}/documenten`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                  >
                    <Upload className="h-3.5 w-3.5" /> Contract uploaden
                  </Link>
                  <Link href={`/medewerkers/${e.id}/beloning`} className="text-xs font-medium text-brand-700 hover:underline">
                    Beloning bekijken →
                  </Link>
                </div>
              </div>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Vink({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="text-xs font-medium text-emerald-700">✓ Aanwezig</span>
  ) : (
    <span className="text-xs text-amber-600">Ontbreekt</span>
  );
}
