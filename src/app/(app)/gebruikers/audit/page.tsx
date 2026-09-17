import Link from "next/link";
import { ShieldCheck, CheckCircle2, AlertTriangle, Download, FileText, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { auditFlag } from "@/lib/audit";

export const metadata = { title: "Audit (Kiwa/SNA)" };
export const dynamic = "force-dynamic";

/**
 * Audit-steekproef VERKOOPFACTUREN: plak de factuurnummers uit de
 * opvraagmail. Per factuur zie je de klant, het bedrag, of er
 * urenspecificaties (timesheet-bronbestanden) bij zitten, en of de factuur
 * onder de "LET OP"-regel valt (creditnota/training/doorbelasting/inleen —
 * dan moet de eerstvolgende factuur mee). Download alles in één ZIP voor de
 * gedeelde map, submap "Facturen".
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const terms = (sp.q ?? "")
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 25);

  const rows: {
    id: string;
    number: string;
    client: string;
    issueDate: Date;
    total: number;
    flag: string | null;
    timesheetDocs: number;
    lineCount: number;
  }[] = [];
  const notFound: string[] = [];

  if (terms.length > 0) {
    const found = await db.invoice.findMany({
      where: { OR: terms.map((t) => ({ number: { contains: t, mode: "insensitive" as const } })) },
      include: {
        client: { select: { companyName: true } },
        lines: {
          include: {
            timesheet: { select: { id: true, inbox: { select: { id: true } } } },
          },
        },
      },
      orderBy: { number: "asc" },
      take: 50,
    });
    const foundNumbers = new Set(found.map((f) => f.number.toLowerCase()));
    for (const t of terms) {
      if (![...foundNumbers].some((n) => n.includes(t.toLowerCase()))) notFound.push(t);
    }
    for (const inv of found) {
      rows.push({
        id: inv.id,
        number: inv.number,
        client: inv.client.companyName,
        issueDate: inv.issueDate,
        total: inv.total,
        flag: auditFlag(inv),
        timesheetDocs: inv.lines.filter((l) => l.timesheet?.inbox).length,
        lineCount: inv.lines.length,
      });
    }
  }

  const zipHref = terms.length > 0 ? `/api/audit/facturen?q=${encodeURIComponent(terms.join(","))}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit (Kiwa/SNA)"
        description="Plak de factuurnummers uit de opvraagmail van de auditor. Je ziet direct welke facturen we hebben, welke onder de LET OP-regel vallen, en downloadt alles inclusief urenspecificaties als ZIP voor de gedeelde map."
      />

      <Card>
        <CardContent className="pt-5">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="min-w-72 flex-1">
              <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-ink-700">
                Factuurnummers uit de mail
              </label>
              <textarea
                id="q"
                name="q"
                rows={2}
                defaultValue={sp.q ?? ""}
                placeholder={"Bijv. 2025116, 2025143, 2025170\nof elk nummer op een eigen regel"}
                className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
              <p className="mt-1 text-xs text-ink-400">
                Gescheiden door komma, spatie of nieuwe regel. Voor de ZZP/inleen-steekproef
                (inkoopfacturen + dossierstukken) is er de aparte pagina{" "}
                <Link href="/boekhouding/steekproef" className="text-brand-700 hover:underline">
                  Steekproef ZZP
                </Link>.
              </p>
            </div>
            <button type="submit" className={buttonVariants({})}>Zoeken</button>
            {zipHref && rows.length > 0 && (
              <a href={zipHref} className={buttonVariants({ variant: "success" })}>
                <Download className="h-4 w-4" /> Alles als ZIP
              </a>
            )}
          </form>
        </CardContent>
      </Card>

      {notFound.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Niet gevonden: {notFound.join(", ")} — controleer het nummer bij Verkoopfacturen.
        </p>
      )}

      {terms.length > 0 && rows.length === 0 && (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Geen facturen gevonden"
          description="Controleer of de nummers overeenkomen met Verkoopfacturen (bijv. 2025116)."
        />
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-ink-400" /> Gevonden facturen ({rows.length})
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-ink-100">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/facturen/${r.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                      {r.number}
                    </Link>
                    <span className="text-sm text-ink-500">{r.client}</span>
                    {r.flag ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-bold text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> LET OP: {r.flag}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-bold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Regulier
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {formatDate(r.issueDate)} · {formatCurrency(r.total)} ·{" "}
                    {r.timesheetDocs > 0
                      ? `${r.timesheetDocs} urenspecificatie${r.timesheetDocs === 1 ? "" : "s"} beschikbaar`
                      : "geen urenspecificatie-bron gevonden"}
                  </p>
                  {r.flag && (
                    <p className="mt-1 text-xs font-medium text-amber-800">
                      Regel van de auditor: lever óók de eerstvolgende reguliere factuur aan
                      (die zit automatisch mee in de ZIP).
                    </p>
                  )}
                </div>
                <a
                  href={`/api/audit/facturen?q=${encodeURIComponent(r.number)}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 self-start sm:self-auto")}
                  title="Deze factuur + urenspecificaties als ZIP"
                >
                  <Download className="h-4 w-4" /> ZIP
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-ink-400" /> Hoe werkt de aanlevering?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-600">
          <p>1. Plak de factuurnummers uit de mail en klik Zoeken.</p>
          <p>
            2. Facturen met een amber <b>LET OP</b>-label vallen onder de uitzonderingsregel
            (creditnota, training, doorbelasting, inleen/ZZP): de auditor wil dan de
            eerstvolgende factuur érbij. De ZIP voegt die automatisch toe.
          </p>
          <p>
            3. Klik <b>Alles als ZIP</b> en zet de inhoud in de gedeelde map, submap
            &quot;Facturen&quot;. Elke factuur krijgt zijn eigen map met de factuur-PDF en de
            originele urenspecificaties (bronbestanden van de urenstaten).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
