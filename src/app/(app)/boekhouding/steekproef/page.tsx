import Link from "next/link";
import { ShieldCheck, CheckCircle2, AlertTriangle, Download, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { matchSalesInvoices, steekproefChecklist } from "@/lib/steekproef";

export const metadata = { title: "Steekproef (Kiwa/SNA)" };
export const dynamic = "force-dynamic";

/**
 * Kiwa/SNA-steekproef zzp/inleen: zoek op de inkoopfactuurnummers uit de
 * opvraagmail en zie per ZZP'er meteen welke van de gevraagde stukken we in
 * huis hebben. Eén klik bundelt alles per regel in een nette ZIP voor de
 * submap "Steekproef ZZP".
 */
export default async function SteekproefPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  // Nummers uit de mail: komma/spatie/nieuweregel-gescheiden.
  const terms = (sp.q ?? "")
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

  type Row = {
    inv: {
      id: string;
      number: string | null;
      issueDate: Date | null;
      amount: number;
      hasFile: boolean;
      consultant: {
        id: string;
        firstName: string;
        lastName: string;
        companyName: string | null;
        employmentType: string;
      };
    };
    checklist: ReturnType<typeof steekproefChecklist>;
    salesNumbers: string[];
  };
  const rows: Row[] = [];

  if (terms.length > 0) {
    const found = await db.receivedInvoice.findMany({
      where: {
        OR: terms.map((t) => ({ number: { contains: t, mode: "insensitive" as const } })),
      },
      include: {
        consultant: {
          select: {
            id: true, firstName: true, lastName: true, companyName: true, employmentType: true,
          },
        },
      },
      orderBy: { issueDate: "desc" },
      take: 40,
    });

    for (const inv of found) {
      const [docs, sales] = await Promise.all([
        db.document.groupBy({
          by: ["category"],
          where: { consultantId: inv.consultantId },
          _count: { _all: true },
        }),
        db.invoice.findMany({
          where: {
            lines: {
              some: { timesheet: { placement: { consultantId: inv.consultantId } } },
            },
          },
          include: {
            lines: { include: { timesheet: { select: { weekStart: true } } } },
          },
        }),
      ]);
      const docCount = new Map(docs.map((d) => [d.category, d._count._all]));
      const salesMatches = matchSalesInvoices(
        {
          id: inv.id,
          issueDate: inv.issueDate,
          periodStart: inv.periodStart,
          periodEnd: inv.periodEnd,
        },
        sales.map((s) => ({
          id: s.id,
          number: s.number,
          issueDate: s.issueDate,
          weekStarts: s.lines
            .map((l) => l.timesheet?.weekStart)
            .filter((w): w is Date => Boolean(w)),
        })),
      );
      rows.push({
        inv: {
          id: inv.id,
          number: inv.number,
          issueDate: inv.issueDate,
          amount: inv.amount,
          hasFile: Boolean(inv.fileName),
          consultant: inv.consultant,
        },
        checklist: steekproefChecklist({
          contractDocs: docCount.get("CONTRACT") ?? 0,
          kvkDocs: docCount.get("KVK") ?? 0,
          idDocs: docCount.get("ID") ?? 0,
          purchaseFile: Boolean(inv.fileName),
          paymentDocs: docCount.get("BETAALBEWIJS") ?? 0,
          salesMatches: salesMatches.length,
        }),
        salesNumbers: salesMatches.map((s) => s.number),
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Steekproef (Kiwa/SNA)"
        description="Plak de inkoopfactuurnummers uit de opvraagmail. Per ZZP'er zie je direct welke stukken compleet zijn en download je alles als ZIP voor de submap Steekproef ZZP."
      />

      <Card>
        <CardContent className="pt-5">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="min-w-72 flex-1">
              <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-ink-700">
                Factuurnummers uit de mail
              </label>
              <input
                id="q"
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Bijv. 11-2026, 2025251, 2026003"
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
              <p className="mt-1 text-xs text-ink-400">
                Meerdere nummers mag: gescheiden door komma, spatie of nieuwe regel.
              </p>
            </div>
            <button type="submit" className={buttonVariants({})}>Zoeken</button>
          </form>
        </CardContent>
      </Card>

      {terms.length > 0 && rows.length === 0 && (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Geen inkoopfacturen gevonden"
          description="Controleer of de nummers exact overeenkomen met de ontvangen facturen (Ontvangen facturen)."
        />
      )}

      {rows.map(({ inv, checklist, salesNumbers }) => {
        const complete = checklist.every((c) => c.ok);
        const name = inv.consultant.companyName?.trim() ||
          `${inv.consultant.firstName} ${inv.consultant.lastName}`;
        return (
          <Card key={inv.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <ShieldCheck className={cn("h-5 w-5", complete ? "text-emerald-600" : "text-amber-500")} />
                {name}
                <span className="text-sm font-normal text-ink-400">
                  factuur {inv.number ?? "zonder nummer"}
                  {inv.issueDate && ` · ${formatDate(inv.issueDate)}`}
                  {inv.amount > 0 && ` · ${formatCurrency(inv.amount)}`}
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-bold",
                    complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                  )}
                >
                  {checklist.filter((c) => c.ok).length} van {checklist.length} stukken
                </span>
                <a
                  href={`/api/steekproef/${inv.id}`}
                  className={buttonVariants({ variant: "primary", size: "sm" })}
                  title="Alle beschikbare stukken van deze regel als ZIP downloaden"
                >
                  <Download className="h-4 w-4" /> Download ZIP
                </a>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {checklist.map((c) => (
                  <li key={c.key} className="flex items-center gap-2 text-sm">
                    {c.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <span className={c.ok ? "text-ink-700" : "font-medium text-amber-800"}>
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
              {salesNumbers.length > 0 && (
                <p className="mt-3 text-xs text-ink-400">
                  Gekoppelde verkoopfactu{salesNumbers.length === 1 ? "ur" : "ren"}: {salesNumbers.join(", ")}
                </p>
              )}
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <Link href={`/medewerkers/${inv.consultant.id}/documenten`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                  <FileText className="h-3.5 w-3.5" /> Dossier-documenten (ontbrekende stukken uploaden)
                </Link>
                <Link href={`/ontvangen-facturen`} className="text-brand-700 hover:underline">
                  Naar ontvangen facturen
                </Link>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
