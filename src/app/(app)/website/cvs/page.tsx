import Link from "next/link";
import { Inbox, FileText, Kanban, ArrowLeft, Upload, Target, Globe, Mail } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { isVisionConfigured } from "@/lib/ai";
import {
  isMailboxConnected,
  mailboxAddress,
  scanCostPerCvEur,
  SCAN_TOKENS_PER_CV,
} from "@/lib/mailbox";
import { CvsList, type CvRow } from "./CvsList";
import { EmailInboxPanel } from "./EmailInboxPanel";

export const metadata = { title: "Binnengekomen CV's" };
export const dynamic = "force-dynamic";

export default async function WebsiteCvsPage({
  searchParams,
}: {
  searchParams: Promise<{
    bron?: string;
    import?: string;
    n?: string;
    skip?: string;
    scanned?: string;
    scanfail?: string;
  }>;
}) {
  const sp = await searchParams;
  const bron: "website" | "email" = sp.bron === "email" ? "email" : "website";

  const [candidates, websiteCount, emailCount] = await Promise.all([
    db.candidate.findMany({
      where: { cvFileName: { not: null }, source: bron === "email" ? "EMAIL" : { not: "EMAIL" } },
      orderBy: { createdAt: "desc" },
    }),
    db.candidate.count({ where: { cvFileName: { not: null }, source: { not: "EMAIL" } } }),
    db.candidate.count({ where: { cvFileName: { not: null }, source: "EMAIL" } }),
  ]);

  const deals = await db.deal.findMany({
    where: { candidateId: { in: candidates.map((c) => c.id) } },
    select: { id: true, candidateId: true },
    orderBy: { createdAt: "desc" },
  });
  const dealByCand = new Map<string, string>();
  for (const d of deals) if (d.candidateId && !dealByCand.has(d.candidateId)) dealByCand.set(d.candidateId, d.id);

  const rows: CvRow[] = candidates.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email ?? "",
    location: c.location ?? "",
    headline: c.headline ?? "",
    disciplineRaw: c.discipline ?? "",
    disciplineLabel: c.discipline ? labelFor(DISCIPLINES, c.discipline) : "",
    source: c.source,
    availability: c.availability,
    createdAt: c.createdAt.toISOString(),
    cvHref: c.cvFileName ? `/api/cv/${c.id}` : null,
    dealId: dealByCand.get(c.id) ?? null,
  }));

  const inCrm = rows.filter((r) => r.dealId).length;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recent = candidates.filter((c) => c.createdAt >= weekAgo).length;

  const tabLink = (t: "website" | "email", label: string, count: number, icon: React.ReactNode) => (
    <Link
      href={`/website/cvs?bron=${t}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        bron === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
      )}
    >
      {icon} {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-xs font-semibold tabular-nums",
          bron === t ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-600",
        )}
      >
        {count}
      </span>
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Binnengekomen CV's"
        description="CV's vanuit de website én de cv@q4s.nl-mailbox — op één plek. Filter op discipline, bron of beschikbaarheid en zet een interessante kandidaat met één klik als lead in de CRM-pijplijn."
        actions={
          <>
            <Link href="/website" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="h-4 w-4" /> Website
            </Link>
            <Link href="/website/cvs/matches" className={buttonVariants({ variant: "outline" })}>
              <Target className="h-4 w-4" /> CV-matches
            </Link>
            <Link href="/website/cvs/importeren" className={buttonVariants()}>
              <Upload className="h-4 w-4" /> CV importeren
            </Link>
          </>
        }
      />

      {sp.import && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {sp.import === "bulk"
            ? `${sp.n ?? 0} CV('s) geïmporteerd${Number(sp.skip) > 0 ? `, ${sp.skip} overgeslagen (te groot of verkeerd type)` : ""}.`
            : "CV geïmporteerd — de kandidaat staat nu in de lijst."}
        </p>
      )}
      {sp.scanned && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Mailbox gescand — {sp.scanned} nieuwe CV('s) toegevoegd.
        </p>
      )}
      {sp.scanfail === "notconnected" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          De mailbox is nog niet gekoppeld — zet de <code className="rounded bg-amber-100 px-1">CV_MAILBOX_*</code>-gegevens in je .env.
        </p>
      )}
      {sp.scanfail === "pending" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Mailbox gekoppeld — de IMAP-uitlezing wordt in de volgende stap ingeschakeld.
        </p>
      )}

      {/* Bron-switch */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {tabLink("website", "Website", websiteCount, <Globe className="h-4 w-4" />)}
        {tabLink("email", "E-mail", emailCount, <Mail className="h-4 w-4" />)}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="CV's in deze bron" value={rows.length} icon={<FileText className="h-5 w-5" />} accent="brand" />
        <StatCard label="Nieuw (7 dagen)" value={recent} icon={<Inbox className="h-5 w-5" />} accent="green" />
        <StatCard label="Doorgezet als lead" value={inCrm} sub="staat in het CRM" icon={<Kanban className="h-5 w-5" />} accent="violet" />
      </div>

      {bron === "email" && (
        <EmailInboxPanel
          connected={isMailboxConnected()}
          visionReady={isVisionConfigured()}
          address={mailboxAddress()}
          costPerCvEur={scanCostPerCvEur()}
          tokensPerCv={SCAN_TOKENS_PER_CV}
        />
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={bron === "email" ? <Mail className="h-6 w-6" /> : <Inbox className="h-6 w-6" />}
              title={bron === "email" ? "Nog geen CV's uit de mailbox" : "Nog geen CV's binnen"}
              description={
                bron === "email"
                  ? "Zodra de mailbox gekoppeld is en je scant, verschijnen de gevonden kandidaten hier — of importeer zelf een stapel CV's."
                  : "Zodra iemand via de website solliciteert en een CV meestuurt verschijnt die kandidaat hier — of importeer zelf een stapel CV's."
              }
              action={
                <Link href="/website/cvs/importeren" className={buttonVariants()}>
                  <Upload className="h-4 w-4" /> CV importeren
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <CvsList rows={rows} />
      )}
    </div>
  );
}
