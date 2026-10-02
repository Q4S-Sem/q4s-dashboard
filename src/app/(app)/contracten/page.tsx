import Link from "next/link";
import { ChevronRight, ExternalLink, FileText, Plus, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { formatDate } from "@/lib/utils";
import { CONTRACT_STATUSES, DOCUMENT_CATEGORIES } from "@/lib/domain";

export const metadata = { title: "Contracten" };
export const dynamic = "force-dynamic";

// Welke geüploade documenten per persoon getoond worden.
const DOC_SOORTEN = ["CONTRACT", "KVK", "ID"];
const KOLOMMEN = "grid-cols-[minmax(0,2fr)_minmax(0,2fr)_8rem_repeat(3,6.5rem)_1.5rem]";

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
        select: { id: true, number: true, status: true, updatedAt: true },
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contracten"
        description="Per persoon zijn contracten, KvK-uittreksel en ID. Klik op een naam om alles te openen."
        actions={
          <Link href="/contracten/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw contract
          </Link>
        }
      />

      <TabelZoek basePath="/contracten" q={q} placeholder="Zoek op naam, bedrijf, KvK of klant…" />

      <Card className="overflow-x-auto">
        <div className="min-w-[52rem]">
          <div
            className={`grid ${KOLOMMEN} items-center gap-3 border-b border-ink-200 bg-ink-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500`}
          >
            <span>Persoon</span>
            <span>Bedrijf</span>
            <span>KvK-nr.</span>
            <span>Contract</span>
            <span>KvK-uittreksel</span>
            <span>ID</span>
            <span />
          </div>

          {lijst.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink-400">
              {q ? "Niemand gevonden." : "Nog geen personen."}
            </p>
          )}

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
                  <Vink ok={m.contracts.length > 0 || heeft("CONTRACT")} />
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
                              <StatusBadge options={CONTRACT_STATUSES} value={c.status} />
                              <span className="ml-auto text-xs text-ink-400">{formatDate(c.updatedAt)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href="/contracten/nieuw"
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
